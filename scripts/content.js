(function () {
    "use strict";

    // Test case:
    // I+B = C&D
    // https://www.phind.com/search?home=true#autoSubmit=false&prompt=I%2BB+%3D+C%26D
    // https://www.phind.com/search?home=true#prompt=I%2BB+%3D+C%26D&autoSubmit=false
    // https://claude.ai/#autoSubmit=true&prompt=I+B%20=%20C&D
    // https://claude.ai/#prompt=I+B%20=%20C&D&autoSubmit=true
    let debug = true;

    // scripts/content-utils.js 需要在 content.js 之前載入（已在 manifest.json 中排序）。
    // 這樣可以把純邏輯抽離出來，讓專案可以用 Node 跑單元測試。
    const ContentUtils = window.ChatGPTToolkitContentUtils;
    if (!ContentUtils) {
        console.error('[ChatGPTToolkit] Missing ChatGPTToolkitContentUtils; check manifest.json script order.');
        return;
    }

    function b64EncodeUnicode(str) {
        // NOTE: 為了讓這些純邏輯能寫單元測試，已抽到 scripts/content-utils.js
        // 這裡保留原本函式名稱，避免重構時不小心改到呼叫點。
        return ContentUtils.b64EncodeUnicode(str);
    }

    function isBase64Unicode(str) {
        // Base64編碼後的字串僅包含 A-Z、a-z、0-9、+、/、= 這些字元
        //
        // 解碼後的字串應該是合法的 UTF-8 序列
        // 使用 TextDecoder 檢查是否可以成功解碼為 Unicode 字串
        //
        // NOTE: 判斷/解碼細節已抽到 scripts/content-utils.js（可單元測試），這裡保留註解與介面。
        return ContentUtils.isBase64Unicode(str);
    }

    function b64DecodeUnicode(str) {
        // NOTE: scripts/content-utils.js 的版本會回傳「解碼後的字串」（可能是空字串）。
        // 原始版本會印出 decoded 並在空字串時 fallback 回傳原始 str，所以這裡保留同樣行為。
        const decoded = ContentUtils.b64DecodeUnicode(str);
        if (debug) console.log('decoded:', decoded, 'decoded length', decoded?.length);
        return (!!decoded && decoded.length > 0) ? decoded : str;
    }

    // 取得 URI 查詢字串中的參數值
    function getUriComponent(segment, name) {
        return ContentUtils.getUriComponent(segment, name);
    }

    // 為了相容於一開始的設計，怕使用者傳入不合格式的 prompt 內容，所以要特殊處理
    function flexiblePromptDetection(hash) {
        // 找到 prompt= 的位置 (假設 prompt 參數總是在最後一位)
        //
        // 因為 Chrome 的 Site search 在使用者輸入 %s 內容時，會自動判斷要用哪一種編碼方式
        // 如果有 Query String 的話，他會自動用 encodeURIComponent 進行編碼
        // 如果沒有 Query String 的話，他會自動用 encodeURI 進行編碼。
        // 這個 encodeURI 方法不會對某些保留的字元進行編碼，例如 ";", "/", "?", ":", "@", "&", "=", "+", "$", 和 "#"。
        // 因此我們要特別處理這個狀況！
        //
        // NOTE: 為了可測試性，prompt parsing 已抽到 scripts/content-utils.js。
        // 這裡保留原函式名稱，但行為一致：會依 location.search 來處理 encodeURI/encodeURIComponent 的差異。
        return ContentUtils.flexiblePromptDetection(hash, location.search);
    }

    // ---------------------------------------------------------------------
    // Shared / reusable helpers (避免各站重複邏輯)
    // ---------------------------------------------------------------------

    // 將多行文字填入 contentEditable 容器：每一行建立一個 <p>，確保換行呈現一致。
    function fillContentEditableWithParagraphs(target, text) {
        if (!target) return;
        const lines = (text || '').split('\n');
        target.innerHTML = '';
        lines.forEach(line => {
            const paragraph = document.createElement('p');
            paragraph.innerText = line;
            target.appendChild(paragraph);
        });
    }

    // 將文字填入 <textarea> 並觸發 input，讓網站框架能收到變更通知。
    function fillTextareaAndDispatchInput(textarea, text) {
        if (!textarea) return;
        textarea.value = text;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }

    /**
     * 通用輪詢器：固定間隔檢查 DOM，直到 tick() 回傳 true 或重試耗盡。
     * - tick 允許是 async (例如需要等待剪貼簿讀取或延遲)。
     * - 這個 helper 只負責「何時停」，不改變各站的 DOM 操作細節。
     */
    function startRetryInterval({ intervalMs = 500, retries = 10, tick }) {
        let remaining = retries;
        const ti = setInterval(async () => {
            try {
                const shouldStop = await tick();
                if (shouldStop) {
                    clearInterval(ti);
                    return;
                }
            } catch (e) {
                // 保持原本的「失敗就繼續重試」特性，避免單次例外讓整個 interval 掛掉。
            }

            remaining--;
            if (remaining <= 0) {
                clearInterval(ti);
            }
        }, intervalMs);
        return ti;
    }

    // ---------------------------------------------------------------------
    // Feature Toggle Settings
    // ---------------------------------------------------------------------
    let featureToggles = {
        autoFill: true,           // Default: enabled
        customPrompts: true,      // Default: enabled
        doubleClickEdit: true,    // Default: enabled
        autoContinue: true,       // Default: enabled
        markmap: true,            // Default: enabled
        ctrlEnter: true           // Default: enabled
    };

    // Feature toggle mapping for storage keys
    const FEATURE_TOGGLE_KEYS = {
        autoFill: 'chatgpttoolkit.featureToggle.autoFill',
        customPrompts: 'chatgpttoolkit.featureToggle.customPrompts',
        doubleClickEdit: 'chatgpttoolkit.featureToggle.doubleClickEdit',
        autoContinue: 'chatgpttoolkit.featureToggle.autoContinue',
        markmap: 'chatgpttoolkit.featureToggle.markmap',
        ctrlEnter: 'chatgpttoolkit.featureToggle.ctrlEnter'
    };

    // Load feature toggles from chrome.storage.sync
    // This is async, but we set defaults first for immediate execution
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        const storageKeys = Object.values(FEATURE_TOGGLE_KEYS);
        chrome.storage.sync.get(storageKeys, (items) => {
            // Update feature toggles with stored values (if they exist)
            Object.keys(FEATURE_TOGGLE_KEYS).forEach(feature => {
                const storageKey = FEATURE_TOGGLE_KEYS[feature];
                if (items.hasOwnProperty(storageKey)) {
                    featureToggles[feature] = items[storageKey];
                }
            });
            if (debug) console.log('[ChatGPTToolkit] Feature toggles loaded:', featureToggles);
        });
    }

    let prompt = '';
    let autoSubmit = false;
    let pasteImage = false;
    let tool = '';
    let pastingImage = false;

    const getParamsFromHash = () => {
        // 解析 hash 中的查詢字串並取得所需的參數
        let hash = location.hash.substring(1);
        if (!hash) return [null, false, false];

        if (debug) console.log('hash: ', hash);

        // NOTE: 這段邏輯會被多個站點共用，因此抽到 scripts/content-utils.js 方便單元測試。
        // 這裡仍維持「把結果寫回 prompt/autoSubmit/pasteImage/tool 這些 closure 變數」的行為。
        const parsed = ContentUtils.parseToolkitHash(hash, location.search);
        prompt = parsed.prompt;
        autoSubmit = parsed.autoSubmit;
        pasteImage = parsed.pasteImage;
        tool = parsed.tool;

        if (debug) console.log('prompt: ', prompt);
        if (debug) console.log('autoSubmit: ', autoSubmit);
        if (debug) console.log('pasteImage: ', pasteImage);
        if (debug) console.log('tool: ', tool);

        // 沒有 prompt 也沒有 tool 就不處理了
        if (!prompt && !tool) {
            return [null, false, false];
        }

        return [prompt, autoSubmit, pasteImage];
    };

    const clearHash = () => {
        if (history.replaceState) {
            history.replaceState(null, document.title, window.location.pathname + window.location.search);
        } else {
            window.location.hash = '';
        }
    };

    // ---------------------------------------------------------------------
    // Site: Gemini (gemini.google.com)
    // - 支援: AutoFill / AutoSubmit / pasteImage / tool=image
    // ---------------------------------------------------------------------
    if (location.hostname === 'gemini.google.com') {
        // Check if autoFill feature is enabled
        if (!featureToggles.autoFill) {
            if (debug) console.log('[ChatGPTToolkit] AutoFill feature is disabled for Gemini');
            // Don't return here - continue to other features
        } else {
            getParamsFromHash();
            if (!prompt && !tool) return;

        let toolImageClicked = false;
        let promptFilled = false;
        let pastingGeminiImage = false;
        let geminiImagePasteAttempted = false;
        let submitted = false;

        const tryClickImageToolButton = () => {
            if (toolImageClicked) return;
            if (tool !== 'image') return;

            const buttons = [...document.querySelectorAll('button')];
            for (const button of buttons) {
                const textContent = (button.textContent || '').replace(/\s+/g, ' ').trim();
                if (!textContent) continue;

                const isMatch =
                    textContent.includes('生成圖片') ||
                    textContent.toLowerCase().includes('create image');

                if (!isMatch) continue;
                if (button.disabled) continue;

                toolImageClicked = true;
                button.focus();
                button.click();
                return;
            }
        };

        startRetryInterval({
            intervalMs: 500,
            retries: 30,
            tick: async () => {
                tryClickImageToolButton();

                const textarea = document.querySelector('chat-window .textarea');
                if (textarea && prompt && !promptFilled) {
                    // Gemini 的輸入框是 contentEditable，因此用 <p> 逐行填入以保留換行
                    fillContentEditableWithParagraphs(textarea, prompt);
                    promptFilled = true;
                }

                if (textarea && pasteImage && !pastingGeminiImage && !geminiImagePasteAttempted) {
                    pastingGeminiImage = true;
                    geminiImagePasteAttempted = true;
                    if (debug) console.log('Gemini: 貼上圖片中');
                    await delay(300); // 等待 Gemini 網頁的圖片貼上事件被註冊才能開始
                    await fetchClipboardImageAndSimulatePaste(textarea);
                    if (debug) console.log('Gemini: 貼上圖片完成');
                    pastingGeminiImage = false;
                }

                const button = document.querySelector('chat-window button.send-button');
                const canSubmit =
                    button &&
                    !button.disabled &&
                    promptFilled &&
                    autoSubmit &&
                    !submitted &&
                    !pastingGeminiImage &&
                    (!pasteImage || geminiImagePasteAttempted) &&
                    (tool !== 'image' || toolImageClicked);

                if (canSubmit) {
                    submitted = true;
                    button.focus();
                    setTimeout(() => {
                        // Gemini 一定要先 focus() 才能按下 click()
                        button.click();
                    }, 500);
                }

                const done =
                    (!prompt || promptFilled) &&
                    (!pasteImage || geminiImagePasteAttempted) &&
                    (!autoSubmit || submitted) &&
                    (tool !== 'image' || toolImageClicked);

                if (done) {
                    clearHash();
                }

                return done;
            }
        });
        } // end if featureToggles.autoFill

        return;
    }

    // ---------------------------------------------------------------------
    // Site: Claude (claude.ai)
    // - 支援: AutoFill / AutoSubmit
    // ---------------------------------------------------------------------
    if (location.hostname === 'claude.ai') {
        if (!featureToggles.autoFill) {
            if (debug) console.log('[ChatGPTToolkit] AutoFill feature is disabled for Claude');
            return;
        }
        
        const [prompt, autoSubmit] = getParamsFromHash();
        if (!prompt) return;

        startRetryInterval({
            intervalMs: 500,
            retries: 10,
            tick: () => {
                const textarea = document.querySelector('div[contenteditable]');
                if (!textarea) return false;

                // Claude 的輸入框是 contentEditable，因此用 <p> 逐行填入以保留換行
                fillContentEditableWithParagraphs(textarea, prompt);

                const button = document.querySelector('button');
                if (!button) return false;

                if (autoSubmit) {
                    button.focus();
                    setTimeout(() => {
                        button.click();
                    }, 500);
                }

                return true;
            }
        });

        return;
    }

    // ---------------------------------------------------------------------
    // Site: Phind (www.phind.com)
    // - 支援: AutoFill / AutoSubmit
    // ---------------------------------------------------------------------
    if (location.hostname === 'www.phind.com') {
        if (!featureToggles.autoFill) {
            if (debug) console.log('[ChatGPTToolkit] AutoFill feature is disabled for Phind');
            return;
        }
        
        const [prompt, autoSubmit] = getParamsFromHash();
        if (!prompt) return;

        startRetryInterval({
            intervalMs: 500,
            retries: 10,
            tick: () => {
                const textarea = document.querySelector('textarea[name="q"]');
                if (!textarea) return false;

                fillTextareaAndDispatchInput(textarea, prompt);

                if (autoSubmit) {
                    textarea.form.submit();
                }

                return true;
            }
        });

        return;
    }

    // ---------------------------------------------------------------------
    // Site: Perplexity (www.perplexity.ai)
    // - 支援: AutoFill / AutoSubmit
    // ---------------------------------------------------------------------
    if (location.hostname === 'www.perplexity.ai') {
        if (!featureToggles.autoFill) {
            if (debug) console.log('[ChatGPTToolkit] AutoFill feature is disabled for Perplexity');
            return;
        }
        
        const [prompt, autoSubmit] = getParamsFromHash();
        if (!prompt) return;

        startRetryInterval({
            intervalMs: 500,
            retries: 10,
            tick: () => {
                const textarea = document.querySelector('textarea[autofocus]');
                if (!textarea) return false;

                fillTextareaAndDispatchInput(textarea, prompt);

                if (autoSubmit) {
                    setTimeout(() => {
                        const buttons = textarea.parentElement.querySelectorAll('button');
                        buttons[buttons.length - 1].click();
                    }, 500);
                }

                return true;
            }
        });

        return;
    }

    // ---------------------------------------------------------------------
    // Site: Groq (groq.com)
    // - 支援: AutoFill / AutoSubmit
    // ---------------------------------------------------------------------
    if (location.hostname === 'groq.com') {
        if (!featureToggles.autoFill) {
            if (debug) console.log('[ChatGPTToolkit] AutoFill feature is disabled for Groq');
            return;
        }
        
        const [prompt, autoSubmit] = getParamsFromHash();
        if (!prompt) return;

        startRetryInterval({
            intervalMs: 500,
            retries: 10,
            tick: () => {
                const textarea = document.getElementById('chat');
                if (!textarea) return false;

                fillTextareaAndDispatchInput(textarea, prompt);

                if (autoSubmit) {
                    setTimeout(() => {
                        const btn = textarea.parentElement.querySelector('button');
                        btn.click();
                    }, 2000);
                }

                return true;
            }
        });

        return;
    }

    // Default logic for ChatGPT below.

    /**
     * ChatGPT 的輸入框是 `#prompt-textarea` (contentEditable)。
     * 這裡用 innerHTML 寫入 <p> 包裹的內容，並觸發 input 事件讓 React 能接到變更。
     *
     * NOTE: 這個行為是既有邏輯的一部分（可能允許 prompt 中含有 HTML），重構時刻意不改變。
     */
    function setChatGPTPromptEditor(editorDiv, promptText) {
        if (!editorDiv) return;
        editorDiv.innerHTML = '<p>' + promptText + '</p>'
        editorDiv.dispatchEvent(new Event("input", { bubbles: true }));
        editorDiv.focus();
    }

    const AutoFillFromURI = async (textarea) => {

        // 呼叫這個函式會渲染 Closure 的 prompt, autoSubmit, pasteImage 變數
        getParamsFromHash();

        if (prompt && textarea) {

            // 新版已經改為 div + contentEditable 的方式，所以要改變填入內容的方式
            setChatGPTPromptEditor(textarea, prompt);

            // textarea.value = prompt;
            // textarea.dispatchEvent(new Event("input", { bubbles: true }));
            // textarea.focus();
            // textarea.setSelectionRange(textarea.value.length, textarea.value.length); //將選擇範圍設定為文本的末尾
            // textarea.scrollTop = textarea.scrollHeight; // 自動捲動到最下方

            // 如果有 autoSubmit 參數，並且值為 true，就等初始按鈕加入之後才能自動送出，因為還有可能會貼上圖片

            history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
    }

    // 抓取剪貼簿中的圖片並模擬貼上事件
    async function fetchClipboardImageAndSimulatePaste(targetElement) {
        if (!targetElement) return false;

        targetElement.focus();

        try {
            if (debug) console.log('從剪貼簿抓取圖片');
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        // 取得圖片 Blob
                        const blob = await item.getType(type);
                        const file = new File([blob], 'clipboard-image.png', { type });

                        // 使用 DataTransfer 模擬貼上行為
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);

                        // 建立自訂的 paste 事件
                        const pasteEvent = new ClipboardEvent('paste', {
                            bubbles: true,
                            cancelable: true,
                            clipboardData: dataTransfer
                        });

                        console.log('觸發貼上事件', pasteEvent);
                        targetElement.dispatchEvent(pasteEvent);
                        console.log('模擬貼上圖片成功');

                        return true;
                    }
                }
            }

            console.log('剪貼簿中沒有圖片');
            return false;
        } catch (error) {
            console.error('抓取剪貼簿圖片失敗:', error);
            return false;
        }
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const StartMonitoringResponse = () => {
        // Check if customPrompts feature is enabled
        if (!featureToggles.customPrompts) {
            if (debug) console.log('[ChatGPTToolkit] Custom prompts feature is disabled');
            return;
        }

        // 預設的回應按鈕
        let defaultManualSubmitText = [];

        let lastBlock;

        const currentLocale = chrome.i18n?.getUILanguage();
        if (currentLocale) {
            if (currentLocale == 'zh-TW') {
                // exemplify
                defaultManualSubmitText.push({ title: "舉例說明", prompt: "請舉例說明" });
                // expand
                defaultManualSubmitText.push({ title: "提供細節", prompt: "請提供更多細節說明" });
                // translate to TC
                defaultManualSubmitText.push({ title: "翻譯成繁中", prompt: "請將上述回應內容翻譯成臺灣常用的正體中文" });
                // translate to EN
                defaultManualSubmitText.push({ title: "翻譯成英文", prompt: "Please translate the above response into English." });
            }
            else if (currentLocale == 'ja') {
                // exemplify
                defaultManualSubmitText.push({ title: "例えば", prompt: "例を挙げて説明して" });
                // expand
                defaultManualSubmitText.push({ title: "詳細説明", prompt: "もっと詳細に説明して" });
                // translate to JP
                defaultManualSubmitText.push({ title: "日本語に翻訳", prompt: "上述の返答内容を日本語に翻訳して" });
                // translate to EN
                defaultManualSubmitText.push({ title: "英語に翻訳", prompt: "Please translate the above response into English." });
            }
            else {
                // exemplify
                defaultManualSubmitText.push({ title: "More Examples", prompt: "Could you please provide me with more examples?" });
                // expand
                defaultManualSubmitText.push({ title: "More Details", prompt: "Could you please provide me with more details?" });
                // translate to EN
                defaultManualSubmitText.push({ title: "Translate to English", prompt: "Please translate the above response into English." });
            }
        }

        const customPrompts = localStorage.getItem('chatgpttoolkit.customPrompts');
        if (customPrompts) {
            defaultManualSubmitText = [];
            JSON.parse(customPrompts).forEach((item) => {
                const isItemEnabled = !item.hasOwnProperty('enabled') || item.enabled;
                const isItemInitial = !!item.hasOwnProperty('initial') || item.initial;
                if (isItemEnabled && !isItemInitial && !!item.title && !!item.prompt) {
                    defaultManualSubmitText.push(item);
                }
            });
        }

        let mutationObserverTimer = undefined;
        const obs = new MutationObserver(() => {

            // 尋找聊天記錄的最後一筆，用來插入按鈕
            const talkBlocks = [...document.querySelectorAll('div[data-message-author-role="assistant"]')];
            if (!talkBlocks || !talkBlocks.length) {
                return;
            }

            if (location.pathname.startsWith('/gpts/editor')) {
                return;
            }

            // console.log(mutationObserverTimer)
            clearTimeout(mutationObserverTimer);
            mutationObserverTimer = setTimeout(() => {

                // 先停止觀察，避免自訂畫面變更被觀察到
                stop();

                // 重新建立回應按鈕
                rebuild_buttons();

                // Check if autoContinue feature is enabled
                if (featureToggles.autoContinue) {
                    // 找到繼續生成的按鈕，並點擊讓 ChatGPT 繼續生成回應
                    var btnContinue = [...document.querySelectorAll('button')].filter(e => e.innerText.trim() == '繼續生成' || e.innerText.trim() == 'Continue generating' || e.innerText.trim() == '生成を続ける')
                    if (btnContinue && btnContinue.length > 0) {
                        btnContinue[0].click();
                    }
                }

                // 重新開始觀察
                start();

            }, 0);

        });

        function rebuild_buttons() {

            const talkBlocks = [...document.querySelectorAll('div[data-message-author-role="assistant"]')];

            let buttonsAreas = document.querySelectorAll('#custom-chatgpt-magic-box-buttons');

            // 如果正在回答問題中，就不要出現這些按鈕
            let stopButton = document.querySelector('button[data-testid="stop-button"]');
            if (stopButton) {
                buttonsAreas?.forEach((item) => {
                    item.remove();
                });
                return;
            }

            // 如果還沒有輸入框，也不要顯示按鈕
            const promptTextarea = document.getElementById("prompt-textarea");
            if (!promptTextarea) {
                buttonsAreas?.forEach((item) => {
                    item.remove();
                });
                return;
            }

            // 如果因為編輯先前的提示導致整體 DOM 結構改變，就重建 Buttons
            if (lastBlock != talkBlocks[talkBlocks.length - 1]) {
                buttonsAreas?.forEach((item) => {
                    item.remove();
                });
            }

            buttonsAreas = document.querySelectorAll('#custom-chatgpt-magic-box-buttons');
            if (buttonsAreas.length > 0) {
                return;
            }

            // create a new buttons area
            let buttonsArea = document.createElement("div");
            buttonsArea.id = "custom-chatgpt-magic-box-buttons";
            buttonsArea.classList = "custom-buttons-area text-base m-auto md:max-w-2xl lg:max-w-2xl xl:max-w-3xl p-4 md:py-6 flex lg:px-0";
            buttonsArea.style.overflowY = "auto";
            buttonsArea.style.display = "flex";
            buttonsArea.style.flexWrap = "wrap";
            buttonsArea.style.paddingTop = "0.75rem";
            buttonsArea.style.paddingLeft = "calc(30px + 0.75rem)";

            // add buttons to buttonsArea
            defaultManualSubmitText.forEach((item) => {
                const autoPasteEnabled = !!item.hasOwnProperty('autoPaste') || item.autoPaste;

                const customButton = document.createElement("button");
                customButton.style.border = "1px solid #d1d5db";
                customButton.style.borderRadius = "5px";
                customButton.style.padding = "0.5rem 1rem";
                customButton.style.margin = "0.5rem";

                customButton.title = item.altText;
                customButton.innerText = item.title;
                customButton.addEventListener("click", () => {
                    if (autoPasteEnabled) {
                        navigator.clipboard.readText().then((text) => {
                            text = text.trim();
                            if (!!text) {
                                fillPrompt(item.prompt + text, true);
                            } else {
                                fillPrompt(item.prompt, false);
                            }
                        });
                    } else {
                        fillPrompt(item.prompt, item.autoSubmit);
                    }
                });

                buttonsArea.append(customButton);
            });

            if (talkBlocks.length > 0) {
                lastBlock = talkBlocks[talkBlocks.length - 1];
                lastBlock.after(buttonsArea);
            }

            // Check if markmap feature is enabled
            if (featureToggles.markmap) {
                const mdLabels = [...document.querySelectorAll('div')]
                    .filter(el => el.textContent.trim().toLowerCase() === 'markdown');

                mdLabels.forEach((mdLabel) => {
                    add_markmap_button(mdLabel);
                });
            }
        }

        const start = () => {
            // console.log('ChatGPT: Start Monitoring')
            obs.observe(document.body, {
                childList: true,
                attributes: true,
                subtree: true,
            });
        };

        const stop = () => {
            // console.log('ChatGPT: Stop Monitoring')
            obs.disconnect();
        };

        rebuild_buttons();

        start();

    };

    // 自動監控所有 ChatGPT 回應，用以判斷何時要顯示回應按鈕
    setTimeout(() => {
        StartMonitoringResponse();
    }, 1000);

    const checkForTextareaInput = setInterval(async () => {
        let textarea = document.getElementById('prompt-textarea')
        if (!!textarea) {

            // Check if autoFill feature is enabled before auto-filling from URL
            if (featureToggles.autoFill) {
                // 自動從 URL 填入提詞(Prompt)
                await AutoFillFromURI(textarea);
            }

            clearInterval(checkForTextareaInput);
        };
    }, 60);

    // ---------------------------------------------------------------------
    // ChatGPT: pasteImage / autoSubmit state machine
    // ---------------------------------------------------------------------

    // 處理 pasteImage 的狀態（一次性動作：成功後會把 pasteImage 設為 false）
    async function maybePasteImageIntoChatGPT() {
        if (!pasteImage || pastingImage) return;

        const textarea = document.getElementById("prompt-textarea");
        if (!textarea) return;

        pastingImage = true;
        if (debug) console.log('貼上圖片中');

        // 等待 ChatGPT 網頁的圖片貼上事件被註冊才能開始
        await delay(300);
        await fetchClipboardImageAndSimulatePaste(textarea);

        if (debug) console.log('貼上圖片完成');
        pasteImage = false;
        pastingImage = false;
    }

    // 處理 autoSubmit 的狀態（前提：pasteImage 已完成或未啟用）
    function maybeAutoSubmitChatGPT() {
        if (!autoSubmit || pasteImage) return;

        const sendButton = document.querySelector('button[data-testid*="send-button"]');
        if (sendButton && !sendButton.disabled) {
            if (debug) console.log('自動提交按鈕被點擊');
            sendButton.click();
            autoSubmit = false;
        }
    }

    // 使用高頻輪詢是因為 ChatGPT 的按鈕/輸入框會動態建立，且貼圖/送出需要抓「可操作」的瞬間。
    setInterval(async () => {
        await maybePasteImageIntoChatGPT();
        maybeAutoSubmitChatGPT();
    }, 60);

    // 檢查是否有指定的文字在 DOM 中，而且是精準比對，被改過就不會判斷出來
    function isFoundTextInDOM(dom, texts = []) {
        if (typeof texts === 'string') {
            texts = [texts];
        }
        return dom && texts.includes(dom.textContent.trim());
    }

    // 填入提示(Prompt)內容
    function fillPrompt(prompt, autoSubmit = true) {
        const div = document.getElementById("prompt-textarea");
        if (div) {
            setChatGPTPromptEditor(div, prompt);

            // move cursor to the end
            const range = document.createRange();
            const sel = window.getSelection();
            range.setStart(div, 1);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            div.focus();

            setTimeout(() => {
                // 預設的送出按鈕
                const sendButton = document.querySelector('button[data-testid*="send-button"]');
                if (sendButton && autoSubmit) {
                    sendButton.click();
                }
            }, 50);

        }
    }

    // 由於在切換歷史紀錄時會重建 main 元素，所以要監聽 document.body 的事件
    // Check if doubleClickEdit feature is enabled
    if (featureToggles.doubleClickEdit) {
        document.body.addEventListener('dblclick', (event) => {
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }
            // 找出最接近的對話列 DIV
            let closestDIV = event.target.closest('div[data-message-author-role="user"]');
            if (closestDIV) {
                // console.log('closestDIV: ', closestDIV)
                let btns = [...closestDIV.querySelectorAll('button')];
                if (btns.length > 0) {
                    let btn = btns[0];
                    // console.log('btn: ', btn)
                    btn.click();
                    setTimeout(() => {
                        let txt = closestDIV.querySelector('textarea')
                        if (txt) {
                            txt.selectionStart = txt.selectionEnd = txt.value.length;
                            txt.focus();
                        }
                    }, 0);
                }
            }
        });
    }

    // Add an event listener for the Ctrl+Enter key combination on document.body
    // Check if ctrlEnter feature is enabled
    if (featureToggles.ctrlEnter) {
        document.body.addEventListener('keyup', (event) => {
            if (event.ctrlKey && event.key === 'Enter') {
                // Check if the target element is a textarea
                if (event.target.tagName === 'TEXTAREA') {
                    // Locate the send button based on the relative position of the button related to the textarea
                    const container = event.target?.parentElement?.parentElement;
                    const sibling = container?.nextElementSibling;
                    const sendButton = sibling?.querySelector('button.btn-primary');
                    if (sendButton) {
                        sendButton.click();
                    }
                }
            }
        });
    }

    function add_markmap_button(mdLabel) {
        if (!mdLabel) return;

        const codeBlock = mdLabel.nextElementSibling?.nextElementSibling;
        if (debug) console.debug('Code block found:', codeBlock);

        const codeEl = codeBlock?.querySelector('code');
        if (debug) console.debug('Code element found:', codeEl);

        if (!codeEl) return;

        const btn = mdLabel.nextElementSibling?.querySelector('button');
        if (debug) console.debug('Button found:', btn);

        const containerDiv = btn?.parentElement?.parentElement;
        if (!containerDiv) return;

        if (containerDiv.querySelector('button[aria-label="Mindmap"]')) return;

        if (debug) console.debug('Wrapper div found:', containerDiv);

        const spanHtml = `<span class="" data-state="closed"><button class="flex gap-1 items-center select-none px-4 py-1" aria-label="Mindmap"><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="12" viewBox="0 0 128 128" enable-background="new 0 0 128 128" xml:space="preserve"><path fill="none" stroke="#010100" stroke-width="2" opacity="1.000000" d="M76.688866,109.921104 C88.050018,115.331482 100.131790,117.192719 112.584740,117.125877 C117.595360,117.098984 120.788620,114.305405 121.104477,109.904366 C121.439659,105.234016 118.474678,101.801880 113.419678,101.228683 C111.275566,100.985550 109.030663,101.381645 106.940926,100.953491 C99.494377,99.427811 91.778465,98.498268 84.753601,95.805984 C74.877594,92.020988 69.684692,83.908684 68.234291,73.078300 C70.384644,73.078300 72.207634,73.078644 74.030617,73.078247 C86.858322,73.075493 99.686478,73.133377 112.513527,73.040070 C117.709305,73.002274 120.970772,69.862900 121.039032,65.258537 C121.107437,60.644268 117.884323,57.419498 112.785179,57.093300 C111.125771,56.987152 109.454391,57.064369 107.788483,57.064228 C94.648399,57.063137 81.508308,57.063622 68.322067,57.063622 C69.945129,45.040371 75.792297,36.744892 87.154800,33.278618 C95.306870,30.791729 104.059700,30.155739 112.593239,29.080770 C117.983620,28.401745 121.287643,25.539717 121.122673,20.684353 C120.966324,16.082565 117.653831,12.969757 112.453003,13.059167 C107.634552,13.142003 102.803261,13.490462 98.013023,14.033926 C71.598251,17.030745 56.428867,30.937811 51.926388,56.118473 C51.879574,56.380272 51.563141,56.593864 51.183678,57.063988 C40.724709,57.063988 30.076698,57.042259 19.428833,57.072033 C12.907690,57.090271 8.991345,60.245888 9.110775,65.284119 C9.227548,70.210205 12.886068,73.054855 19.251369,73.070534 C30.057989,73.097160 40.864723,73.077866 51.840267,73.077866 C53.987484,89.401680 61.400532,101.920280 76.688866,109.921104 z"/><path fill="#F5E41C" opacity="1.000000" stroke="none" d="M76.354416,109.751411 C61.400532,101.920280 53.987484,89.401680 51.840267,73.077866 C40.864723,73.077866 30.057989,73.097160 19.251369,73.070534 C12.886068,73.054855 9.227548,70.210205 9.110775,65.284119 C8.991345,60.245888 12.907690,57.090271 19.428833,57.072033 C30.076698,57.042259 40.724709,57.063988 51.183678,57.063988 C51.563141,56.593864 51.879574,56.380272 51.926388,56.118473 C56.428867,30.937811 71.598251,17.030745 98.013023,14.033926 C102.803261,13.490462 107.634552,13.142003 112.453003,13.059167 C117.653831,12.969757 120.966324,16.082565 121.122673,20.684353 C121.287643,25.539717 117.983620,28.401745 112.593239,29.080770 C104.059700,30.155739 95.306870,30.791729 87.154800,33.278618 C75.792297,36.744892 69.945129,45.040371 68.322067,57.063622 C81.508308,57.063622 94.648399,57.063137 107.788483,57.064228 C109.454391,57.064369 111.125771,56.987152 112.785179,57.093300 C117.884323,57.419498 121.107437,60.644268 121.039032,65.258537 C120.970772,69.862900 117.709305,73.002274 112.513527,73.040070 C99.686478,73.133377 86.858322,73.075493 74.030617,73.078247 C72.207634,73.078644 70.384644,73.078300 68.234291,73.078300 C69.684692,83.908684 74.877594,92.020988 84.753601,95.805984 C91.778465,98.498268 99.494377,99.427811 106.940926,100.953491 C109.030663,101.381645 111.275566,100.985550 113.419678,101.228683 C118.474678,101.801880 121.439659,105.234016 121.104477,109.904366 C120.788620,114.305405 117.595360,117.098984 112.584740,117.125877 C100.131790,117.192719 88.050018,115.331482 76.354416,109.751411 z"/></svg>心智圖</button></span>`;
        containerDiv.insertAdjacentHTML('afterbegin', spanHtml);
        if (debug) console.debug('Inserted Mindmap button HTML into wrapperDiv:', containerDiv);

        const mindmapBtn = containerDiv.querySelector('button[aria-label="Mindmap"]');
        if (debug) console.debug('Mindmap button found:', mindmapBtn);

        let isActive = false;
        mindmapBtn.addEventListener('click', () => {
            if (debug) console.debug('Mindmap button clicked. Current active state:', isActive);

            mdLabel.scrollIntoView({ behavior: 'smooth', block: 'start' });

            let mm; // the markmap instance

            if (!isActive) {
                if (debug) console.debug('Creating mindmap...');

                const svgHeight = Math.min(document.documentElement.clientHeight * 3 / 5, codeBlock.clientHeight || document.documentElement.clientHeight);
                const roundedSvgHeight = Math.round(svgHeight / 10) * 10;
                codeBlock.innerHTML = `<svg style="width: ${codeBlock.clientWidth}px; height: ${roundedSvgHeight}px"></svg>`;
                const svgEl = codeBlock.querySelector('svg');

                svgEl.addEventListener('dblclick', async (e) => {
                    if (debug) console.debug('SVG element double-clicked. Requesting fullscreen...');
                    try {
                        if (svgEl.requestFullscreen) {
                            await svgEl.requestFullscreen();
                        } else if (svgEl.webkitRequestFullscreen) { // Safari
                            await svgEl.webkitRequestFullscreen();
                        } else if (svgEl.msRequestFullscreen) { // IE11
                            await svgEl.msRequestFullscreen();
                        }
                    } catch (error) {
                        if (debug) console.error('Error attempting to enter fullscreen mode:', error);
                    }
                });

                function handleFullscreenChange(e) {
                    setTimeout(() => {
                        mdLabel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        mm?.fit();
                    }, 60);
                }

                document.addEventListener('fullscreenchange', handleFullscreenChange);

                const transformer = new window.markmap.Transformer();
                const { root, features } = transformer.transform(codeEl.textContent);

                // const jsonOptions = { color: ['#1f77b4', '#ff7f0e', '#2ca02c'], colorFreezeLevel: 2 };
                const jsonOptions = {
                    autoFit: true,
                    duration: 300
                };
                const options = window.markmap.deriveOptions(jsonOptions);

                if (document.documentElement.classList.contains('dark')) {
                    document.documentElement.classList.add('markmap-dark');
                }

                mm = window.markmap.Markmap.create(svgEl, options, root);

                isActive = true;
            } else {
                if (debug) console.debug('Resetting code block to original content...');
                mm?.destroy();
                codeBlock.innerHTML = `<code>${codeEl.textContent}</code>`;
                isActive = false;
            }
        });
    }

})();
