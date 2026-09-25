# Changelog

- 0.47.1 (2026/09/25)

  - Chore
    - 將擴充套件版本由 `0.47.0` 升級為 `0.47.1`。
    - 同步更新 `options.html` 與 `link-builder.html` 頁尾顯示版本為 `0.47.1`。
    - 新增 `contextMenus` 權限（用於工具列圖示的右鍵選單，不會顯示權限警告）。
    - 選項頁與提示連結產生器共用 `styles/common.css` 設計樣式，頁面直接載入、不需建置；Service Worker 改以 TypeScript 撰寫（`src/background/`），建置輸出 `scripts/background.js`。
    - 提示連結產生器的頁面腳本輸出到 `scripts/link-builder.js` 並納入版控，未重新建置的開發環境也能正常使用；發佈封裝加入 `link-builder.html` 與 `styles/`。
    - 新增提示連結產生器、右鍵選單、頁面資源等測試（共 233 個 Bun 測試）。

  - New features
    - 整併「提示連結產生器」到擴充套件：在工具列的擴充套件圖示上按滑鼠右鍵，選擇「開啟提示連結產生器」即可開啟（已開啟時會切換到該分頁）。
      - 支援 ChatGPT、ChatGPT Images、Claude、Gemini、Groq、Perplexity 與自訂網址（例如 GPTs）。
      - 內建提示範本庫（依介面語言提供），套用後自動命名連結並可復原；提供 `%s` 插入按鈕。
      - 依各網站支援的功能，自動停用「貼上剪貼簿中的圖片」與「使用圖片生成工具」並說明原因，連結也不會帶入不支援的參數。
      - 即時預覽書籤，可直接拖曳到瀏覽器的書籤列；一鍵複製網址或 Markdown 連結。
      - 網址列搜尋捷徑設定引導，並可一鍵開啟 Chrome 的搜尋引擎設定頁。
      - 可匯入既有的提示連結、Markdown 連結或舊版網頁「提示連結產生器」的分享連結繼續編輯。
      - 支援系統／淺色／深色主題（預設跟隨系統，與選項頁共用設定），介面支援正體中文、英文與日文。

  - Bug fixes
    - None

  - Breaking changes
    - None

