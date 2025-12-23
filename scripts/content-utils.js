(function (root, factory) {
    "use strict";

    // UMD wrapper:
    // - Browser (content script): attaches to `window.ChatGPTToolkitContentUtils`
    // - Node (unit tests): `module.exports = ...`
    if (typeof module === "object" && typeof module.exports === "object") {
        module.exports = factory();
    } else {
        root.ChatGPTToolkitContentUtils = factory();
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    /**
     * Base64 helpers that work in both Browser and Node.
     *
     * Note:
     * - In browsers we prefer `atob`/`btoa`.
     * - In Node we fall back to `Buffer`.
     * - We intentionally validate padding/length in Node to mimic `atob` throwing.
     */
    function base64EncodeBytes(bytes) {
        if (typeof btoa === "function") {
            let binary = "";
            for (const byte of bytes) binary += String.fromCharCode(byte);
            return btoa(binary);
        }

        // Node fallback
        // eslint-disable-next-line no-undef
        return Buffer.from(bytes).toString("base64");
    }

    function base64DecodeToBytes(base64) {
        if (typeof atob === "function") {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return bytes;
        }

        // Node fallback (try to mimic browser `atob` strictness)
        // `atob` throws when the length isn't a multiple of 4.
        if (base64.length % 4 !== 0) {
            throw new Error("InvalidCharacterError: The string to be decoded is not correctly encoded.");
        }

        // eslint-disable-next-line no-undef
        return new Uint8Array(Buffer.from(base64, "base64"));
    }

    function b64EncodeUnicode(str) {
        const bytes = new TextEncoder().encode(str);
        return base64EncodeBytes(bytes);
    }

    function b64DecodeUnicode(str) {
        const bytes = base64DecodeToBytes(str);
        return new TextDecoder().decode(bytes);
    }

    function isBase64Unicode(str) {
        // Base64編碼後的字串僅包含 A-Z、a-z、0-9、+、/、= 這些字元
        const base64Regex = /^[\w\+\/=]+$/;
        if (!base64Regex.test(str)) return false;

        // keep the original heuristic: too short is unlikely to be our encoded payload
        if (str.length < 32) return false;

        try {
            const bytes = base64DecodeToBytes(str);

            // 解碼後的字串應該是合法的 UTF-8 序列
            // 使用 TextDecoder 檢查是否可以成功解碼為 Unicode 字串
            // Note: keep the original behavior (no `fatal: true`) to avoid throwing on malformed UTF-8.
            const decoder = new TextDecoder("utf-8");
            decoder.decode(bytes);

            // 如果沒有拋出異常，則表示是合法的 Base64Unicode 編碼字串
            return true;
        } catch (e) {
            // 解碼失敗，則不是合法的 Base64Unicode 編碼字串
            return false;
        }
    }

    // 取得 URI 查詢字串中的參數值
    function getUriComponent(segment, name) {
        const idx = segment.indexOf("=");
        if (idx === -1) return;

        const key = segment.substring(0, idx);
        const val = segment.substring(idx + 1);

        if (!key || !val) return;

        if (key === name) {
            return val;
        }
    }

    // 為了相容於一開始的設計，怕使用者傳入不合格式的 prompt 內容，所以要特殊處理
    function flexiblePromptDetection(hash, locationSearch) {
        let prompt = "";

        // 找到 prompt= 的位置 (假設 prompt 參數總是在最後一位)
        const promptIndex = hash.indexOf("prompt=");

        if (promptIndex === -1) {
            // 沒有找到 prompt 參數
            return null;
        }

        if (promptIndex === 0) {
            prompt = getUriComponent(hash, "prompt");
        } else {
            // prompt 不是第一個參數（假設在最後），從 prompt= 開始提取
            prompt = hash.substring(promptIndex + "prompt".length + 1);
        }

        // 沒有 prompt 就不處理了
        if (!prompt) return null;

        // 因為 Chrome 的 Site search 在使用者輸入 %s 內容時，會自動判斷要用哪一種編碼方式
        // 如果有 Query String 的話，他會自動用 encodeURIComponent 進行編碼
        // 如果沒有 Query String 的話，他會自動用 encodeURI 進行編碼。
        // 這個 encodeURI 方法不會對某些保留的字元進行編碼，例如 ";", "/", "?", ":", "@", "&", "=", "+", "$", 和 "#"。
        // 因此我們要特別處理這個狀況！
        if (locationSearch === "") {
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
        prompt = prompt.replace(/\+/g, "%20");

        // 正式取得 prompt 參數的內容
        prompt = decodeURIComponent(prompt);

        // 正規化 prompt 內容，移除多餘的空白與換行字元
        prompt = prompt.replace(/\r/g, "").replace(/\n{3,}/sg, "\n\n").replace(/^\s+/sg, "");

        if (!prompt) return null;

        return prompt;
    }

    /**
     * Parse the extension hash parameters used by this content script.
     *
     * Important behavior notes (kept intentionally):
     * - `flexiblePromptDetection(hash)` can override `URLSearchParams.get('prompt')` even when hash is ill-formed.
     * - If `prompt` looks like Base64Unicode, we decode it *after* flexible prompt parsing, and we do not re-normalize.
     */
    function parseToolkitHash(hash, locationSearch) {
        const qs = new URLSearchParams(hash);

        let prompt = qs.get("prompt");
        const autoSubmit = qs.get("autoSubmit") === "1" || qs.get("autoSubmit") === "true";
        const pasteImage = qs.get("pasteImage") === "1" || qs.get("pasteImage") === "true";
        const tool = (qs.get("tool") || "").toLowerCase();

        // 為了處理一些不合規定的 prompt 參數，所以要實作客製化的參數解析邏輯
        prompt = flexiblePromptDetection(hash, locationSearch) || prompt;

        // 如果 prompt 內容為 Base64Unicode 編碼字串，則解碼為 Unicode 字串
        if (!!prompt && isBase64Unicode(prompt)) {
            prompt = b64DecodeUnicode(prompt);
        }

        return {
            prompt,
            autoSubmit,
            pasteImage,
            tool,
        };
    }

    return {
        b64EncodeUnicode,
        b64DecodeUnicode,
        isBase64Unicode,
        getUriComponent,
        flexiblePromptDetection,
        parseToolkitHash,
    };
});

