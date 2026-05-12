document.addEventListener('DOMContentLoaded', () => {
    const timetableBody = document.getElementById('timetableBody');
    const searchInput = document.getElementById('nameSearch');
    const loginOverlay = document.getElementById('loginOverlay');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const adminControls = document.getElementById('adminControls');
    const excelUpload = document.getElementById('excelUpload');
    const saveToCloudBtn = document.getElementById('saveToCloudBtn');
    const syncStatus = document.getElementById('syncStatus');

    // --- Supabase Config ---
    const SUPABASE_URL = 'https://mwjuwzzipnwklxskocpb.supabase.co'; // 사용자님의 프로젝트 URL로 변경 필요
    const SUPABASE_KEY = 'sb_publishable_LLOkv1Fj-M-RV0IPq_9idQ_pD3OwgKP'; // 사용자님의 anon key로 변경 필요

    let supabase = null;
    if (SUPABASE_URL && !SUPABASE_URL.includes('YOUR_PROJECT_URL')) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.warn("Supabase 설정이 완료되지 않았습니다. 기본 데이터를 사용합니다.");
    }

    // Auth state management
    let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    // Use a flexible variable for data
    let currentTimetableData = window.timetableData || [];

    // --- Data Loading Logic ---
    async function loadInitialData() {
        // 1. Try Cloud (Supabase) first
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('timetable_data')
                    .select('content')
                    .eq('id', 'latest')
                    .single();

                if (data && data.content) {
                    currentTimetableData = data.content;
                    console.log("Cloud data loaded successfully");
                    renderTimetable();
                    return;
                }
            } catch (e) {
                console.log("Cloud fetch failed or table not ready, trying local...");
            }
        }

        // 2. Fallback to LocalStorage
        const savedData = localStorage.getItem('customTimetableData');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    currentTimetableData = parsed;
                    console.log("Local storage data loaded");
                }
            } catch (e) {
                console.error("Local storage parse error", e);
            }
        }

        renderTimetable();
    }

    function updateAuthState() {
        if (isLoggedIn) {
            loginOverlay.classList.add('hidden');
            logoutBtn.style.display = 'block';
            adminControls.style.display = 'block';
            searchInput.disabled = false;
        } else {
            loginOverlay.classList.remove('hidden');
            logoutBtn.style.display = 'none';
            adminControls.style.display = 'none';
            searchInput.disabled = true;
            searchInput.value = '';
            renderTimetable('');
        }
    }

    // Login Handle
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value;
        const password = passwordInput.value;

        if (username === 'admin' && password === '1234') {
            isLoggedIn = true;
            localStorage.setItem('isLoggedIn', 'true');
            updateAuthState();
            loginError.textContent = '';
            usernameInput.value = '';
            passwordInput.value = '';
        } else {
            loginError.textContent = '아이디 또는 비밀번호가 올바르지 않습니다.';
        }
    });

    // Logout Handle
    logoutBtn.addEventListener('click', () => {
        isLoggedIn = false;
        localStorage.removeItem('isLoggedIn');
        updateAuthState();
    });

    const days = ['월', '화', '수', '목', '금'];

    function getColor(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = Math.abs(hash) % 360;
        return {
            bg: `hsl(${h}, 70%, 90%)`,
            text: `hsl(${h}, 70%, 25%)`
        };
    }

    function renderTimetable(searchQuery = '', forceShow = false) {
        timetableBody.innerHTML = '';
        const trimmedQuery = searchQuery.trim();
        const queries = trimmedQuery.toLowerCase().split(/[,\s]+/).filter(q => q.length > 0);

        currentTimetableData.forEach(row => {
            const tr = document.createElement('tr');
            const periodTd = document.createElement('td');
            periodTd.className = 'period-cell';

            let periodRaw = (row.period || "").toString().trim();
            if (periodRaw.includes(',')) {
                const parts = periodRaw.split(',').map(s => s.trim()).filter(s => s);
                periodRaw = parts[parts.length - 1];
            }

            const match = periodRaw.match(/(.*)(\(.*\))/);
            let pNum = periodRaw;
            let pTime = "";
            if (match) {
                pNum = match[1].trim();
                pTime = match[2].trim();
            }

            periodTd.innerHTML = `<div class="p-num">${pNum}</div><div class="p-time">${pTime}</div>`;
            tr.appendChild(periodTd);

            const grayPeriods = ['0교시', '2교시', '6교시', '8교시', '10교시', '12교시', '14교시'];
            if (grayPeriods.includes(pNum)) {
                tr.classList.add('gray-row');
            } else if (pNum === '4교시') {
                tr.classList.add('lunch-row');
            }

            days.forEach(day => {
                const td = document.createElement('td');
                const names = row.days[day] || [];

                if (isLoggedIn && (queries.length > 0 || forceShow)) {
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'cell-content';

                    names.forEach(name => {
                        const nameLower = name.toLowerCase();
                        const isMatch = forceShow || queries.some(q => nameLower.includes(q));

                        if (isMatch) {
                            const span = document.createElement('span');
                            span.className = 'name-tag active';
                            span.textContent = name;
                            const colors = getColor(name);
                            span.style.backgroundColor = colors.bg;
                            span.style.color = colors.text;
                            span.style.borderColor = colors.text.replace('25%', '60%');
                            contentDiv.appendChild(span);
                        }
                    });
                    td.appendChild(contentDiv);
                }
                tr.appendChild(td);
            });
            timetableBody.appendChild(tr);
        });
    }

    excelUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                const newTimetable = [];
                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length === 0 || !row[0]) continue;
                    newTimetable.push({
                        period: row[0].toString(),
                        days: {
                            "월": (row[1] || "").toString().split(/[\/,]+/).map(n => n.trim()).filter(n => n),
                            "화": (row[2] || "").toString().split(/[\/,]+/).map(n => n.trim()).filter(n => n),
                            "수": (row[3] || "").toString().split(/[\/,]+/).map(n => n.trim()).filter(n => n),
                            "목": (row[4] || "").toString().split(/[\/,]+/).map(n => n.trim()).filter(n => n),
                            "금": (row[5] || "").toString().split(/[\/,]+/).map(n => n.trim()).filter(n => n),
                            "토": (row[6] || "").toString().split(/[\/,]+/).map(n => n.trim()).filter(n => n),
                            "일": (row[7] || "").toString().split(/[\/,]+/).map(n => n.trim()).filter(n => n)
                        }
                    });
                }

                if (newTimetable.length > 0) {
                    currentTimetableData = newTimetable;
                    localStorage.setItem('customTimetableData', JSON.stringify(newTimetable));
                    alert(`성공: ${newTimetable.length}개의 데이터를 불러왔습니다. 클라우드에 저장하려면 아래 버튼을 눌러주세요.`);
                    renderTimetable('', true);
                }
            } catch (error) {
                console.error(error);
                alert('파일 처리 중 오류 발생');
            }
        };
        reader.readAsArrayBuffer(file);
    });

    // --- Supabase Cloud Sync Logic ---
    saveToCloudBtn.addEventListener('click', async () => {
        if (!supabase) {
            alert('Supabase 설정(URL/Key)이 완료되지 않았습니다. 코드를 확인해주세요.');
            return;
        }

        if (!confirm('현재 데이터를 클라우드 서버에 저장하시겠습니까?\n모든 기기에 즉시 반영됩니다.')) return;

        saveToCloudBtn.disabled = true;
        saveToCloudBtn.textContent = '⏳ 서버 저장 중...';
        syncStatus.textContent = '상태: 업로드 중...';

        try {
            const { error } = await supabase
                .from('timetable_data')
                .upsert({
                    id: 'latest',
                    content: currentTimetableData,
                    updated_at: new Date()
                });

            if (error) throw error;
            syncStatus.textContent = '상태: 동기화 완료! ✅';
            alert('🚀 클라우드 저장 성공! 이제 모든 기기에서 최신 정보를 볼 수 있습니다.');
        } catch (error) {
            console.error(error);
            syncStatus.textContent = '상태: 저장 실패 ❌';
            alert('저장 오류: ' + error.message);
        } finally {
            saveToCloudBtn.disabled = false;
            saveToCloudBtn.textContent = '🔄 클라우드 데이터 서버에 저장';
        }
    });

    function handleSearch(e) {
        if (!isLoggedIn) return;
        renderTimetable(e.target.value);
    }
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('compositionend', handleSearch);

    // Initial load
    updateAuthState();
    loadInitialData();

    // Committee logic
    const committeeSelect = document.getElementById('committeeSelect');
    function loadCommittees() {
        const committees = JSON.parse(localStorage.getItem('committees') || '[]');
        committees.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        committeeSelect.innerHTML = '<option value="">-- 위원회 선택 (전체보기) --</option>';
        committees.forEach(c => {
            const option = document.createElement('option');
            option.value = c.members;
            option.textContent = c.name;
            committeeSelect.appendChild(option);
        });
    }
    committeeSelect.addEventListener('change', (e) => {
        const searchString = e.target.value.replace(/[/,]/g, ' ');
        searchInput.value = searchString;
        renderTimetable(searchString);
    });
    loadCommittees();
});
