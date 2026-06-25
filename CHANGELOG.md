# Changelog

- 0.45.0 (2026/06/25)

  - Chore
    - 將擴充套件版本由 `0.44.4` 升級為 `0.45.0`。
    - 同步更新 `options.html` 頁尾顯示版本為 `0.45.0`。

  - New features
    - 新增跨站點「前綴插入」提示文字行為：填入 prompt 時保留原輸入內容，並將新文字插在前方。
    - 新增共用 prompt 組裝邏輯，統一支援 `{{args}}` 佔位符替換與剪貼簿內容拼接規則。

  - Bug fixes
    - 改善 ChatGPT 輸入編輯器偵測與寫入相容性，支援 `textarea` 與 `contenteditable` 路徑，降低版面變動造成填入失敗的機率。
    - 修正多站點（Claude、Gemini、Groq、Perplexity、Phind）原本可能覆蓋使用者既有輸入內容的問題。

  - Breaking changes
    - None

- 0.44.4 (2026/06/20)

  - Chore
    - 將擴充套件版本由 `0.44.3` 升級為 `0.44.4`。
    - 同步更新 `options.html` 頁尾顯示版本為 `0.44.4`。

  - New features
    - None

  - Bug fixes
    - 在 ChatGPT 的 `/scheduled` 與 `/deep-research` 頁面排除初始按鈕顯示，避免這些非一般對話入口頁出現自訂初始提示按鈕。

  - Breaking changes
    - None

- 0.44.3 (2026/06/16)

  - Chore
    - 將擴充套件版本由 `0.44.2` 升級為 `0.44.3`。
    - 同步更新 `options.html` 頁尾顯示版本為 `0.44.3`。

  - New features
    - None

  - Bug fixes
    - 修正 Gemini 追問按鈕在輸入框無文字時消失的問題：
      - Gemini UI 於輸入框清空時不渲染傳送按鈕，導致 `getSendButton()` 回傳 `null`，`rebuildFollowUpButtons()` 誤判為需要移除追問按鈕。
      - 將條件由「找不到傳送按鈕時移除追問按鈕」改為「找到傳送按鈕且確認為停止狀態（AI 生成中）時才移除」，使追問按鈕在輸入框為空時仍能正常顯示。

  - Breaking changes
    - None

- 0.44.1 (2026/05/28)

  - Chore
    - 將擴充套件版本由 `0.44.0` 升級為 `0.44.1`。
    - 同步更新 `options.html` 頁尾顯示版本為 `0.44.1`。

  - New features
    - 改版初始按鈕視覺設計，提供更一致且更專業的介面風格：
      - 採用膠囊型按鈕外觀與半透明漸層背景。
      - 調整字重、字距、內距與間距，提升可讀性與資訊層次。
      - 新增滑鼠懸停微動態與高亮狀態，改善互動回饋。

  - Bug fixes
    - 修正 ChatGPT 版面更新後，初始按鈕點擊有機率無法帶入提示語到聊天輸入框的問題：
      - 強化輸入編輯器偵測策略，優先搜尋可見且可互動的 composer 元素。
      - 擴充送出按鈕選擇器，支援新版 `composer-send-button` 與 `send-button`。
      - 改善 contenteditable 寫入流程，避免直接操作 `innerHTML` 造成不穩定。
    - 修正初始按鈕容器造成輸入列版面擠壓、導致 placeholder 文字偏移到右側的問題：
      - 調整按鈕容器掛載位置，避免與輸入列主排版區互相擠壓。
      - 移除會依座標強制偏移的左側 padding 校正邏輯，避免新版版面下錯位。
      - 保留 header 區優先插入與回退策略，提升在不同 ChatGPT 版型上的相容性。

  - Breaking changes
    - None

- 0.43.10 (2026/01/22)

  - Chore
    - Bump extension version to 0.43.10 for release.

  - New features
    - None

  - Bug fixes
    - Wait for Gemini image uploads to complete before auto-submitting prompts when `pasteImage=true`.

  - Breaking changes
    - None

- 0.43.9 (2026/01/22)

  - Chore
    - Bump extension version to 0.43.9 for release.

  - New features
    - Add Gemini initial and follow-up prompt buttons on `gemini.google.com/app`.

  - Bug fixes
    - Hide Gemini follow-up buttons while responses are streaming by checking the send button state.

  - Breaking changes
    - None

- 0.43.8 (2026/01/21)

  - Chore
    - Bump extension version to 0.43.8 for release.

  - New features
    - None

  - Bug fixes
    - Fix follow-up buttons missing after image-generation responses on ChatGPT.

  - Breaking changes
    - None

