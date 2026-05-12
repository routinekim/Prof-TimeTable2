document.addEventListener('DOMContentLoaded', () => {
    const committeeList = document.getElementById('committeeList');
    const nameInput = document.getElementById('committeeNameInput');
    const addBtn = document.getElementById('addCommitteeBtn');
    const excelUpload = document.getElementById('excelUpload');
    const syncStatus = document.getElementById('syncStatus');
    const forcePushBtn = document.getElementById('forcePushCommitteesBtn');

    // --- Supabase Config ---
    const SUPABASE_URL = 'https://mwjuwzzipnwklxskocpb.supabase.co'; 
    const SUPABASE_KEY = 'sb_publishable_LLOkv1Fj-M-RV0IPq_9idQ_pD3OwgKP'; 
    
    let supabase = null;
    if (SUPABASE_URL && !SUPABASE_URL.includes('YOUR_PROJECT_URL')) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    // Load data from localStorage initially
    let committees = JSON.parse(localStorage.getItem('committees') || '[]');

    async function loadAllData() {
        if (!supabase) {
            render();
            return;
        }

        syncStatus.textContent = '상태: 클라우드 데이터 불러오는 중...';
        
        try {
            // 1. Load Committees
            const { data: cData } = await supabase
                .from('timetable_data')
                .select('content')
                .eq('id', 'committees')
                .single();
            
            if (cData && cData.content) {
                committees = cData.content;
                localStorage.setItem('committees', JSON.stringify(committees));
                console.log("Committees loaded from cloud");
            }

            // 2. Load Timetable (for internal reference if needed)
            const { data: tData } = await supabase
                .from('timetable_data')
                .select('content')
                .eq('id', 'latest')
                .single();
            
            if (tData && tData.content) {
                localStorage.setItem('customTimetableData', JSON.stringify(tData.content));
            }

            syncStatus.textContent = '상태: 모든 데이터 동기화 완료 ✅';
        } catch (e) {
            console.log("Cloud load failed, using local data");
            syncStatus.textContent = '상태: 로컬 데이터 사용 중';
        }
        
        render();
    }

    async function saveCommitteesToCloud() {
        if (!supabase) return;
        
        localStorage.setItem('committees', JSON.stringify(committees));
        syncStatus.textContent = '상태: 위원회 데이터 저장 중... ⏳';

        try {
            await supabase
                .from('timetable_data')
                .upsert({ 
                    id: 'committees', 
                    content: committees,
                    updated_at: new Date() 
                });
            syncStatus.textContent = '상태: 위원회 동기화 완료! ✅';
        } catch (e) {
            console.error("Committee sync failed", e);
            syncStatus.textContent = '상태: 위원회 저장 실패 ❌';
        }
    }

    function render() {
        committeeList.innerHTML = '';
        committees.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

        committees.forEach((committee, index) => {
            const card = document.createElement('div');
            card.className = 'committee-card';
            const members = committee.members.split(/[\/, ]+/).filter(m => m.trim());
            const tagsHtml = members.map(m => `<span class="member-tag">${m}</span>`).join('');

            card.innerHTML = `
                <div class="card-header">
                    <h3>${committee.name}</h3>
                    <button class="delete-btn" onclick="deleteCommittee(${index})">삭제</button>
                </div>
                <div class="member-tags" id="tags-${index}">
                    ${tagsHtml || '<span style="color:#94a3b8; font-size:0.8rem;">멤버를 추가해주세요</span>'}
                </div>
                <div class="member-input-wrapper">
                    <label style="font-size:0.8rem; color:#64748b;">교수진 입력 (쉼표 또는 공백 구분)</label>
                    <textarea class="member-textarea" oninput="updateMembers(${index}, this.value)" placeholder="김교수, 이교수...">${committee.members}</textarea>
                </div>
            `;
            committeeList.appendChild(card);
        });
    }

    // Add new committee
    addBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (name) {
            committees.push({ name, members: '' });
            nameInput.value = '';
            render();
            await saveCommitteesToCloud();
        }
    });

    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addBtn.click();
    });

    window.deleteCommittee = async (index) => {
        if (confirm('이 위원회를 삭제하시겠습니까?')) {
            committees.splice(index, 1);
            render();
            await saveCommitteesToCloud();
        }
    };

    let debounceTimer;
    window.updateMembers = (index, value) => {
        committees[index].members = value;
        
        // Update UI immediately
        const tagsContainer = document.getElementById(`tags-${index}`);
        if (tagsContainer) {
            const members = value.split(/[\/, ]+/).filter(m => m.trim());
            const tagsHtml = members.map(m => `<span class="member-tag">${m}</span>`).join('');
            tagsContainer.innerHTML = tagsHtml || '<span style="color:#94a3b8; font-size:0.8rem;">멤버를 추가해주세요</span>';
        }

        // Debounce cloud save to avoid too many requests while typing
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            saveCommitteesToCloud();
        }, 1000);
    };

    // --- Excel Upload & Supabase Sync Logic ---
    excelUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                const newTimetable = [];
                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || !row[0]) continue;
                    newTimetable.push({
                        period: row[0].toString(),
                        days: {
                            "월": (row[1] || "").toString().split(/[\/,]+/).map(n => n.trim()).filter(n => n),
                            "화": (row[2] || "").toString().split(/[\/,]+/).map(n => n.trim()).filter(n => n),
                            "수": (row[3] || "").toString().split(/[\/,]+/).map(n => n.trim()).filter(n => n),
                            "목": (row[4] || "").toString().split(/[\/,]+/).map(n => n.trim()).filter(n => n),
                            "금": (row[5] || "").toString().split(/[\/,]+/).map(n => n.trim()).filter(n => n)
                        }
                    });
                }

                if (newTimetable.length > 0) {
                    syncTimetableToCloud(newTimetable);
                }
            } catch (error) {
                console.error(error);
                alert('엑셀 처리 중 오류 발생');
            }
        };
        reader.readAsArrayBuffer(file);
    });

    async function syncTimetableToCloud(data) {
        if (!supabase) return;
        syncStatus.textContent = '상태: 시간표 데이터 업데이트 중... ⏳';

        try {
            const { error } = await supabase
                .from('timetable_data')
                .upsert({ 
                    id: 'latest', 
                    content: data,
                    updated_at: new Date() 
                });

            if (error) throw error;
            syncStatus.textContent = '상태: 시간표 동기화 완료! ✅';
            alert('🚀 시간표 데이터가 클라우드에 성공적으로 저장되었습니다!');
        } catch (error) {
            console.error(error);
            syncStatus.textContent = '상태: 시간표 저장 실패 ❌';
            alert('저장 오류: ' + error.message);
        }
    }

    // Manual Force Push for existing local data
    forcePushBtn.addEventListener('click', async () => {
        if (confirm('현재 화면에 보이는 위원회 정보를 서버(클라우드)로 전송하시겠습니까? (서버 데이터가 현재 데이터로 덮어씌워집니다)')) {
            await saveCommitteesToCloud();
            alert('✅ 로컬 데이터가 성공적으로 서버에 저장되었습니다. 이제 다른 기기에서도 확인하실 수 있습니다!');
        }
    });

    loadAllData();
});
