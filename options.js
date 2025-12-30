(function() {
    'use strict';

    const STORAGE_KEY = 'chatgpttoolkit.customPrompts';
    let customPrompts = [];
    let editingIndex = -1;

    // DOM Elements
    const promptsList = document.getElementById('promptsList');
    const addPromptBtn = document.getElementById('addPromptBtn');
    const importBtn = document.getElementById('importBtn');
    const exportBtn = document.getElementById('exportBtn');
    const resetBtn = document.getElementById('resetBtn');
    const statusMessage = document.getElementById('statusMessage');

    // Modal Elements
    const promptModal = document.getElementById('promptModal');
    const modalTitle = document.getElementById('modalTitle');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const promptForm = document.getElementById('promptForm');

    // Form Elements
    const promptEnabled = document.getElementById('promptEnabled');
    const promptInitial = document.getElementById('promptInitial');
    const promptIcon = document.getElementById('promptIcon');
    const promptTitle = document.getElementById('promptTitle');
    const promptAltText = document.getElementById('promptAltText');
    const promptText = document.getElementById('promptText');
    const promptAutoPaste = document.getElementById('promptAutoPaste');
    const promptAutoSubmit = document.getElementById('promptAutoSubmit');

    // Import Modal Elements
    const importModal = document.getElementById('importModal');
    const closeImportModalBtn = document.getElementById('closeImportModalBtn');
    const cancelImportBtn = document.getElementById('cancelImportBtn');
    const confirmImportBtn = document.getElementById('confirmImportBtn');
    const importText = document.getElementById('importText');

    // Initialize
    function init() {
        loadPrompts();
        renderPrompts();
        attachEventListeners();
    }

    // Load prompts from localStorage
    function loadPrompts() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                customPrompts = JSON.parse(stored);
            } catch (e) {
                console.error('Failed to parse stored prompts:', e);
                customPrompts = [];
            }
        } else {
            customPrompts = [];
        }
    }

    // Save prompts to localStorage
    function savePrompts() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(customPrompts));
            showStatus('儲存成功！', 'success');
            return true;
        } catch (e) {
            console.error('Failed to save prompts:', e);
            showStatus('儲存失敗：' + e.message, 'error');
            return false;
        }
    }

    // Show status message
    function showStatus(message, type = 'success') {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message active ' + type;
        setTimeout(() => {
            statusMessage.classList.remove('active');
        }, 3000);
    }

    // Render all prompts
    function renderPrompts() {
        if (customPrompts.length === 0) {
            promptsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-text">尚未建立任何自訂提示</div>
                    <button onclick="document.getElementById('addPromptBtn').click()">建立第一個提示</button>
                </div>
            `;
            return;
        }

        promptsList.innerHTML = '';
        customPrompts.forEach((prompt, index) => {
            const promptElement = createPromptElement(prompt, index);
            promptsList.appendChild(promptElement);
        });
    }

    // Create a single prompt element
    function createPromptElement(prompt, index) {
        const div = document.createElement('div');
        div.className = 'prompt-item';

        const isInitial = prompt.hasOwnProperty('initial') ? prompt.initial : false;
        const isEnabled = prompt.hasOwnProperty('enabled') ? prompt.enabled : true;
        const hasAutoPaste = prompt.hasOwnProperty('autoPaste') ? prompt.autoPaste : false;
        const hasAutoSubmit = prompt.hasOwnProperty('autoSubmit') ? prompt.autoSubmit : false;

        let badges = [];
        badges.push(`<span class="badge ${isEnabled ? 'enabled' : 'disabled'}">${isEnabled ? '已啟用' : '已停用'}</span>`);
        badges.push(`<span class="badge ${isInitial ? 'initial' : 'follow-up'}">${isInitial ? '初始按鈕' : '後續按鈕'}</span>`);
        if (hasAutoSubmit) badges.push(`<span class="badge auto-submit">自動送出</span>`);
        if (hasAutoPaste) badges.push(`<span class="badge auto-paste">自動貼上</span>`);

        div.innerHTML = `
            <div class="prompt-header">
                <div class="prompt-icon">${prompt.svgIcon || '📝'}</div>
                <div class="prompt-title">${escapeHtml(prompt.title || '(無標題)')}</div>
                <div class="prompt-badges">
                    ${badges.join('')}
                </div>
            </div>
            <div class="prompt-content">
                ${prompt.altText ? `
                    <div class="prompt-field">
                        <label>提示文字:</label>
                        <span class="prompt-field-value">${escapeHtml(prompt.altText)}</span>
                    </div>
                ` : ''}
                <div class="prompt-field">
                    <label>提示內容:</label>
                    <div class="prompt-text">${escapeHtml(prompt.prompt || '')}</div>
                </div>
            </div>
            <div class="prompt-actions">
                <button onclick="optionsPage.editPrompt(${index})">✏️ 編輯</button>
                <button onclick="optionsPage.togglePrompt(${index})" class="secondary">
                    ${isEnabled ? '🚫 停用' : '✅ 啟用'}
                </button>
                <button onclick="optionsPage.moveUp(${index})" class="secondary" ${index === 0 ? 'disabled' : ''}>⬆️ 上移</button>
                <button onclick="optionsPage.moveDown(${index})" class="secondary" ${index === customPrompts.length - 1 ? 'disabled' : ''}>⬇️ 下移</button>
                <button onclick="optionsPage.deletePrompt(${index})" class="danger">🗑️ 刪除</button>
            </div>
        `;

        return div;
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Open modal for adding new prompt
    function openAddModal() {
        editingIndex = -1;
        modalTitle.textContent = '新增提示';
        resetForm();
        promptModal.classList.add('active');
    }

    // Open modal for editing existing prompt
    function editPrompt(index) {
        editingIndex = index;
        modalTitle.textContent = '編輯提示';
        const prompt = customPrompts[index];

        promptEnabled.checked = prompt.hasOwnProperty('enabled') ? prompt.enabled : true;
        promptInitial.checked = prompt.hasOwnProperty('initial') ? prompt.initial : false;
        promptIcon.value = prompt.svgIcon || '';
        promptTitle.value = prompt.title || '';
        promptAltText.value = prompt.altText || '';
        promptText.value = prompt.prompt || '';
        promptAutoPaste.checked = prompt.hasOwnProperty('autoPaste') ? prompt.autoPaste : false;
        promptAutoSubmit.checked = prompt.hasOwnProperty('autoSubmit') ? prompt.autoSubmit : false;

        promptModal.classList.add('active');
    }

    // Reset form
    function resetForm() {
        promptForm.reset();
        promptEnabled.checked = true;
        promptInitial.checked = false;
        promptAutoPaste.checked = false;
        promptAutoSubmit.checked = false;
    }

    // Close modal
    function closeModal() {
        promptModal.classList.remove('active');
        resetForm();
    }

    // Save prompt from form
    function savePromptFromForm(event) {
        event.preventDefault();

        const newPrompt = {
            enabled: promptEnabled.checked,
            title: promptTitle.value.trim(),
            prompt: promptText.value
        };

        // Only add optional fields if they have values or are checked
        if (promptInitial.checked) {
            newPrompt.initial = true;
        }

        if (promptIcon.value.trim()) {
            newPrompt.svgIcon = promptIcon.value.trim();
        }

        if (promptAltText.value.trim()) {
            newPrompt.altText = promptAltText.value.trim();
        }

        if (promptAutoPaste.checked) {
            newPrompt.autoPaste = true;
        }

        if (promptAutoSubmit.checked) {
            newPrompt.autoSubmit = true;
        }

        if (editingIndex === -1) {
            // Adding new prompt
            customPrompts.push(newPrompt);
        } else {
            // Editing existing prompt
            customPrompts[editingIndex] = newPrompt;
        }

        if (savePrompts()) {
            renderPrompts();
            closeModal();
        }
    }

    // Toggle prompt enabled/disabled
    function togglePrompt(index) {
        if (customPrompts[index]) {
            customPrompts[index].enabled = !customPrompts[index].enabled;
            savePrompts();
            renderPrompts();
        }
    }

    // Delete prompt
    function deletePrompt(index) {
        if (confirm('確定要刪除此提示嗎？')) {
            customPrompts.splice(index, 1);
            savePrompts();
            renderPrompts();
        }
    }

    // Move prompt up
    function moveUp(index) {
        if (index > 0) {
            [customPrompts[index - 1], customPrompts[index]] = [customPrompts[index], customPrompts[index - 1]];
            savePrompts();
            renderPrompts();
        }
    }

    // Move prompt down
    function moveDown(index) {
        if (index < customPrompts.length - 1) {
            [customPrompts[index], customPrompts[index + 1]] = [customPrompts[index + 1], customPrompts[index]];
            savePrompts();
            renderPrompts();
        }
    }

    // Export prompts
    function exportPrompts() {
        const dataStr = JSON.stringify(customPrompts, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'chatgpt-toolkit-prompts.json';
        link.click();
        URL.revokeObjectURL(url);
        showStatus('匯出成功！', 'success');
    }

    // Open import modal
    function openImportModal() {
        importText.value = '';
        importModal.classList.add('active');
    }

    // Close import modal
    function closeImportModal() {
        importModal.classList.remove('active');
        importText.value = '';
    }

    // Import prompts
    function importPrompts() {
        try {
            const imported = JSON.parse(importText.value);
            if (!Array.isArray(imported)) {
                throw new Error('匯入的資料必須是陣列格式');
            }

            // Validate that each item has at least title and prompt
            for (const item of imported) {
                if (!item.title || !item.prompt) {
                    throw new Error('每個提示必須包含 title 和 prompt 欄位');
                }
            }

            if (confirm(`確定要匯入 ${imported.length} 個提示嗎？這會覆蓋現有的設定。`)) {
                customPrompts = imported;
                savePrompts();
                renderPrompts();
                closeImportModal();
            }
        } catch (e) {
            showStatus('匯入失敗：' + e.message, 'error');
        }
    }

    // Reset to default prompts
    function resetToDefaults() {
        if (!confirm('確定要重置為預設值嗎？這會清除所有自訂提示。')) {
            return;
        }

        // Load default prompts from CUSTOM_PROMPTS.js structure
        const defaultPrompts = [
            {
                "enabled": true,
                "initial": true,
                "svgIcon": "📝",
                "title": "記事",
                "altText": "用來記錄手邊的筆記，但不需要 ChatGPT 回答。",
                "prompt": "除非我詢問你問題，否則請回答我 OK 即可",
                "autoSubmit": true
            },
            {
                "enabled": true,
                "initial": true,
                "svgIcon": "🍥",
                "title": "總結",
                "altText": "用來總結輸入的大量文字",
                "prompt": "Please identify the main discussion points, decisions, and action items from my text below and provide a concise bulleted summary in #zh-tw:\n\n",
                "autoPaste": true,
                "autoSubmit": true
            },
            {
                "enabled": true,
                "initial": true,
                "svgIcon": "👩‍🏫",
                "title": "解釋",
                "altText": "解釋某個名詞、概念或程式碼",
                "prompt": "請詳加解釋以下內容:\r\n\r\n",
                "autoPaste": true,
                "autoSubmit": false
            },
            {
                "enabled": true,
                "initial": true,
                "svgIcon": "📚",
                "title": "翻成中文",
                "altText": "翻譯內容為中文",
                "prompt": "翻譯以下內容為正體中文:\r\n\r\n",
                "autoPaste": true,
                "autoSubmit": false
            },
            {
                "enabled": true,
                "initial": true,
                "svgIcon": "📚",
                "title": "翻為英文",
                "altText": "翻譯內容為英文",
                "prompt": "翻譯以下內容為英文:\r\n\r\n",
                "autoPaste": true,
                "autoSubmit": false
            },
            {
                "enabled": true,
                "title": "記事",
                "altText": "用來記錄手邊的筆記，但不需要 ChatGPT 回答。",
                "prompt": "請幫我記錄以下內容，僅需回答我 OK 即可：\r\n\r\n",
                "autoSubmit": false
            },
            {
                "enabled": true,
                "title": "繼續",
                "altText": "如果你覺得這個對話尚未完成，可以按下繼續。",
                "prompt": "繼續",
                "autoSubmit": true
            },
            {
                "enabled": true,
                "title": "品質",
                "altText": "有時候 ChatGPT 會回答出錯誤、不合邏輯的答案，透過重新審視答案，可以大幅提昇回應品質，提高正確率。",
                "prompt": "你確定你的回答是正確的嗎？請再釐清一次我的問題，重新審視一次你的回答，然後重新回答我。",
                "autoSubmit": true
            },
            {
                "enabled": true,
                "title": "總結",
                "prompt": "請將我們剛剛的對話總結為一個清單，讓我可以更快的掌握重點。",
                "autoSubmit": true
            },
            {
                "enabled": true,
                "title": "反思",
                "altText": "反思翻譯的過程，提供更多的想法與翻譯建議。這個步驟可能不只一遍。",
                "prompt": "請仔細審視你的翻譯結果，指出其中不符合中文表達習慣、不通順、不夠信雅達的地方，給我一個專業的翻譯建議。",
                "autoSubmit": true
            },
            {
                "enabled": true,
                "title": "重翻",
                "altText": "基於反思與討論翻譯的討論過程，進行一次重新翻譯",
                "prompt": "請基於上面的審視結果，對當初的原文進行重新翻譯，務必做到信、雅、達的境界",
                "autoSubmit": true
            },
            {
                "enabled": true,
                "title": "翻中",
                "altText": "將上述內容翻譯為中文",
                "prompt": "將上述內容翻譯為正體中文",
                "autoSubmit": true
            },
            {
                "enabled": true,
                "title": "翻英",
                "altText": "Please translate the message into English",
                "prompt": "Please translate the message into English",
                "autoSubmit": true
            },
            {
                "enabled": true,
                "title": "臉書",
                "altText": "撰寫臉書貼文",
                "prompt": "請將上述內容整理成一段用來分享到臉書的文案，內容要以記者的角度來報導這些內容，擷取精華的知識，並且分享給粉絲們，語氣上要輕鬆自在，適當的幽默更好。",
                "autoSubmit": true
            },
            {
                "enabled": true,
                "title": "短點",
                "altText": "將內容縮少一點",
                "prompt": "再寫少一點文字",
                "autoSubmit": true
            },
            {
                "enabled": true,
                "title": "長點",
                "altText": "將內容多寫一點",
                "prompt": "再寫多一點文字",
                "autoSubmit": true
            },
            {
                "enabled": true,
                "title": "重寫",
                "altText": "換個語氣重寫文案",
                "prompt": "請隨意換個語氣重寫文案",
                "autoSubmit": true
            },
            {
                "enabled": true,
                "title": "心智圖(markmap)",
                "altText": "依據上述內容生成一份 markmap 格式的心智圖",
                "prompt": "請幫我依據上述內容生成一份心智圖的結構，並用 Markdown 格式輸出，最後將內容放入 markdown code fence，最後提供 https://markmap.js.org/repl 這個網址讓我可以快速預覽結果",
                "autoSubmit": true
            }
        ];

        customPrompts = defaultPrompts;
        savePrompts();
        renderPrompts();
        showStatus('已重置為預設值', 'success');
    }

    // Attach event listeners
    function attachEventListeners() {
        addPromptBtn.addEventListener('click', openAddModal);
        importBtn.addEventListener('click', openImportModal);
        exportBtn.addEventListener('click', exportPrompts);
        resetBtn.addEventListener('click', resetToDefaults);

        closeModalBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        promptForm.addEventListener('submit', savePromptFromForm);

        closeImportModalBtn.addEventListener('click', closeImportModal);
        cancelImportBtn.addEventListener('click', closeImportModal);
        confirmImportBtn.addEventListener('click', importPrompts);

        // Close modal when clicking outside
        promptModal.addEventListener('click', (e) => {
            if (e.target === promptModal) {
                closeModal();
            }
        });

        importModal.addEventListener('click', (e) => {
            if (e.target === importModal) {
                closeImportModal();
            }
        });
    }

    // Expose functions to global scope for inline event handlers
    window.optionsPage = {
        editPrompt,
        togglePrompt,
        deletePrompt,
        moveUp,
        moveDown
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