- 0.43.7 (2026/01/21)

  - Chore
    - Bump extension version to 0.43.7 for release.

  - New features
    - Allow auto paste prompts to replace `{{args}}` with clipboard content.
    - Show a `{{args}}` hint in the prompt editor when auto paste is enabled, with click-to-insert.

  - Bug fixes
    - None

  - Breaking changes
    - None

- 0.43.6 (2026/01/21)

  - Chore
    - Bump extension version to 0.43.6 for release.

  - New features
    - Localize all options page UI strings using Chrome i18n with updated translations.

  - Bug fixes
    - None

  - Breaking changes
    - None

- 0.43.5 (2026/01/21)

  - Chore
    - Bump extension version to 0.43.5 for release.

  - New features
    - Localize the options page app name using Chrome i18n.
    - Show the manifest version in the options page footer during build.

  - Bug fixes
    - None

  - Breaking changes
    - None

- 0.43.4 (2026/01/21)

  - Chore
    - Bump extension version to 0.43.4 for release.

  - New features
    - None

  - Bug fixes
    - Skip typing prompt commands on ChatGPT images pages.

  - Breaking changes
    - None

- 0.43.2 (2025/12/24)

  - Chore
    - Bump extension version to 0.43.2 for release.

  - New features
    - None

  - Bug fixes
    - Fixed `tool=image` parameter detection for Gemini when used without `prompt` parameter. URLs like `#tool=image`, `#autoSubmit=false&tool=image`, and `#autoSubmit=false&tool=image&prompt=` now work correctly.

  - Breaking changes
    - None

- 0.43.1 (2025/12/24)

  - Chore
    - Bump extension version to 0.43.1 for release.

  - New features
    - None

  - Bug fixes
    - Refactored `flexiblePromptDetection` function to handle URL parameters more flexibly. Now assumes `prompt` parameter is always last, making it easier to add new parameters in the future without code changes.

  - Breaking changes
    - None

- 0.43.0 (2025/12/23)

  - Chore
    - Bump extension version to 0.43.0 for release.

  - New features
    - Added a new `tool=image` parameter for `gemini.google.com` to automatically select the image generation tool.

  - Breaking changes
    - None

- 0.42.0 (2025/09/10)

  - Chore
    - Bump extension version to 0.42.0 for release. No functional changes.

  - New features
    - None

  - Bug fixes
    - Fix Ctrl+Enter issue due to ChatGPT website layout changes.

  - Breaking changes
    - None

