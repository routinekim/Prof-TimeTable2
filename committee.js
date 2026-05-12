document.addEventListener('DOMContentLoaded', () => {
    const committeeList = document.getElementById('committeeList');
    const nameInput = document.getElementById('committeeNameInput');
    const addBtn = document.getElementById('addCommitteeBtn');

    // Load data from localStorage
    let committees = JSON.parse(localStorage.getItem('committees') || '[]');

    function save() {
        localStorage.setItem('committees', JSON.stringify(committees));
    }

    function render() {
        committeeList.innerHTML = '';
        
        // Sort alphabetically (가나다순)
        committees.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

        committees.forEach((committee, index) => {
            const card = document.createElement('div');
            card.className = 'committee-card';
            
            // Generate tags for members
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

    // Support Enter key for adding
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addBtn.click();
        }
    });

    window.deleteCommittee = (index) => {
        if (confirm('이 위원회를 삭제하시겠습니까?')) {
            committees.splice(index, 1);
            save();
            render();
        }
    };

    window.updateMembers = (index, value) => {
        // 1. Update data and save
        committees[index].members = value;
        save();
        
        // 2. Only update the tags area for this specific card to preserve focus
        const tagsContainer = document.getElementById(`tags-${index}`);
        if (tagsContainer) {
            const members = value.split(/[\/, ]+/).filter(m => m.trim());
            const tagsHtml = members.map(m => `<span class="member-tag">${m}</span>`).join('');
            tagsContainer.innerHTML = tagsHtml || '<span style="color:#94a3b8; font-size:0.8rem;">멤버를 추가해주세요</span>';
        }
    };

    render();
});
