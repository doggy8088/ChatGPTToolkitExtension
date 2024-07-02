# Changelog

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
