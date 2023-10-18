# ChatGPT 萬能工具箱

提升 ChatGPT 網站的使用體驗，提供一些好用功能。像是自動從 URL 填入提示、在回應的地方出現自動提示按鈕、以及更多好用功能陸續推出。

Chrome 線上應用程式商店: [ChatGPT 萬能工具箱](https://chrome.google.com/webstore/detail/fmijcafgekkphdijpclfgnjhchmiokgp?hl=zh-TW)

## 說明

ChatGPT 萬能工具箱提供 ChatGPT 網站一些好用的額外功能，可以提升 ChatGPT 網站的使用體驗，目前提供的功能有 3 種：

1. 自動從 URL 填入提示：這可以讓你把常用的提示詞(Prompt)透過「書籤」的方式保存下來，並在需要的時候可以快速填入。
2. 在 ChatGPT 回應的地方出現自動提示按鈕，這些常用的提示詞可以透過按鈕自動輸入。
3. 在 ChatGPT 已經提問的文字左側的使用者頭像上按滑鼠左鍵兩下，可以直接編輯提示詞。

以後會陸續推出好用功能，歡迎大家提供想法與建議。

## 使用說明

1. 在網址列加上 `#autoSubmit=1&prompt=你的提示文字`，例如：

    開啟 ChatGPT 網站並填入「你好」且**不會自動送出** (`autoSubmit=0`)

    https://chat.openai.com/chat/#autoSubmit=0&prompt=你好

    開啟 ChatGPT 網站並填入「你好」且**會自動送出** (`autoSubmit=1`)

    https://chat.openai.com/chat/#autoSubmit=1&prompt=你好

2. 設定為 Chrome / Edge 內建搜尋引擎，例如：

    設定方式請參考 [設定預設搜尋引擎和網站搜尋快捷字詞](https://support.google.com/chrome/answer/95426?hl=zh-Hant) 文件！

    設定範例：

    ```txt
    搜尋引擎: ChatGPT
    快捷字詞: g
    以 %s 取代查詢的網址: https://chat.openai.com/chat/#autoSubmit=1&prompt=%s
    ```

    只要在網址列輸入 `g` 再按 Tab 鍵，就會自動開啟 ChatGPT 並自動填入提示文字。

---

# ChatGPT Toolkit

Enhances your ChatGPT experience with useful features like a Auto-Fill prompt text from URL, common prompts after response, and much more.

Chrome Web Store: [ChatGPT Toolkit](https://chrome.google.com/webstore/detail/fmijcafgekkphdijpclfgnjhchmiokgp?hl=en)

## Description

The ChatGPT Toolbox provides some useful additional features for the ChatGPT website, which can enhance the user experience. Currently, 3 features are available:

1. Automatic prompt filling from URL: This allows you to save commonly used prompts as bookmarks and quickly fill them in when needed.
2. Automatic prompt buttons in the ChatGPT response. These commonly used prompts can be automatically entered through a button.
3. You can directly edit the prompt by double-clicking on the user icon of the left side of the user's prompt text.

More useful features will be launched in the future, and everyone is welcome to provide ideas and suggestions.

## Instructions

1. Add `#autoSubmit=1&prompt=your_prompt_text` to the URL bar, for example:

    Open the ChatGPT website and fill in "hello" **without automatically submitting** (`autoSubmit=0`):

    https://chat.openai.com/chat/#autoSubmit=0&prompt=hello

    Open the ChatGPT website and fill in "hello" **with automatic submission** (`autoSubmit=1`):

    https://chat.openai.com/chat/#autoSubmit=1&prompt=hello

2. Set it as the default search engine in Chrome / Edge, for example:

    Refer to the [Set your default search engine & site search shortcuts](https://support.google.com/chrome/answer/95426?hl=en) document for instructions!

    Example settings:

    ```txt
    Search engine: ChatGPT
    Shortcut: g
    URL with %s in place of query: https://chat.openai.com/chat/#autoSubmit=1&prompt=%s
    ```

    Just type `g` in the URL bar and press the Tab key, and ChatGPT will automatically open and fill in the prompt text.
