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

    // Auth state management
    let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    // Use a flexible variable for data (const in data.js cannot be reassigned)
    let currentTimetableData = window.timetableData;

    // Load persistent data if exists
    const savedData = localStorage.getItem('customTimetableData');
    if (savedData) {
        try {
            currentTimetableData = JSON.parse(savedData);
        } catch(e) {
            console.error("Saved data parse error", e);
        }
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
            searchInput.value = ''; // Clear search on logout
            renderTimetable(''); // Reset timetable
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

    // Days to iterate through
    const days = ['월', '화', '수', '목', '금'];

    // Generate a deterministic color based on the instructor's name
    function getColor(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Use the hash to get a HUE value (0-360)
        const h = Math.abs(hash) % 360;
        return {
            bg: `hsl(${h}, 70%, 90%)`,
            text: `hsl(${h}, 70%, 25%)`
        };
    }

    // Initial render
    function renderTimetable(searchQuery = '', forceShow = false) {
        timetableBody.innerHTML = '';
        const trimmedQuery = searchQuery.trim();
        
        // Split query by comma or whitespace, filter out empty strings
        const queries = trimmedQuery.toLowerCase().split(/[,\s]+/).filter(q => q.length > 0);

        currentTimetableData.forEach(row => {
            const tr = document.createElement('tr');
            
            // Period Cell
            const periodTd = document.createElement('td');
            periodTd.className = 'period-cell';
            
            // Clean up repeated period text (e.g., "0교시(08:00),0교시(08:00)...")
            let periodRaw = (row.period || "").toString().trim();
            if (periodRaw.includes(',')) {
                const parts = periodRaw.split(',').map(s => s.trim()).filter(s => s);
                periodRaw = parts[parts.length - 1]; // Take the last one as requested
            }

            // Extract "X교시" and "(Time)" from "X교시(Time)"
            const match = periodRaw.match(/(.*)(\(.*\))/);
            let pNum = periodRaw;
            let pTime = "";
            if (match) {
                pNum = match[1].trim(); // e.g. "0교시"
                pTime = match[2].trim(); // e.g. "(08:00)"
            }
            
            periodTd.innerHTML = `<div class="p-num">${pNum}</div><div class="p-time">${pTime}</div>`;
            tr.appendChild(periodTd);

            // Add classes for row styling
            const grayPeriods = ['0교시', '2교시', '6교시', '8교시', '10교시', '12교시', '14교시'];
            if (grayPeriods.includes(pNum)) {
                tr.classList.add('gray-row');
            } else if (pNum === '4교시') {
                tr.classList.add('lunch-row');
            }

            // Day Cells
            days.forEach(day => {
                const td = document.createElement('td');
                const names = row.days[day] || [];
                
                // Only process names if there is a search query OR forceShow is true
                if (isLoggedIn && (queries.length > 0 || forceShow)) {
                    // Create a wrapper for grid layout
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'cell-content';

                    names.forEach(name => {
                        const nameLower = name.toLowerCase();
                        // If forceShow is true, show everyone, otherwise filter by query
                        const isMatch = forceShow || queries.some(q => nameLower.includes(q));
                        
                        if (isMatch) {
                            const span = document.createElement('span');
                            span.className = 'name-tag active';
                            span.textContent = name;
                            
                            // Apply custom colors
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

    // Excel Upload Handler
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
                
                // Convert sheet to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // Parse the Excel structure to our format
                // Assuming Header: [시간, 월, 화, 수, 목, 금, 토, 일]
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
                    alert(`성공: ${newTimetable.length}개의 시간표 데이터를 업데이트했습니다!`);
                    // Show the updated result immediately
                    renderTimetable('', true); 
                } else {
                    alert('엑셀 파일에서 유효한 데이터를 찾을 수 없습니다. 형식을 확인해주세요.');
                }
            } catch (error) {
                console.error(error);
                alert('파일 처리 중 오류가 발생했습니다: ' + error.message);
            }
        };
        reader.readAsArrayBuffer(file);
    });

    // Event Listener for Search
    function handleSearch(e) {
        if (!isLoggedIn) return;
        renderTimetable(e.target.value);
    }

    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('compositionend', handleSearch); // Support for mobile Korean input

    // Initialize Auth state
    updateAuthState();
    
    // Committee Dropdown logic
    const committeeSelect = document.getElementById('committeeSelect');
    
    function loadCommittees() {
        const committees = JSON.parse(localStorage.getItem('committees') || '[]');
        
        // Sort alphabetically (가나다순)
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
        const members = e.target.value;
        const searchString = members.replace(/[/,]/g, ' ');
        searchInput.value = searchString;
        renderTimetable(searchString);
    });

    loadCommittees();
    
    // Initial render with empty search
    renderTimetable();
});
