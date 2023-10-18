(function () {
    "use strict";

    let button;
    let textarea;

    const AutoFillFromURI = () => {

        // 解析 hash 中的查詢字串並取得所需的參數
        var hash = location.hash.substring(1);
        if (!hash) return;

        var params = new URLSearchParams(hash);

        // 解析參數
        let prompt = params.get('prompt')
            .replace(/\r/g, '')
            .replace(/\n{3,}/sg, '\n\n')
            .replace(/^\s+/sg, '')
        let submit = params.get("autoSubmit");

        let autoSubmit = false;
        if (submit == '1' || submit == 'true') {
            autoSubmit = true
        }

        if (prompt) {
            textarea.value = prompt;
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length); //將選擇範圍設定為文本的末尾
            textarea.scrollTop = textarea.scrollHeight; // 自動捲動到最下方

            if (autoSubmit) {
                setTimeout(() => {
                    button.click();
                }, 1000);
            }

            history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
    }

    const StartMonitoringResponse = () => {

        let defaultManualSubmitText = [];

        const currentLocale = chrome.i18n.getUILanguage();
        if (currentLocale == 'zh-TW') {
            // exemplify
            defaultManualSubmitText.push({ text: "舉例說明", value: "請舉例說明" });
            // expand
            defaultManualSubmitText.push({ text: "提供細節", value: "請提供更多細節說明" });
            // translate to TC
            defaultManualSubmitText.push({ text: "翻譯成繁中", value: "請將上述回應內容翻譯成臺灣常用的正體中文" });
            // translate to EN
            defaultManualSubmitText.push({ text: "翻譯成英文", value: "Please translate the above response into English." });
        }
        else if (currentLocale == 'ja') {
            // exemplify
            defaultManualSubmitText.push({ text: "例えば", value: "例を挙げて説明して" });
            // expand
            defaultManualSubmitText.push({ text: "詳細説明", value: "もっと詳細に説明して" });
            // translate to JP
            defaultManualSubmitText.push({ text: "日本語に翻訳", value: "上述の返答内容を日本語に翻訳して" });
            // translate to EN
            defaultManualSubmitText.push({ text: "英語に翻訳", value: "Please translate the above response into English." });
        }
        else {
            // exemplify
            defaultManualSubmitText.push({ text: "More Examples", value: "Could you please provide me with more examples?" });
            // expand
            defaultManualSubmitText.push({ text: "More Details", value: "Could you please provide me with more details?" });
            // translate to EN
            defaultManualSubmitText.push({ text: "Translate to English", value: "Please translate the above response into English." });
        }

        let globalButtons = [];
        let buttonsArea;
        let talkBlockToInsertButtons;

        const main = document.querySelector("body");

        let mutationObserverTimer = undefined;
        const obs = new MutationObserver(() => {

            // 尋找聊天記錄的最後一筆，用來插入按鈕
            const talkBlocks = document.querySelectorAll(
                "div.flex.flex-grow.flex-col.gap-3.max-w-full"
            );
            if (!talkBlocks || !talkBlocks.length) {
                return;
            }

            if (talkBlockToInsertButtons != talkBlocks[talkBlocks.length - 1]) {
                if (buttonsArea) {
                    // 重新將按鈕區和按鈕移除
                    buttonsArea.remove();
                }
            }

            clearTimeout(mutationObserverTimer);
            mutationObserverTimer = setTimeout(() => {

                // 先停止觀察，避免自訂畫面變更被觀察到
                stop();

                if (talkBlockToInsertButtons != talkBlocks[talkBlocks.length - 1]) {
                    // 要被插入按鈕的區塊
                    talkBlockToInsertButtons = talkBlocks[talkBlocks.length - 1];

                    // 重新建立回應按鈕
                    rebuild_buttons();
                }

                // 重新開始觀察
                start();

            }, 600);

            function rebuild_buttons() {

                // remove custom buttons
                globalButtons = [];

                // create a new buttons area
                buttonsArea = document.createElement("div");
                buttonsArea.classList = "custom-buttons-area text-base m-auto md:max-w-2xl lg:max-w-2xl xl:max-w-3xl p-4 md:py-6 flex lg:px-0";
                buttonsArea.style.overflowY = "auto";
                buttonsArea.style.display = "flex";
                buttonsArea.style.flexWrap = "wrap";
                buttonsArea.style.paddingTop = 0;
                buttonsArea.style.paddingLeft = "calc(30px + 0.75rem)";
                talkBlockToInsertButtons.after(buttonsArea);

                // add buttons
                defaultManualSubmitText.forEach((item) => {

                    let lastText = talkBlockToInsertButtons.innerText;

                    const button = document.createElement("button");
                    button.style.border = "1px solid #d1d5db";
                    button.style.borderRadius = "5px";
                    button.style.padding = "0.5rem 1rem";
                    button.style.margin = "0.5rem";

                    button.innerText = item.text;
                    button.addEventListener("click", () => {

                        // 填入 prompt
                        const textarea = document.querySelector("textarea");
                        textarea.value = item.value;
                        textarea.dispatchEvent(new Event("input", { bubbles: true }));
                        textarea.focus();
                        textarea.setSelectionRange(textarea.value.length, textarea.value.length); //將選擇範圍設定為文本的末尾
                        textarea.scrollTop = textarea.scrollHeight; // 自動捲動到最下方

                        // 預設的送出按鈕
                        const button = textarea.parentElement.querySelector("button:last-child");
                        button.click();

                    });

                    buttonsArea.append(button);
                    globalButtons.push(button);
                });
            }

        });

        const start = () => {
            obs.observe(main.parentElement, {
                childList: true,
                attributes: true,
                subtree: true,
            });
        };

        const stop = () => {
            obs.disconnect();
        };

        start();
    };

    const checkForTextareaInput = setInterval(() => {
        textarea = document.activeElement;
        if (textarea.tagName === 'TEXTAREA' && textarea.nextSibling.tagName === 'BUTTON') {

            // 預設的送出按鈕
            button = textarea.parentElement.querySelector("button:last-child");

            // 自動從 URL 填入提詞(Prompt)
            AutoFillFromURI();

            // 自動監控所有 ChatGPT 回應，用以判斷何時要顯示回應按鈕
            StartMonitoringResponse();

            clearInterval(checkForTextareaInput);
        };
    }, 60);

    const checkForMainElement = setInterval(() => {
        if (document.getElementsByTagName('main').length > 0) {
            // 由於在切換歷史紀錄時會重建 main 元素，所以要監聽 document.body 的事件
            document.body.addEventListener('dblclick', (event) => {
                // 使用者提示文字的圖示是 IMG，且 alt 屬性為 User
                if (event.target.nodeName === 'IMG' && event.target.alt === 'User') {
                    // 由於 ChatGPT 網站上的 DOM 都沒有定位點，所以只能靠 SVG 的線條來決定是哪一個按鈕
                    // 底下這個線條是編輯按鈕的「鉛筆」圖示
                    let div = event.target?.parentElement?.parentElement?.parentElement?.nextSibling;

                    if (div) {
                        let btn = div.querySelector('button');
                        if (btn) {
                            btn.click();
                            setTimeout(() => {
                                let txt = div.querySelector('textarea')
                                if (txt) {
                                    txt.selectionStart = txt.selectionEnd = txt.value.length;
                                    txt.focus();
                                }
                            }, 0);
                        }
                    }
                }
            });
            // console.log('ChatGPT: 滑鼠雙擊編輯提示文字 Initialized');
            clearInterval(checkForMainElement);
        }
    }, 500);

})();
