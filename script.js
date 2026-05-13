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

    // --- Security Config ---
    const AUTH_CONFIG = {
        'admin': '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', // 1234
        'hansei': 'df4d0c661c72e8ff36353496b02593298c6a4d15b319b66037e8adf3d92f2219' // axgurtls
    };

    async function hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // --- Supabase Config (SDK 없이 fetch() 로 직접 REST API 호출) ---
    const SUPABASE_URL = 'https://mwjuwzzipnwklxskocpb.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_LLOkv1Fj-M-RV0IPq_9idQ_pD3OwgKP';

    // Auth state management
    let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    let currentTimetableData = window.timetableData || [];
    let committees = [];

    // Supabase REST API helper (SDK 없이 fetch 사용)
    async function supabaseFetch(table, filter) {
        const url = `${SUPABASE_URL}/rest/v1/${table}?${filter}&select=content`;
        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) throw new Error(`Supabase fetch error: ${res.status}`);
        const data = await res.json();
        return data.length > 0 ? data[0] : null;
    }

    async function loadInitialData() {
        try {
            // 1. Load Timetable
            const tData = await supabaseFetch('timetable_data', 'id=eq.latest');
            if (tData && tData.content) {
                currentTimetableData = tData.content;
            }

            // 2. Load Committees
            const cData = await supabaseFetch('timetable_data', 'id=eq.committees');
            if (cData && cData.content) {
                committees = cData.content;
                if (isLoggedIn) {
                    localStorage.setItem('committees', JSON.stringify(committees));
                }
                renderCommittees();
            }
        } catch (e) {
            console.warn('Supabase 데이터 로드 실패, 로컬 캐시 사용:', e.message);
            if (isLoggedIn) {
                committees = JSON.parse(localStorage.getItem('committees') || '[]');
                renderCommittees();
            }
        }
        renderTimetable();
    }

    function renderCommittees() {
        if (!isLoggedIn) return;
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
        if (!isLoggedIn) return;
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
        if (!isLoggedIn) return;
        e.stopPropagation();
        committeeSelectContainer.classList.toggle('open');
    });

    // Close on outside click
    document.addEventListener('click', () => {
        committeeSelectContainer.classList.remove('open');
    });

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
            committeeOptions.innerHTML = '';
            selectTrigger.textContent = '-- 위원회 선택 (전체보기) --';
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = usernameInput.value;
        const pass = passwordInput.value;
        const hashedPass = await hashPassword(pass);

        if (AUTH_CONFIG[user] && AUTH_CONFIG[user] === hashedPass) {
            isLoggedIn = true;
            localStorage.setItem('isLoggedIn', 'true');
            updateAuthState();
            loadInitialData(); // Reload data after login
            usernameInput.value = '';
            passwordInput.value = '';
        } else {
            loginError.textContent = '아이디 또는 비밀번호 오류';
        }
    });

    logoutBtn.addEventListener('click', () => {
        isLoggedIn = false;
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('committees');
        localStorage.removeItem('customTimetableData');
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

    updateAuthState();
    loadInitialData();
});