- 0.41.0 (2025/04/27)

  - feat: add [Markmap](https://markmap.js.org/) support for Markdown code fences.

- 0.40.0 (2025/02/28)

  - chore: remove initial buttons due to ChatGPT layout changes.

- 0.39.0 (2025/02/08)

  - chore: Setup CI/CD for Chrome Web Store publishing.

- 0.38.0 (2025/02/01)

  - Feature: Pressing Ctrl+Enter in the textarea now triggers the send button action based on the interface language.
  - Added an event listener for the Ctrl+Enter key combination in `scripts/content.js`.
  - The event listener is registered on `document.body` and checks if the target is a textarea.

- 0.37.0 (2025/01/19)

  - Fix a bug on initial buttons detection.

- 0.36.3 (2024/12/23)

  - Fix a possible undefined error.

- 0.36.2 (2024/12/23)

  - Remove the Alt+S hotkey for the "Search the web" feature.

- 0.36.1 (2024/12/23)

  - fix(content): exclude "Projects"'s ul from initial buttons.

- 0.36.0 (2024/12/22)

  - fix(content): the initial buttons not shown due to ChatGPT layout changes.

- 0.35.0 (2024/11/20)

  - Fixed: The "base64 decode" handling was wrongly implemented in the last update.

- 0.34.0 (2024/11/19)

  - Feature: Added `pasteImage` parameter that can paste image from user's clipboard automatically.
  - Chore: Rewrite "hash" parsing logic to better readability.
  - Fixed: The "Search the web" feature apply the wrong hotkey to a popup.

- 0.33.0 (2024/11/18)

  - Fixed: Add Japanese support for text detection.
  - Fixed: The clipboard will no longer automatically send prompt when there is no content.
  - Feature: Added a hotkey hint `alt+s` for the "Search the web" hint text.

- 0.32.0 (2024/11/17)

  - Feature: Add `alt+s` hotkey to toggle `Search the web` feature
  - Feature: Add `autoPaste` feature to custom reply buttons

      ```js
      let customPrompts = [];

      customPrompts.push({
          "enabled": true,
          "title": "記事",
          "altText": "用來記錄手邊的筆記，但不需要 ChatGPT 回答。",
          "prompt": "請幫我記錄以下內容，僅需回答我 OK 即可：\n\n",
          "autoPaste": true,
          "autoSubmit": false
      });

      localStorage.setItem('chatgpttoolkit.customPrompts', JSON.stringify(customPrompts.filter(prompt => prompt.enabled && !!prompt.title)));
      ```

- 0.31.0 (2024/11/15)

  - Feature: Add custom prompts for initial buttons

      ```js
      let customPrompts = [];

      customPrompts.push({
          "enabled": true,
          "initial": true, // Used only in Initial Buttons
          "svgIcon": "📝", // This can be replaced with a SVG tag
          "title": "記事", // The text of the button
          "altText": "用來記錄手邊的筆記，但不需要 ChatGPT 回答。", // The hint text for the button
          "prompt": "除非我詢問你問題，否則請回答我 OK 即可", // The prompt text
          "autoPaste": true, // Auto paste the prompt text to the input field
          "autoSubmit": true // Auto submit the prompt text
      });

      localStorage.setItem('chatgpttoolkit.customPrompts', JSON.stringify(customPrompts.filter(prompt => prompt.enabled && !!prompt.title)));
      ```

- 0.30.0 (2024/10/24)

  - Fix the template for custom prompts.
  - Fix the bug with auto input & ensure the button input stays at the end of the input field.

- 0.29.0 (2024/10/11)

  - Fix few bugs due to ChatGPT layout structure changes.

- 0.28.0 (2024/10/01)

  - Fix few bugs due to ChatGPT layout structure changes.

- 0.27.0 (2024/07/07)

  - Feature: Turn-off "Auto-Continue" feature for ChatGPT. Add a `chatgpttoolkit.featureToggle.autoContinue` key in the localStorage to control enabling the feature. Here are the usage examples:

    ```js
    localStorage.setItem('chatgpttoolkit.featureToggle.autoContinue', '1');
    ```

- 0.26.0 (2024/07/03)

  - Feature: Add "Auto-Continue" feature for ChatGPT. It will automatically click the "Continue generating" button when the button is ready.

- 0.25.0 (2024/07/02)

  - Bug fixed: The buttons become `undefined` due to last update.

- 0.24.0 (2024/07/02)

  - Bug fixed: When the `prompt` has been edited, only the first button in the conversation is the `edit` button.

- 0.23.0 (2024/07/01)

  - Add `altText` to the `customPrompts` that can hint for the buttons.

- 0.22.0 (2024/06/30)

  - Bug fix for `chatgpt.com` when double-clicking on the prompt text.

- 0.21.0 (2024/06/20)

  - Add a `enabled` and `autoSubmit` property to the `customPrompts` object to control the prompt's visibility and auto-submit behavior. Here are the usage examples:

    ```js
    localStorage.setItem('chatgpttoolkit.customPrompts', `[
        {
            "enabled": false,
            "title": "搞笑寫作",
            "prompt": "請用喜劇演員的口語，將上述的回應重寫一次，讓它變得更有趣。",
            "autoSubmit": true
        },
        {
            "enabled": false,
            "title": "移除文字",
            "prompt": "請移除圖片中所有文字",
            "autoSubmit": true
        },
        {
            "enabled": true,
            "title": "你確定嗎",
            "prompt": "請再看一次你的回答，你確定你寫的是正確的嗎？",
            "autoSubmit": true
        },
        {
            "enabled": true,
            "title": "總結內容",
            "prompt": "請將我們剛剛的對話總結為幾個重點項目，讓我可以更快的掌握重點。",
            "autoSubmit": true
        },
        {
            "enabled": true,
            "title": "翻成中文",
            "prompt": "請將上述內容翻譯為正體中文。",
            "autoSubmit": true
        }
    ]`);
    ```

- 0.20.0 (2024/06/18)

  - Fixed a bug on `groq.com`.
  - Added the ability to customize prompts. Here are the usage examples:

    ```js
    localStorage.setItem('chatgpttoolkit.customPrompts', `[
        {
            "title": "搞笑寫作",
            "prompt": "請用喜劇演員的口語，將上述的回應重寫一次，讓它變得更有趣。"
        },
        {
            "title": "媽媽口吻",
            "prompt": "請用一個親和力爆表的地方媽媽口吻，將上述的回應重寫一次，讓它變得更好像是一個媽媽在教小孩的感覺。"
        },
        {
            "title": "悲劇抓馬",
            "prompt": "請用一個悲劇演員的口吻，將上述的回應重寫一次，讓它變得更悲傷、更戲劇化。"
        },
        {
            "title": "鄉民用語",
            "prompt": "請用鄉民用語，將上述的回應重寫一次，讓它變得更有趣。"
        }
    ]`);
    ```

- 0.19.0 (2024/06/17)

  - Bug fix for `chatgpt.com`.
  - fixes #8

- 0.18.0 (2024/05/06)

  - Add new domain for ChatGPT: `chatgpt.com`

- 0.17.0 (2024/03/16)

  - Feature: Add `Perplexity` Support for `AutoFill` and `AutoSubmit` feature.
  - Feature: Add `GroqChat` Support for `AutoFill` and `AutoSubmit` feature.

- 0.16.4 (2024/03/16)

  - Bug Fixed: Fix the Query String parsing issue when using Chrome's site search feature.

      Because when users input %s content in Chrome's Site search, it automatically determines which encoding method to use.

      If there is a Query String, it will automatically use encodeURIComponent for encoding.

      If there is no Query String, it will automatically use encodeURI for encoding.

      The encodeURI method does not encode certain reserved characters, such as ";", "/", "?", ":", "@", "&", "=", "+", "$", and "#".

      Therefore, we need to specially handle this situation!

- 0.16.3 (2024/03/13)

  - Bug Fixed: Fix the issue that the `hash` contains `+` character.

- 0.16.2 (2024/03/13)

  - New Feature: Support `prompt` text can be encoded by `b64EncodeUnicode` function.

- 0.16.1 (2024/03/12)

  - Bug Fixed: Fix the issue that the `AutoFill` and `AutoSubmit` feature produce errors when there is no hash on the location.

- 0.16.0 (2024/03/11)

  - Feature: Add `Gemini` Support for `AutoFill` and `AutoSubmit` feature.
  - Feature: Add `Claude` Support for `AutoFill` and `AutoSubmit` feature.
  - Feature: Add `phind` Support for `AutoFill` and `AutoSubmit` feature.

- 0.15.0 (2023/11/23)

  - Bug Fixed: Remove duplicated Buttons due to switching the previous/next prompts to another version.

- 0.14.1 (2023/11/22)

  - Bug Fixed: Avoid GPTs Editor apply this tool.

- 0.14.0 (2023/11/21)

  - Avoid GPTs Editor apply this tool.

- 0.13.0 (2023/11/13)

  - Ignore the `dblclick` event if the textarea is already in editing mode.

- 0.12.0 (2023/11/13)

  - Fix few bugs due to ChatGPT layout structure changes.

- 0.11.0 (2023/10/18)

  - Fix a bug due to ChatGPT layout structure changes.

- 0.10.0 (2023/09/1)

  - Fix a bug due to ChatGPT layout structure changes on August 3, 2023 updates.

- 0.9.0 (2023/08/07)

  - Add a new feature to edit prompt when double click on the prompt text.

- 0.8.1 (2023/06/08)

  - Remove "Continue" button it because there is a `Continue generating` built-in button on ChatGPT.

- 0.8.0 (2023/06/07)

  - Fixed for additional button disappear due to HTML layout changed on ChatGPT site.

- 0.7.0 (2023/04/18)

  - Change term for `翻譯成繁中` to `請將上述回應內容翻譯成臺灣常用的正體中文` (正體中文翻譯效果更好)

- 0.6.0 (2023/04/03)

  - Change Japanese extension name to `ChatGPT 多機能ツールキット`.
  - Bug fixed for buttons due to ChatGPT site DOM structure changed.

- 0.5.0 (2023/03/30)

  - Change Japanese extension name to `ChatGPT 万能ツールキット`.

- 0.4.0 (2023/03/28)

  - Keep the space for each line which keep all the newlines characters at the end of the prompt text.
  - You can add `%0D%0A` or `%0A` to the prompt text to enforce input newline characters.

- 0.3.0 (2023/03/25)

  - Add Japanese version

- 0.2.0 (2023/03/10)

  - 修復 `autoSubmit=1` 時可能尚未載入 API Key 的問題（會導致被要求登入）

- 0.1.1 (2023/02/28)

  - Add README.md
  - 移除不必要的 console.log 訊息
  - 修正 manifest.json 中顯示作者的名稱

- 0.1.0 (2023/02/26)

  - Initial release
