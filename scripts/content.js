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

        if (str.length < 64) return false;

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

        decoded = decoded?.replace(/\s/g, '');

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

    const getParamsFromHash = () => {
        // 解析 hash 中的查詢字串並取得所需的參數
        let hash = location.hash.substring(1);
        if (!hash) return [null, false];

        let prompt = '';
        let submit = '';
        let autoSubmit = false;

        if (debug) console.log('hash: ', hash);

        let idx = hash.indexOf('&');

        // 若找不到 & 就只搜尋 prompt 參數即可
        if (idx == -1) {
            prompt = getUriComponent(hash, 'prompt');
        } else {
            // 如果第一個參數是 prompt 的話，由於 prompt 參數可能包含 & 字元 (因為 %s 的特性)，所以要改變解析參數的邏輯
            if (hash.startsWith('prompt')) {
                idx = hash.lastIndexOf('&');
            }

            let arg1 = hash.substring(0, idx);
            let arg2 = hash.substring(idx + 1);

            prompt = getUriComponent(arg1, 'prompt') || getUriComponent(arg2, 'prompt');
            submit = getUriComponent(arg1, 'autoSubmit') || getUriComponent(arg2, 'autoSubmit');

            autoSubmit = (submit === '1' || submit === 'true');
        }

        if (debug) console.log('prompt: ', prompt);
        if (debug) console.log('autoSubmit: ', autoSubmit);

        // 沒有 prompt 就不處理了
        if (!prompt) return [null, false];

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

        // 正式取得 prompt 參數的內容
        prompt = decodeURIComponent(prompt);

        if (debug) console.log('prompt1: ', prompt);

        // 如果 prompt 內容為 Base64Unicode 編碼字串，則解碼為 Unicode 字串
        if (isBase64Unicode(prompt)) {
            prompt = b64DecodeUnicode(prompt);
        }

        if (debug) console.log('prompt2: ', prompt);

        // 正規化 prompt 內容，移除多餘的空白與換行字元
        prompt = prompt.replace(/\r/g, '')
            .replace(/\n{3,}/sg, '\n\n')
            .replace(/^\s+/sg, '')

        if (debug) console.log('prompt3: ', prompt);

        if (!prompt) return [null, false];

        // 已經完成參數解析，移除 ChatGPT 萬能工具箱專屬的 hash 內容
        if (!!prompt) {
            if (history.replaceState) {
                history.replaceState(null, document.title, window.location.pathname + window.location.search);
            } else {
                window.location.hash = '';
            }
        }

        if (debug) console.log('prompt4: ', prompt);

        return [prompt, autoSubmit];
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

    const AutoFillFromURI = (textarea) => {

        const [prompt, autoSubmit] = getParamsFromHash();

        if (prompt && textarea) {
            textarea.value = prompt;
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length); //將選擇範圍設定為文本的末尾
            textarea.scrollTop = textarea.scrollHeight; // 自動捲動到最下方

            if (autoSubmit) {
                setTimeout(() => {
                    // 預設的送出按鈕
                    const button = document.querySelector('button[data-testid*="send-button"]');
                    if (!button.disabled) {
                        button.click();
                    }
                }, 1000);
            }

            history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
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
                if (isItemEnabled && !!item.title && !!item.prompt) {
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

                const customButton = document.createElement("button");
                customButton.style.border = "1px solid #d1d5db";
                customButton.style.borderRadius = "5px";
                customButton.style.padding = "0.5rem 1rem";
                customButton.style.margin = "0.5rem";

                customButton.title = item.altText;
                customButton.innerText = item.title;
                customButton.addEventListener("click", () => {
                    // 填入 prompt
                    const textarea = document.getElementById("prompt-textarea");
                    if (textarea) {
                        textarea.value = item.prompt;
                        textarea.dispatchEvent(new Event("input", { bubbles: true }));
                        textarea.focus();
                        textarea.setSelectionRange(textarea.value.length, textarea.value.length); //將選擇範圍設定為文本的末尾
                        textarea.scrollTop = textarea.scrollHeight; // 自動捲動到最下方

                        // 預設的送出按鈕
                        const sendButton = document.querySelector('button[data-testid*="send-button"]');
                        if (sendButton && (!item.hasOwnProperty('autoSubmit') || item.autoSubmit)) {
                            sendButton.click();
                        }
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
    StartMonitoringResponse();

    const checkForTextareaInput = setInterval(() => {
        let textarea = document.getElementById('prompt-textarea')
        if (!!textarea) {

            // 自動從 URL 填入提詞(Prompt)
            AutoFillFromURI(textarea);

            clearInterval(checkForTextareaInput);
        };
    }, 60);

    // 由於在切換歷史紀錄時會重建 main 元素，所以要監聽 document.body 的事件
    document.body.addEventListener('dblclick', (event) => {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        // 找出最接近的對話列 DIV
        let closestDIV = event.target.closest('div[data-message-author-role="assistant"]');
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
