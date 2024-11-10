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

            // 新版已經改為 div + contentEditable 的方式，所以要改變填入內容的方式
            textarea.innerHTML = '<p>' + prompt + '</p>'
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
            textarea.focus();

            // textarea.value = prompt;
            // textarea.dispatchEvent(new Event("input", { bubbles: true }));
            // textarea.focus();
            // textarea.setSelectionRange(textarea.value.length, textarea.value.length); //將選擇範圍設定為文本的末尾
            // textarea.scrollTop = textarea.scrollHeight; // 自動捲動到最下方

            if (autoSubmit) {

                setTimeout(() => {
                    // 預設的送出按鈕
                    const sendButton = document.querySelector('button[data-testid*="send-button"]');
                    if (sendButton) {
                        sendButton.click();
                    }
                }, 50);

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
                defaultManualSubmitText.push({
                    title: "文章總結大師",
                    prompt: "You are now a master of article summarization. Based on the content I provide, please summarize several key points, takeaways, conclusions, and notes to be aware of, not exceeding 2000 words. 你現在是文章總結大師，請根據我提供的內容(或URL)，總結幾個重點、takeaway、結論、注意事項。"
                  });
                  
                  defaultManualSubmitText.push({
                    title: "表格整理大師",
                    prompt: "You are now a table organisation expert. Please take the content I provide and present all the professional terms in a table format as follows: Column 1: English abbreviation of the professional term (if available) Column 2: Full English name of the professional term (with a YouTube keyword search URL, formatted like this: https://www.youtube.com/results?search_query=English_term) Column 3: The explanation of the term in English (no more than 30 words) Column 4: Chinese name of the professional term (with a Bilibili search URL, formatted like this: https://search.bilibili.com/all?keyword=Chinese_term) Column 5: The explanation of the term in Chinese (no more than 30 words). 你現在是表格整理大師，請根據我提供的內容，將內容中所有的專業詞彙(產品、方法、算法、硬體、軟體...等艱深名詞、動詞)用表格方式呈現，第1欄位:專業名詞的英文縮寫(如果有的話)，第2欄位:專業詞彙的英文名稱，第3欄位:專業詞彙的Youtube 關鍵字搜尋 URL，格式範例如下:https://www.youtube.com/results?search_query=該專業詞彙的英文，第4欄位:英文解釋(不超過30字)，第5欄位:專業詞彙的中文名稱，第6欄位:專業詞彙的Bilibili URL，格式範例如下:https://search.bilibili.com/all?keyword=該專業詞彙的中文)，)，第7欄位:中文解釋(不超過30字)。"
                  });
                  
                  defaultManualSubmitText.push({
                    title: "看圖說故事",
                    prompt: "Task 1: Please transcribe all the words you see in the image I provide without altering the content. Task 2: Based on the content of the image, present all professional terms (products, methods, algorithms, hardware, software, etc.) in table format: Column 1: English abbreviation of the professional term (if any), Column 2: Full English name of the professional term (with a YouTube keyword search URL), Column 3: Explanation of the term in English (no more than 30 words), Column 4: Chinese name of the professional term (with a Bilibili search URL), Column 5: Explanation of the term in Chinese (no more than 30 words). Lastly, explain the key message or insight the image author is trying to convey. 任務1: 請根據我提供的圖檔，把圖中你看到的字，一字不漏打出來(不要更改字內容)。任務2: 並根據內容及圖，將內容中所有的專業詞彙(產品、方法、算法、硬體、軟體...等艱深名詞、動詞)用表格方式呈現，第1欄位:專業名詞的英文縮寫(如果有的話)，第2欄位:專業詞彙的英文名稱(並附上Youtube 關鍵字搜尋的 URL)，第3欄位:英文解釋(不超過30字)，第4欄位:專業詞彙的中文名稱(請連上Bilibili URL)，第5欄位:中文解釋(不超過30字)，最後解釋這張圖作者想要表達或講解的內容心得。"
                  });
                  
                  defaultManualSubmitText.push({
                    title: "論文指導老師",
                    prompt: "You are now a thesis advisor. Based on the content I provide, please complete the following two tasks: Task A: List the research topic, background, purpose, problems, methods, data collection, analysis, research results, research findings, significance of research findings, limitations of research findings, research contributions, practical contributions, and future research directions of this thesis. Task B: Present the professional terms in the article in a table format: Column 1: English abbreviation of the professional term (if any), Column 2: Full English name of the professional term (with a URL or wiki hyperlink), Column 3: English explanation (not exceeding 30 words), Column 4: Chinese name of the professional term, Column 5: Chinese explanation (not exceeding 30 words). 你現在是論文指導老師，請根據我提供的內容，完成下列2個任務，任務A: 列出此論文的研究主題、背景、目的、研究的方法、評估指標或標準、研究發現、研究發現的局限性、實務貢獻、結論、未來研究方向。任務B: 把文章中的專業詞彙用表格方式呈現說明，第1欄位:專業名詞的英文縮寫(如果有的話)，第2欄位:專業詞彙的英文名稱(請連上URL或wiki的超連結)，第3欄位:英文解釋(不超過30字)，第4欄位:專業詞彙的中文名稱，第5欄位:中文解釋(不超過30字)。"
                  });
                  
                  defaultManualSubmitText.push({
                    title: "採購大師",
                    prompt: "You are now a procurement expert. Based on the content I provide, please present the materials mentioned in a table format: Column 1: Material name in English, Column 2: Explanation of the material’s function in English, Column 3: Material name in Chinese, Column 4: Explanation of the material’s function in Chinese, Column 5: YouTube URL, Column 6: Bilibili URL, Column 7: Taobao URL, Column 8: eBay URL, Column 9: Amazon URL, Column 10: Temu URL. 你現在是物料採購大師，請根據我提供的內容，將內容中提及的所有的物件,物料用表格方式呈現，第1欄位:該物件的名稱(英文)，第2欄位:該物件的功能解釋(英文)，第3欄位:該物件的名稱(中文)，第4欄位:該物件的功能解釋(中文)，第5欄位:該物件的Youtube URL，第6欄位:該物件的bilibili URL，第7欄位:該物件的掏寶URL，第8欄位:該物件的ebay URL，第9欄位:該物件的Amazon URL，第10欄位:該物件的Temu URL。"
                  });
                  defaultManualSubmitText.push({ 
                    title: "DIY大師", 
                    prompt: `你現在是DIY大師，請根據我提供的資料，將內容中所有的專業詞彙(產品、方法、算法、硬體、軟體...等艱深名詞、動詞)用表格方式呈現，第1欄位:專業名詞的英文縮寫(如果有的話)，第2欄位:專業詞彙的英文名稱，第3欄位:專業詞彙的Youtube 關鍵字搜尋 URL，格式範例如下:https://www.youtube.com/results?search_query=該專業詞彙的英文，第4欄位:英文解釋(不超過30字)，第5欄位:專業詞彙的中文名稱，第6欄位:專業詞彙的Bilibili URL，格式範例如下:https://search.bilibili.com/all?keyword=該專業詞彙的中文)，第7欄位:中文解釋(不超過30字)。然後把文章中DIY的步驟一步一步整理出來。`
                });
                
                defaultManualSubmitText.push({ 
                    title: "雙語翻譯小幫手", 
                    prompt: `你現在是多語言翻譯專家。內容如果是英文，幫我用中文解釋。內容如果是中文，幫我用英文解釋。如果是其他語言，統一幫我用中文解釋。`
                });
                
                defaultManualSubmitText.push({ 
                    title: "法律顧問", 
                    prompt: `你現在是License 法律顧問，請根據我提供的資料，幫我分析這個license可否免費商用?我可以修改後出售給第三者嗎?我需要公布我修改後的代碼嗎? 還要注意哪些事項?`
                });
                
                defaultManualSubmitText.push({ 
                    title: "GITHUB分析大師", 
                    prompt: `你現在Github分析大師，請根據我提供的資料，把上面的專業詞彙用表格方式呈現，第1欄位:該軟體github repo URL(或該軟體的官方URL)。第2欄位:軟體名稱。第3欄位:功能特色。第4欄位:download數/月。第5欄位:Contrubutors貢獻者人數。第6欄位:License。第7欄位:該repo使用的所有language與%。第8欄位:使用者人數。`
                });
                
                defaultManualSubmitText.push({ 
                    title: "PCB主板接口分析大師", 
                    prompt: `你現在是PCB主板接口分析大師，把圖中所有接口、元件整理出來並用表格說明解釋其用法，第1欄位:該接口或元件的網路圖片URL，第2欄位:該接口或元件的英文字母簡稱，第3欄位:該接口或元件的英文全名稱，第4欄位:該接口或元件的功能與用法(英文)，第5欄位:該接口或元件的中文名稱，第6欄位:該接口或元件的功能與用法(中文)。並解釋這張電路圖的運作原理及方法，以及重要接口元件與外部設備的關係。`
                });
                
                defaultManualSubmitText.push({ 
                    title: "產業分析師/公司介紹", 
                    prompt: `你現在是產業分析師，請根據我提供的資料，把這些關鍵字公司用表格整理介紹出來，第1欄位:公司股票編號(如果有的話，須註明在哪個國家的股票交易市場上市櫃)，第2欄位:公司完整URL，第3欄位:公司英文名稱，第4欄位:公司的主要產品或服務(用英文說明不超過30字)，第5欄位:公司中文名稱，第6欄位:公司的主要產品或服務(用中文說明不超過30字)。第7欄位:主要的競爭對手有哪些公司?`
                });
                
                defaultManualSubmitText.push({ 
                    title: "電路圖分析大師", 
                    prompt: `你現在是電路圖分析大師，把圖中的專業詞彙整理出來並用表格說明解釋其用法，第1欄位:該接口或元件的網路圖片URL，第2欄位:該接口或元件的英文字母簡稱，第3欄位:該接口或元件的英文全名稱，第4欄位:該接口或元件的功能與用法(英文)，第5欄位:該接口或元件的中文名稱，第6欄位:該接口或元件的功能與用法(中文)。並解釋這張電路圖的運作原理及方法，以及重要接口元件與外部設備的關係。`
                });
                
                defaultManualSubmitText.push({ 
                    title: "Solidworks功能說明", 
                    prompt: `根據圖片，說明solidworks CAM中，個選項的用法，用表格說明。`
                });
                
                defaultManualSubmitText.push({ 
                    title: "Solidworks總工程師", 
                    prompt: `你現在是Solidworks教學大師，請根據我提供的講師教學內容，總結出:1. 教學目的，2.課程使用到的Solidworks指令(用表格說明，第一欄位:指令英文名稱，第二欄位:指令中文名稱，第三欄位:指令使用方法(英文)，第四欄位:指令使用方法(中文))，3.最後:說明講師上課的教學重點與注意事項。`
                });
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
                    const div = document.getElementById("prompt-textarea");
                    if (div) {
                        div.innerHTML = '<p>' + item.prompt + '</p>'
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
                            if (sendButton && (!item.hasOwnProperty('autoSubmit') || item.autoSubmit)) {
                                sendButton.click();
                            }
                        }, 50);

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
