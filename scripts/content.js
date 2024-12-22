(function () {
    "use strict";

    // Test case:
    // I+B = C&D
    // https://www.phind.com/search?home=true#autoSubmit=false&prompt=I%2BB+%3D+C%26D
    // https://www.phind.com/search?home=true#prompt=I%2BB+%3D+C%26D&autoSubmit=false
    // https://claude.ai/#autoSubmit=true&prompt=I+B%20=%20C&D
    // https://claude.ai/#prompt=I+B%20=%20C&D&autoSubmit=true
    let debug = true;

    function b64EncodeUnicode(str) {
        const bytes = new TextEncoder().encode(str);
        const base64 = window.btoa(String.fromCharCode(...new Uint8Array(bytes)));
        return base64;
    }

    function isBase64Unicode(str) {
        // Base64編碼後的字串僅包含 A-Z、a-z、0-9、+、/、= 這些字元
        const base64Regex = /^[\w\+\/=]+$/;
        if (!base64Regex.test(str)) return false;

        if (str.length < 32) return false;

        try {
            const decoded = window.atob(str);

            // 解碼後的字串應該是合法的 UTF-8 序列
            // 使用 TextDecoder 檢查是否可以成功解碼為 Unicode 字串
            const bytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; i++) {
                bytes[i] = decoded.charCodeAt(i);
            }
            const decoder = new TextDecoder('utf-8');
            decoder.decode(bytes);

            // 如果沒有拋出異常，則表示是合法的 Base64Unicode 編碼字串
            return true;
        } catch (e) {
            // 解碼失敗，則不是合法的 Base64Unicode 編碼字串
            return false;
        }
    }

    function b64DecodeUnicode(str) {
        const bytes = Uint8Array.from(window.atob(str), c => c.charCodeAt(0));
        let decoded = new TextDecoder().decode(bytes);

        if (debug) console.log('decoded:', decoded, 'decoded length', decoded?.length);

        if (!!decoded && decoded.length > 0) {
            return decoded;
        } else {
            return str;
        }
    }

    // 取得 URI 查詢字串中的參數值
    function getUriComponent(segment, name) {
        let idx = segment.indexOf('=');
        if (idx == -1) return;

        let key = segment.substring(0, idx);
        let val = segment.substring(idx + 1);

        if (!key || !val) return;

        if (key === name) {
            return val;
        }
    }

    // 為了相容於一開始的設計，怕使用者傳入不合格式的 prompt 內容，所以要特殊處理
    function flexiblePromptDetection(hash) {
        let prompt = '';

        let idx = hash.indexOf('&');

        // 如果第一個參數是 prompt 的話，由於 prompt 參數可能包含 & 字元 (因為 %s 的特性)，所以要改變解析參數的邏輯
        if (hash.startsWith('prompt')) {
            hash = hash
                .replace(/&autoSubmit=([^&]+)/, '')
                .replace(/&pasteImage=([^&]+)/, '')
            idx = hash.lastIndexOf('&');
        }

        // 若找不到 & 就只搜尋 prompt 參數即可
        if (idx == -1) {
            prompt = getUriComponent(hash, 'prompt');
        } else {
            let arg1 = hash.substring(0, idx);
            let arg2 = hash.substring(idx + 1);
            if (debug) console.log('arg1: ', arg1);
            if (debug) console.log('arg2: ', arg2);

            prompt = getUriComponent(arg1, 'prompt') || getUriComponent(arg2, 'prompt');
        }

        if (debug) console.log('prompt1: ', prompt);

        // 沒有 prompt 就不處理了
        if (!prompt) return null;

        // 因為 Chrome 的 Site search 在使用者輸入 %s 內容時，會自動判斷要用哪一種編碼方式
        // 如果有 Query String 的話，他會自動用 encodeURIComponent 進行編碼
        // 如果沒有 Query String 的話，他會自動用 encodeURI 進行編碼。
        // 這個 encodeURI 方法不會對某些保留的字元進行編碼，例如 ";", "/", "?", ":", "@", "&", "=", "+", "$", 和 "#"。
        // 因此我們要特別處理這個狀況！
        if (location.search == '') {
            prompt = prompt
                .replace(/\;/g, "%3B")
                .replace(/\//g, "%2F")
                .replace(/\?/g, "%3F")
                .replace(/\:/g, "%3A")
                .replace(/\@/g, "%40")
                .replace(/\&/g, "%26")
                .replace(/\=/g, "%3D")
                .replace(/\+/g, "%2B")
                .replace(/\$/g, "%24")
                .replace(/\#/g, "%23");
        }

        // 這裡理論上已經不會再出現 + 符號了，如果出現就轉成 %20
        prompt = prompt.replace(/\+/g, "%20")

        if (debug) console.log('prompt2: ', prompt);

        // 正式取得 prompt 參數的內容
        prompt = decodeURIComponent(prompt);

        if (debug) console.log('prompt3: ', prompt);

        // 正規化 prompt 內容，移除多餘的空白與換行字元
        prompt = prompt.replace(/\r/g, '')
            .replace(/\n{3,}/sg, '\n\n')
            .replace(/^\s+/sg, '')

        if (debug) console.log('prompt4: ', prompt);

        if (!prompt) return null;

        return prompt;
    }

    let prompt = '';
    let autoSubmit = false;
    let pasteImage = false;

    const getParamsFromHash = () => {
        // 解析 hash 中的查詢字串並取得所需的參數
        let hash = location.hash.substring(1);
        if (!hash) return [null, false, false];

        if (debug) console.log('hash: ', hash);

        var qs = new URLSearchParams(hash);

        prompt = qs.get('prompt');
        autoSubmit = (qs.get('autoSubmit') === '1' || qs.get('autoSubmit') === 'true');
        pasteImage = (qs.get('pasteImage') === '1' || qs.get('pasteImage') === 'true');

        // 為了處理一些不合規定的 prompt 參數，所以要實作客製化的參數解析邏輯
        prompt = flexiblePromptDetection(hash) || prompt;

        // 如果 prompt 內容為 Base64Unicode 編碼字串，則解碼為 Unicode 字串
        if (isBase64Unicode(prompt)) {
            prompt = b64DecodeUnicode(prompt);
        }

        if (debug) console.log('prompt: ', prompt);
        if (debug) console.log('autoSubmit: ', autoSubmit);
        if (debug) console.log('pasteImage: ', pasteImage);

        // 已經完成參數解析，移除 ChatGPT 萬能工具箱專屬的 hash 內容
        if (!!prompt) {
            if (history.replaceState) {
                history.replaceState(null, document.title, window.location.pathname + window.location.search);
            } else {
                window.location.hash = '';
            }
        } else {
            // 沒有 prompt 就不處理了
            return [null, false, false];
        }

        return [prompt, autoSubmit, pasteImage];
    };

    if (location.hostname === 'gemini.google.com') {
        const [prompt, autoSubmit] = getParamsFromHash();
        if (!prompt) return;

        var retry = 10;
        var ti = setInterval(() => {
            var textarea = document.querySelector('chat-window .textarea');
            if (textarea) {

                const lines = prompt.split('\n');
                textarea.innerHTML = '';
                lines.forEach(line => {
                    const paragraph = document.createElement('p');
                    paragraph.innerText = line;
                    textarea.appendChild(paragraph);
                });

                var button = document.querySelector('chat-window button.send-button');
                if (button) {

                    if (autoSubmit) {
                        button.focus();
                        setTimeout(() => {
                            // Gemini 一定要先 focus() 才能按下 click()
                            button.click();
                        }, 500);
                    }

                    clearInterval(ti);
                    return;
                }
            }

            retry--;

            if (retry == 0) {
                clearInterval(ti);
            }

        }, 500);

        return;
    }

    if (location.hostname === 'claude.ai') {
        const [prompt, autoSubmit] = getParamsFromHash();
        if (!prompt) return;

        var retry = 10;
        var ti = setInterval(() => {
            var textarea = document.querySelector('div[contenteditable]');
            if (textarea) {
                const lines = prompt.split('\n');
                textarea.innerHTML = '';
                lines.forEach(line => {
                    const paragraph = document.createElement('p');
                    paragraph.innerText = line;
                    textarea.appendChild(paragraph);
                });

                var button = document.querySelector('button');
                if (button) {

                    if (autoSubmit) {
                        button.focus();
                        setTimeout(() => {
                            button.click();
                        }, 500);
                    }

                    clearInterval(ti);
                    return;
                }
            }

            retry--;

            if (retry == 0) {
                clearInterval(ti);
            }

        }, 500);

        return;
    }

    if (location.hostname === 'www.phind.com') {
        const [prompt, autoSubmit] = getParamsFromHash();
        if (!prompt) return;

        var retry = 10;
        var ti = setInterval(() => {
            var textarea = document.querySelector('textarea[name="q"]');
            if (textarea) {
                textarea.value = prompt;
                textarea.dispatchEvent(new Event("input", { bubbles: true }));

                if (autoSubmit) {
                    textarea.form.submit();
                }

                clearInterval(ti);
                return;
            }

            retry--;

            if (retry == 0) {
                clearInterval(ti);
            }

        }, 500);

        return;
    }

    if (location.hostname === 'www.perplexity.ai') {
        const [prompt, autoSubmit] = getParamsFromHash();
        if (!prompt) return;

        var retry = 10;
        var ti = setInterval(() => {
            var textarea = document.querySelector('textarea[autofocus]');
            if (textarea) {
                textarea.value = prompt;
                textarea.dispatchEvent(new Event("input", { bubbles: true }));

                if (autoSubmit) {
                    setTimeout(() => {
                        var buttons = textarea.parentElement.querySelectorAll('button');
                        buttons[buttons.length - 1].click();
                    }, 500);
                }

                clearInterval(ti);
                return;
            }

            retry--;

            if (retry == 0) {
                clearInterval(ti);
            }

        }, 500);

        return;
    }

    if (location.hostname === 'groq.com') {
        const [prompt, autoSubmit] = getParamsFromHash();
        if (!prompt) return;

        var retry = 10;
        var ti = setInterval(() => {
            retry--;

            var textarea = document.getElementById('chat');
            if (textarea) {
                textarea.value = prompt;
                textarea.dispatchEvent(new Event("input", { bubbles: true }));

                if (autoSubmit) {
                    setTimeout(() => {
                        const btn = textarea.parentElement.querySelector('button');
                        btn.click();
                    }, 2000);
                }

                clearInterval(ti);
                return;
            }

            if (retry <= 0) {
                clearInterval(ti);
            }

        }, 500);

        return;
    }

    // Default logic for ChatGPT below.

    // 監聽鍵盤事件
    document.addEventListener('keydown', function (event) {
        // 檢查是否按下 Alt + S
        if (event.altKey && event.key.toLowerCase() === 's') {
            // 找到切換搜尋功能的按鈕
            const searchButton =
                document.querySelector('button[aria-label="Search the web"]')
                || document.querySelector('button[aria-label="搜尋網頁"]')
                || document.querySelector('button[aria-label="ウェブを検索"]')

            if (searchButton) {
                // 執行點擊動作
                searchButton.click();
            }
        }
    });

    const AutoFillFromURI = async (textarea) => {

        // 呼叫這個函式會渲染 Closure 的 prompt, autoSubmit, pasteImage 變數
        getParamsFromHash();

        if (prompt && textarea) {

            // 新版已經改為 div + contentEditable 的方式，所以要改變填入內容的方式
            textarea.innerHTML = '<p>' + prompt + '</p>'
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
            textarea.focus();

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
        if (!targetElement) return;

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

                        // 觸發貼上事件
                        targetElement.dispatchEvent(pasteEvent);

                        console.log('模擬貼上圖片成功');
                        return;
                    }
                }
            }

            console.log('剪貼簿中沒有圖片');
        } catch (error) {
            console.error('抓取剪貼簿圖片失敗:', error);
        }
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const StartMonitoringResponse = () => {

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

                const autoContinue = localStorage.getItem('chatgpttoolkit.featureToggle.autoContinue');
                if (autoContinue) {
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

            // 自動從 URL 填入提詞(Prompt)
            await AutoFillFromURI(textarea);

            clearInterval(checkForTextareaInput);
        };
    }, 60);

    const checkForInitialButtons = setInterval(async () => {
        let uls = document.querySelectorAll('ul')
        let shouldInsertInitialButtons = false;
        for (let i = 0; i < uls.length; i++) {
            const ul = uls[i];
            for (let j = 0; j < ul.children.length; j++) {
                const li = ul.children[j];
                if (li.style.opacity == '1') {
                    shouldInsertInitialButtons = true;
                }
                if (li.dataset.customButton) {
                    shouldInsertInitialButtons = false;
                    break;
                }
            }
        }

        // 因為 RWD 的關係，所以會有兩個 ul，其中一個是隱藏的
        if (uls.length >= 2 && shouldInsertInitialButtons) {
            // console.warn(uls.children[1])
            const customPrompts = localStorage.getItem('chatgpttoolkit.customPrompts');
            if (customPrompts) {
                JSON.parse(customPrompts).reverse().forEach((item) => {
                    // console.log(item);
                    // debugger;
                    const isItemEnabled = !item.hasOwnProperty('enabled') || item.enabled;
                    const isItemInitial = !!item.hasOwnProperty('initial') || item.initial;
                    const autoPasteEnabled = !!item.hasOwnProperty('autoPaste') || item.autoPaste;
                    const svgIcon = item.svgIcon || "<svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' class='icon-md' style='color: rgb(226, 197, 65);'><path fill-rule='evenodd' clip-rule='evenodd' d='M12 3C8.41496 3 5.5 5.92254 5.5 9.53846C5.5 11.8211 6.662 13.8298 8.42476 15H15.5752C17.338 13.8298 18.5 11.8211 18.5 9.53846C18.5 5.92254 15.585 3 12 3ZM14.8653 17H9.13473V18H14.8653V17ZM13.7324 20H10.2676C10.6134 20.5978 11.2597 21 12 21C12.7403 21 13.3866 20.5978 13.7324 20ZM8.12601 20C8.57004 21.7252 10.1361 23 12 23C13.8639 23 15.43 21.7252 15.874 20C16.4223 19.9953 16.8653 19.5494 16.8653 19V16.5407C19.0622 14.9976 20.5 12.4362 20.5 9.53846C20.5 4.82763 16.6992 1 12 1C7.30076 1 3.5 4.82763 3.5 9.53846C3.5 12.4362 4.93784 14.9976 7.13473 16.5407V19C7.13473 19.5494 7.57774 19.9953 8.12601 20Z' fill='currentColor'></path></svg>";
                    if (isItemEnabled && isItemInitial && !!item.title && !!item.prompt) {
                        uls.forEach((ul) => {
                            const newLi = document.createElement('li');

                            newLi.dataset.customButton = '1';

                            // 設定 li 的屬性
                            newLi.style.opacity = '1';
                            newLi.style.willChange = 'auto';
                            newLi.style.transform = 'none';

                            // 建立 button 元素
                            const button = document.createElement('button');
                            button.className = 'group relative flex h-[42px] items-center gap-1.5 rounded-full border border-token-border-light px-3 py-2 text-start text-[13px] shadow-xxs transition enabled:hover:bg-token-main-surface-secondary disabled:cursor-not-allowed xl:gap-2 xl:text-[14px]';

                            button.title = item.altText;
                            // 插入 SVG 和文字內容
                            button.innerHTML = `${svgIcon}<span class="max-w-full select-none whitespace-nowrap text-gray-600 transition group-hover:text-token-text-primary dark:text-gray-500">${item.title}</span>`;

                            // 將 button 加入 li
                            newLi.appendChild(button);

                            newLi.addEventListener('click', () => {
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

                            // 將新的 li 加入 ul
                            ul.prepend(newLi);
                        });
                    }
                });
            }

            // 必須等到這個時間點才能貼圖，否則 ChatGPT 的 paste 事件還沒註冊，就無法貼圖了！
            if (pasteImage) {
                const textarea = document.getElementById("prompt-textarea");
                await fetchClipboardImageAndSimulatePaste(textarea);
                // 這個 pasteImage 狀態只有在 AutoFillFromURI 這個函式中才會設定為 true
                // 貼圖完畢後，將 pasteImage 設定為 false，避免重複貼圖
                pasteImage = false;
            }

            // 這個階段已經完成按鈕的插入，但是不能停止檢查，因為使用者隨時會建立新的 Session 聊天
            // clearInterval(checkForInitialButtons);
        };

        if (autoSubmit) {
            // 預設的送出按鈕
            const sendButton = document.querySelector('button[data-testid*="send-button"]');
            if (sendButton && !sendButton.disabled && !pasteImage) {
                // 必須等剪貼簿中的貼圖上傳完畢後才能送出
                sendButton.click();
                // 這個 autoSubmit 狀態只有在 AutoFillFromURI 這個函式中才會設定為 true
                autoSubmit = false;
            }
        }

        // 找出畫面中顯示為「搜尋網頁」的按鈕，並且加上 " (alt+s)" 快速鍵的提示，每秒執行 16 次
        requestAnimationFrame(() => {
            const spans = document.querySelectorAll('div[data-radix-popper-content-wrapper] > div[data-side="right"] span');
            spans.forEach(span => {
                if (isFoundTextInDOM(span, ['搜尋網頁', 'Search the web', 'ウェブを検索'])) {
                    span.textContent += ' (alt+s)';
                }
            });
        });

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
            div.innerHTML = '<p>' + prompt + '</p>'
            div.dispatchEvent(new Event("input", { bubbles: true }));

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

})();
