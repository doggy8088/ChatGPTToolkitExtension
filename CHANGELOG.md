# Changelog

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