- 0.47.0 (2026/09/25)

  - Chore
    - 將擴充套件版本由 `0.46.0` 升級為 `0.47.0`。
    - 同步更新 `options.html` 頁尾顯示版本為 `0.47.0`。
    - 移除未被引用的舊版選項頁腳本 `options.js`，以及 ChatGPT 模組中已失效的 Ctrl+Enter 送出編輯、「繼續生成」自動點擊等程式碼。
    - 合併 ChatGPT 與 Gemini 重複的提示詞 helper 至 `src/content/prompts.ts`；新增選項頁與內容腳本共用的 `src/shared/promptMigrations.ts`。
    - 效能改善：頁面變動監聽只追蹤必要屬性並改為 150ms 節流；初始按鈕不再於每次頁面變動時清空重建；心智圖改為直接查詢程式碼區塊；常駐計時器改為按需啟動。
    - 新增依 ChatGPT 新版 DOM 建模的測試，以及選項頁端對端與多項單元測試（共 154 個 Bun 測試）。

  - New features
    - 支援 ChatGPT 2026 年 9 月改版後的新介面（登入版 app shell），並保留舊版介面的相容處理：
      - 初始按鈕樣式改為跟隨頁面文字顏色，淺色與深色主題皆清楚可讀。
      - 追問按鈕改為顯示在回覆的「複製／重新產生」操作列下方，且只在回覆完成後出現。
      - 心智圖按鈕支援新版程式碼區塊，按鈕文字支援多語系。
    - 選項頁全面重新設計：
      - 新增系統／淺色／深色主題切換，預設跟隨系統，並於載入時避免閃爍。
      - 「初始按鈕」與「追問按鈕」改為附出現位置示意圖的類型卡片，並以綠色／靛藍區分兩組。
      - 編輯對話框改為雙欄配置，筆電等較矮的螢幕也能直接看到所有開關；新增「按鈕類型」選擇器，可將提示詞移到另一組。
      - 提示詞預覽以「貼上內容」標示插入位置，與「自動貼上」設定清楚區分。
      - 新增提示詞搜尋、卡片內直接啟用／停用、匯入時的「選擇檔案」按鈕，以及未儲存變更的離開確認。
    - 日文介面的「追問ボタン」改為「フォローアップボタン」。

  - Bug fixes
    - 修正 ChatGPT 改版後，深色主題下初始按鈕文字幾乎看不見的問題。
    - 修正 ChatGPT 改版後，回覆下方完全不出現追問按鈕的問題。
    - 修正雙擊自己的訊息時觸發「複製」而非「編輯」的問題。
    - 修正按鈕可能把提示詞填入行內編輯表單、或誤按編輯表單的送出鈕的問題。
    - 修正心智圖切回原文時以 `innerHTML` 寫入文字（Markdown 內的 HTML 會被渲染）、關閉時未釋放心智圖與事件監聽器累加的問題。
    - 修正沒有提示文字的追問按鈕顯示「undefined」工具提示。
    - 修正刪除「評論」初始提示詞後，每次載入又被自動加回的問題（遷移改為只執行一次；以前刪除過的使用者，升級後會最後一次被加回，之後刪除即會保留）。
    - 修正 Gemini 初始按鈕列被頁面移除後重建成空白列的問題。
    - 修正選項頁「還原預設值」為淺拷貝，之後的操作會改動預設值本身的問題。
    - 修正選項頁圖示欄位以原始 HTML 插入的問題（一般文字改為純文字，SVG 經過淨化）。
    - 修正匯入含 `null` 或非物件項目時崩潰，並提供指出錯誤項目的訊息。
    - 修正儲存失敗後重試會產生重複項目、只含空白的標題可通過驗證、編輯時遺失未知欄位等問題。
    - 修正匯出檔下載時立即撤銷 object URL，以及拖放檔案到頁面其他位置會離開頁面的問題。

  - Breaking changes
    - None

- 0.46.0 (2026/09/11)

  - Chore
    - 將擴充套件版本由 `0.45.0` 升級為 `0.46.0`。
    - 同步更新 `options.html` 頁尾顯示版本為 `0.46.0`。

  - New features
    - None

  - Bug fixes
    - 修正 ChatGPT 初始按鈕出現在非首頁頁面（例如 Project 頁面 `/g/g-p-…/project`），與頁面原有標題及操作按鈕重疊、影響原生功能操作的問題：
      - 初始按鈕的顯示判斷由「排除清單」改為「白名單」，僅在 ChatGPT 首頁（路徑為 `/`）顯示初始按鈕。
      - 其餘所有頁面（Project、GPTs、`/gpts`、`/library`、`/codex`、`/scheduled`、`/deep-research` 等）一律不注入初始按鈕；若因頁面切換（SPA 導航）殘留舊的按鈕列，也會自動移除並還原標題位移。
      - 追問按鈕（follow-up buttons）與 Gemini 的初始按鈕行為不受此變更影響。
      - 補強測試：新增 Project、GPTs、Library、Codex 等非根路徑頁面的測試案例，確保初始按鈕不會被注入。

  - Breaking changes
    - None

- 0.45.0 (2026/07/03)

  - Chore
    - 將擴充套件版本由 `0.44.4` 升級為 `0.45.0`。
    - 同步更新 `options.html` 頁尾顯示版本為 `0.45.0`。
    - 縮短 `{{args}}` tooltip 的多語系說明文字。

  - New features
    - 調整自動貼上啟用時的 `{{args}}` 取值邏輯：
      - 若輸入框已有內容，優先以既有輸入內容取代 `{{args}}`，不讀取剪貼簿。
      - 若輸入框為空，才以剪貼簿內容取代 `{{args}}`。
    - 在提示詞編輯器的 `{{args}}` 插入按鈕加入本地化 tooltip，說明取代來源。

  - Bug fixes
    - None

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
