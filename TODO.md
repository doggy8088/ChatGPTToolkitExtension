# TODO

1. 在 `customPrompts` 加入**情境** (context) 參數，可以判斷目前是在什麼位置顯示按鈕？

    `all`: 所有地方都要出現的按鈕

    `image`: 在編輯圖片時出現的按鈕

    `dataanalysis`: 在資料分析時出現的按鈕

2. 替按鈕加入「編輯後送出」功能

    設計有些**自訂按鈕**不會送出新的 Prompt，而是將最近一次的 Prompt 調整後透過「編輯」的方式再次送出，避免出現太多不必要的上下文。

3. 加入 Agentic Workflow 的功能

    直接整合一些好用 Workflow 功能，可以在 ChatGPT 模擬「代理人」機制！

4. 在每次提問的右邊新增 `Share` 按鈕，可以將目前的 Prompt 分享為 `ChatGPT Toolkit` 可以自動填入的網址。

    預設將設定為「不自動送出」(`#autoSubmit=0`)

    Icon: https://fonts.google.com/icons?icon.query=copy

    Icon SVG:

    ```xml
    <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 96 960 960" width="16"><path d="M180 975q-24 0-42-18t-18-42V312h60v603h474v60H180Zm120-120q-24 0-42-18t-18-42V235q0-24 18-42t42-18h440q24 0 42 18t18 42v560q0 24-18 42t-42 18H300Zm0-60h440V235H300v560Zm0 0V235v560Z"/></svg>
    ```
