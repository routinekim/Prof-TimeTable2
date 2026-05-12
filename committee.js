document.addEventListener('DOMContentLoaded', () => {
    const committeeList = document.getElementById('committeeList');
    const nameInput = document.getElementById('committeeNameInput');
    const addBtn = document.getElementById('addCommitteeBtn');
    const excelUpload = document.getElementById('excelUpload');
    const syncStatus = document.getElementById('syncStatus');

    // --- Supabase Config (Copied from script.js) ---
    const SUPABASE_URL = 'https://mwjuwzzipnwklxskocpb.supabase.co'; 
    const SUPABASE_KEY = 'sb_publishable_LLOkv1Fj-M-RV0IPq_9idQ_pD3OwgKP'; 
    
    let supabase = null;
    if (SUPABASE_URL && !SUPABASE_URL.includes('YOUR_PROJECT_URL')) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    // Load data from localStorage
    let committees = JSON.parse(localStorage.getItem('committees') || '[]');

    function save() {
        localStorage.setItem('committees', JSON.stringify(committees));
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
    addBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name) {
            committees.push({ name, members: '' });
            nameInput.value = '';
            save();
            render();
        }
    });

    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addBtn.click();
    });

    window.deleteCommittee = (index) => {
        if (confirm('이 위원회를 삭제하시겠습니까?')) {
            committees.splice(index, 1);
            save();
            render();
        }
    };

    window.updateMembers = (index, value) => {
        committees[index].members = value;
        save();
        const tagsContainer = document.getElementById(`tags-${index}`);
        if (tagsContainer) {
            const members = value.split(/[\/, ]+/).filter(m => m.trim());
            const tagsHtml = members.map(m => `<span class="member-tag">${m}</span>`).join('');
            tagsContainer.innerHTML = tagsHtml || '<span style="color:#94a3b8; font-size:0.8rem;">멤버를 추가해주세요</span>';
        }
    };

    // --- Excel Upload & Supabase Sync Logic ---
    let currentTimetableData = [];

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
                    currentTimetableData = newTimetable;
                    syncToCloud();
                }
            } catch (error) {
                console.error(error);
                alert('엑셀 처리 중 오류 발생');
            }
        };
        reader.readAsArrayBuffer(file);
    });

    async function syncToCloud() {
        if (!supabase) {
            alert('Supabase 설정이 완료되지 않았습니다.');
            return;
        }

        syncStatus.textContent = '상태: 클라우드 업데이트 중... ⏳';
        syncStatus.style.color = '#0284c7';

        try {
            const { error } = await supabase
                .from('timetable_data')
                .upsert({ 
                    id: 'latest', 
                    content: currentTimetableData,
                    updated_at: new Date() 
                });

            if (error) throw error;
            syncStatus.textContent = '상태: 시간표 동기화 완료! ✅ (방금)';
            syncStatus.style.color = '#059669';
            alert('🚀 시간표 데이터가 성공적으로 업데이트되었습니다!');
        } catch (error) {
            console.error(error);
            syncStatus.textContent = '상태: 동기화 실패 ❌';
            syncStatus.style.color = '#dc2626';
            alert('저장 오류: ' + error.message);
        }
    }

    render();
});
