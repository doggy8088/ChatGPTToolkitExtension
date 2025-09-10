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
    let pastingImage = false;

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
        if (!!prompt && isBase64Unicode(prompt)) {
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

            const mdLabels = [...document.querySelectorAll('div')]
                .filter(el => el.textContent.trim().toLowerCase() === 'markdown');

            mdLabels.forEach((mdLabel) => {
                add_markmap_button(mdLabel);
            });
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

    // 處理 pasteImage 的狀態
    setInterval(async () => {
        if (pasteImage && !pastingImage) {
            const textarea = document.getElementById("prompt-textarea");
            if (textarea) {
                pastingImage = true;
                if (debug) console.log('貼上圖片中');
                await delay(300); // 等待 ChatGPT 網頁的圖片貼上事件被註冊才能開始
                await fetchClipboardImageAndSimulatePaste(textarea);
                if (debug) console.log('貼上圖片完成');
                pasteImage = false;
                pastingImage = false;
            }
        }

        if (autoSubmit && !pasteImage) {
            const sendButton = document.querySelector('button[data-testid*="send-button"]');
            if (sendButton && !sendButton.disabled) {
                if (debug) console.log('自動提交按鈕被點擊');
                sendButton.click();
                autoSubmit = false;
            }
        }
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

    // Add an event listener for the Ctrl+Enter key combination on document.body
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
