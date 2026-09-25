export {};

declare global {
  /**
   * `scripts/content-utils.js`: the URL prompt codec. Loaded as a classic script before the content
   * script (manifest.json) and before the link builder bundle (link-builder.html).
   */
  interface ChatGPTToolkitContentUtils {
    b64EncodeUnicode: (str: string) => string;
    isBase64Unicode: (str: string) => boolean;
    /** The `prompt=` value exactly as the content script reads it (decoded, trimmed, line breaks normalized). */
    flexiblePromptDetection: (hash: string, locationSearch: string) => string | null;
    parseToolkitHash: (
      hash: string,
      locationSearch: string
    ) => {
      prompt: string | null;
      autoSubmit: boolean;
      pasteImage: boolean;
      tool: string;
    };
  }

  interface Window {
    ChatGPTToolkitContentUtils?: ChatGPTToolkitContentUtils;
  }
}
