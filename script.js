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
    const committeeSelect = document.getElementById('committeeSelect');

    // --- Supabase Config ---
    const SUPABASE_URL = 'https://mwjuwzzipnwklxskocpb.supabase.co'; 
    const SUPABASE_KEY = 'sb_publishable_LLOkv1Fj-M-RV0IPq_9idQ_pD3OwgKP'; 
    
    let supabase = null;
    if (SUPABASE_URL && !SUPABASE_URL.includes('YOUR_PROJECT_URL')) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    // Auth state management
    let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    let currentTimetableData = window.timetableData || [];
    let committees = [];

    async function loadInitialData() {
        if (supabase) {
            try {
                // 1. Load Timetable
                const { data: tData } = await supabase
                    .from('timetable_data')
                    .select('content')
                    .eq('id', 'latest')
                    .single();
                
                if (tData && tData.content) {
                    currentTimetableData = tData.content;
                }

                // 2. Load Committees
                const { data: cData } = await supabase
                    .from('timetable_data')
                    .select('content')
                    .eq('id', 'committees')
                    .single();
                
                if (cData && cData.content) {
                    committees = cData.content;
                    localStorage.setItem('committees', JSON.stringify(committees));
                    renderCommittees();
                }
            } catch (e) {
                console.log("Using local fallback...");
                committees = JSON.parse(localStorage.getItem('committees') || '[]');
                renderCommittees();
            }
        }
        renderTimetable();
    }

    function renderCommittees() {
        committees.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        committeeSelect.innerHTML = '<option value="">-- 위원회 선택 (전체보기) --</option>';
        committees.forEach(c => {
            const option = document.createElement('option');
            option.value = c.members;
            option.textContent = c.name;
            committeeSelect.appendChild(option);
        });
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

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (usernameInput.value === 'admin' && passwordInput.value === '1234') {
            isLoggedIn = true;
            localStorage.setItem('isLoggedIn', 'true');
            updateAuthState();
            usernameInput.value = '';
            passwordInput.value = '';
        } else {
            loginError.textContent = '아이디 또는 비밀번호 오류';
        }
    });

    logoutBtn.addEventListener('click', () => {
        isLoggedIn = false;
        localStorage.removeItem('isLoggedIn');
        updateAuthState();
    });

    const days = ['월', '화', '수', '목', '금'];

    function getColor(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        const h = Math.abs(hash) % 360;
        return { bg: `hsl(${h}, 70%, 90%)`, text: `hsl(${h}, 70%, 25%)` };
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
            if (grayPeriods.includes(pNum)) tr.classList.add('gray-row');
            else if (pNum === '4교시') tr.classList.add('lunch-row');

            days.forEach(day => {
                const td = document.createElement('td');
                const names = row.days[day] || [];
                if (isLoggedIn && (queries.length > 0 || forceShow)) {
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'cell-content';
                    names.forEach(name => {
                        const isMatch = forceShow || queries.some(q => name.toLowerCase().includes(q));
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

    function handleSearch(e) { if (isLoggedIn) renderTimetable(e.target.value); }
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('compositionend', handleSearch);

    committeeSelect.addEventListener('change', (e) => {
        const searchString = e.target.value.replace(/[/,]/g, ' ');
        searchInput.value = searchString;
        renderTimetable(searchString);
    });

    updateAuthState();
    loadInitialData();
});
