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
    const committeeSelectContainer = document.getElementById('committeeSelectContainer');
    const selectTrigger = document.getElementById('selectTrigger');
    const committeeOptions = document.getElementById('committeeOptions');

    // --- Supabase Config ---
    const SUPABASE_URL = 'https://mwjuwzzipnwklxskocpb.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_LLOkv1Fj-M-RV0IPq_9idQ_pD3OwgKP';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Auth state management
    let currentSession = null;
    let currentTimetableData = window.timetableData || [];
    let committees = [];

    async function checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        currentSession = session;
        updateAuthState();
        if (currentSession) {
            loadInitialData();
        }
    }

    // Supabase helper using SDK
    async function loadInitialData() {
        try {
            // 1. Load Timetable
            const { data: tData, error: tError } = await supabase
                .from('timetable_data')
                .select('content')
                .eq('id', 'latest')
                .single();
            
            if (tError) throw tError;
            if (tData && tData.content) {
                currentTimetableData = tData.content;
            }

            // 2. Load Committees
            const { data: cData, error: cError } = await supabase
                .from('timetable_data')
                .select('content')
                .eq('id', 'committees')
                .single();
            
            if (cError) throw cError;
            if (cData && cData.content) {
                committees = cData.content;
                sessionStorage.setItem('committees', JSON.stringify(committees));
                renderCommittees();
            }
        } catch (e) {
            console.warn('Supabase 데이터 로드 실패, 세션 캐시 확인:', e.message);
            if (currentSession) {
                committees = JSON.parse(sessionStorage.getItem('committees') || '[]');
                renderCommittees();
            }
        }
        renderTimetable();
    }

    function renderCommittees() {
        if (!currentSession) return;
        committees.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        committeeOptions.innerHTML = '';

        // Add "All" option
        const allOption = document.createElement('div');
        allOption.className = 'select-option active';
        allOption.textContent = '-- 위원회 선택 (전체보기) --';
        allOption.onclick = () => selectCommittee('', '-- 위원회 선택 (전체보기) --', allOption);
        committeeOptions.appendChild(allOption);

        committees.forEach(c => {
            const option = document.createElement('div');
            option.className = 'select-option';
            option.textContent = c.name;
            option.onclick = () => selectCommittee(c.members, c.name, option);
            committeeOptions.appendChild(option);
        });
    }

    function selectCommittee(members, name, element) {
        if (!currentSession) return;
        // Update UI
        document.querySelectorAll('.select-option').forEach(opt => opt.classList.remove('active'));
        element.classList.add('active');
        selectTrigger.textContent = name;
        committeeSelectContainer.classList.remove('open');

        // Trigger search
        const searchString = (members || '').replace(/[/,]/g, ' ');
        searchInput.value = searchString;
        renderTimetable(searchString);
    }

    // Toggle dropdown
    selectTrigger.addEventListener('click', (e) => {
        if (!currentSession) return;
        e.stopPropagation();
        committeeSelectContainer.classList.toggle('open');
    });

    // Close on outside click
    document.addEventListener('click', () => {
        committeeSelectContainer.classList.remove('open');
    });

    function updateAuthState() {
        if (currentSession) {
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
            committeeOptions.innerHTML = '';
            selectTrigger.textContent = '-- 위원회 선택 (전체보기) --';
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = usernameInput.value;
        const pass = passwordInput.value;
        
        // Use email format for Supabase Auth as per plan
        const email = user.includes('@') ? user : `${user}@hansei.ac.kr`;

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: pass
        });

        if (error) {
            loginError.textContent = '아이디 또는 비밀번호 오류';
            console.error('Auth error:', error.message);
        } else {
            currentSession = data.session;
            updateAuthState();
            loadInitialData();
            usernameInput.value = '';
            passwordInput.value = '';
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        currentSession = null;
        sessionStorage.clear();
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
                if (currentSession && (queries.length > 0 || forceShow)) {
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

    function handleSearch(e) { if (currentSession) renderTimetable(e.target.value); }
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('compositionend', handleSearch);

    checkAuth(); // Check auth on startup
});
