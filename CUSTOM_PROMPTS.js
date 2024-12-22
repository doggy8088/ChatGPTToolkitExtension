let customPrompts = [];

// --- Initial Buttons ---

customPrompts.push({
    "enabled": true,
    "initial": true,
    // "svgIcon": "<svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' class='icon-md' style='color: rgb(226, 197, 65);'><path fill-rule='evenodd' clip-rule='evenodd' d='M12 3C8.41496 3 5.5 5.92254 5.5 9.53846C5.5 11.8211 6.662 13.8298 8.42476 15H15.5752C17.338 13.8298 18.5 11.8211 18.5 9.53846C18.5 5.92254 15.585 3 12 3ZM14.8653 17H9.13473V18H14.8653V17ZM13.7324 20H10.2676C10.6134 20.5978 11.2597 21 12 21C12.7403 21 13.3866 20.5978 13.7324 20ZM8.12601 20C8.57004 21.7252 10.1361 23 12 23C13.8639 23 15.43 21.7252 15.874 20C16.4223 19.9953 16.8653 19.5494 16.8653 19V16.5407C19.0622 14.9976 20.5 12.4362 20.5 9.53846C20.5 4.82763 16.6992 1 12 1C7.30076 1 3.5 4.82763 3.5 9.53846C3.5 12.4362 4.93784 14.9976 7.13473 16.5407V19C7.13473 19.5494 7.57774 19.9953 8.12601 20Z' fill='currentColor'></path></svg>",
    "svgIcon": "📝",
    "title": "記事",
    "altText": "用來記錄手邊的筆記，但不需要 ChatGPT 回答。",
    "prompt": "除非我詢問你問題，否則請回答我 OK 即可",
    "autoSubmit": true
});

customPrompts.push({
    "enabled": true,
    "initial": true,
    "svgIcon": "🍥",
    "title": "總結",
    "altText": "用來總結輸入的大量文字",
    "prompt": "Please identify the main discussion points, decisions, and action items from my text below and provide a concise bulleted summary in #zh-tw:\n\n",
    "autoPaste": true,
    "autoSubmit": true
});

customPrompts.push({
    "enabled": true,
    "initial": true,
    "svgIcon": "👩‍🏫",
    "title": "解釋",
    "altText": "解釋某個名詞、概念或程式碼",
    "prompt": "請詳加解釋以下內容:\r\n\r\n",
    "autoPaste": true,
    "autoSubmit": false
});

customPrompts.push({
    "enabled": true,
    "initial": true,
    // "svgIcon": "<svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' class='icon-md' style='color: rgb(226, 197, 65);'><path fill-rule='evenodd' clip-rule='evenodd' d='M12 3C8.41496 3 5.5 5.92254 5.5 9.53846C5.5 11.8211 6.662 13.8298 8.42476 15H15.5752C17.338 13.8298 18.5 11.8211 18.5 9.53846C18.5 5.92254 15.585 3 12 3ZM14.8653 17H9.13473V18H14.8653V17ZM13.7324 20H10.2676C10.6134 20.5978 11.2597 21 12 21C12.7403 21 13.3866 20.5978 13.7324 20ZM8.12601 20C8.57004 21.7252 10.1361 23 12 23C13.8639 23 15.43 21.7252 15.874 20C16.4223 19.9953 16.8653 19.5494 16.8653 19V16.5407C19.0622 14.9976 20.5 12.4362 20.5 9.53846C20.5 4.82763 16.6992 1 12 1C7.30076 1 3.5 4.82763 3.5 9.53846C3.5 12.4362 4.93784 14.9976 7.13473 16.5407V19C7.13473 19.5494 7.57774 19.9953 8.12601 20Z' fill='currentColor'></path></svg>",
    "svgIcon": "📚",
    "title": "翻成中文",
    "altText": "翻譯內容為中文",
    "prompt": "翻譯以下內容為正體中文:\r\n\r\n",
    "autoPaste": true,
    "autoSubmit": false
});

customPrompts.push({
    "enabled": true,
    "initial": true,
    // "svgIcon": "<svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' class='icon-md' style='color: rgb(226, 197, 65);'><path fill-rule='evenodd' clip-rule='evenodd' d='M12 3C8.41496 3 5.5 5.92254 5.5 9.53846C5.5 11.8211 6.662 13.8298 8.42476 15H15.5752C17.338 13.8298 18.5 11.8211 18.5 9.53846C18.5 5.92254 15.585 3 12 3ZM14.8653 17H9.13473V18H14.8653V17ZM13.7324 20H10.2676C10.6134 20.5978 11.2597 21 12 21C12.7403 21 13.3866 20.5978 13.7324 20ZM8.12601 20C8.57004 21.7252 10.1361 23 12 23C13.8639 23 15.43 21.7252 15.874 20C16.4223 19.9953 16.8653 19.5494 16.8653 19V16.5407C19.0622 14.9976 20.5 12.4362 20.5 9.53846C20.5 4.82763 16.6992 1 12 1C7.30076 1 3.5 4.82763 3.5 9.53846C3.5 12.4362 4.93784 14.9976 7.13473 16.5407V19C7.13473 19.5494 7.57774 19.9953 8.12601 20Z' fill='currentColor'></path></svg>",
    "svgIcon": "📚",
    "title": "翻為英文",
    "altText": "翻譯內容為英文",
    "prompt": "翻譯以下內容為英文:\r\n\r\n",
    "autoPaste": true,
    "autoSubmit": false
});

// --- Follow-up Buttons ---

customPrompts.push({
    "enabled": true,
    "title": "記事",
    "altText": "用來記錄手邊的筆記，但不需要 ChatGPT 回答。",
    "prompt": "請幫我記錄以下內容，僅需回答我 OK 即可：\r\n\r\n",
    "autoSubmit": false
});
customPrompts.push({
    "enabled": true,
    "title": "繼續",
    "altText": "如果你覺得這個對話尚未完成，可以按下繼續。",
    "prompt": "繼續",
    "autoSubmit": true
});
customPrompts.push({
    "enabled": true,
    "title": "品質",
    "altText": "有時候 ChatGPT 會回答出錯誤、不合邏輯的答案，透過重新審視答案，可以大幅提昇回應品質，提高正確率。",
    "prompt": "你確定你的回答是正確的嗎？請再釐清一次我的問題，重新審視一次你的回答，然後重新回答我。",
    "autoSubmit": true
});
customPrompts.push({
    "enabled": true,
    "title": "總結",
    "prompt": "請將我們剛剛的對話總結為一個清單，讓我可以更快的掌握重點。",
    "autoSubmit": true
});

customPrompts.push({
    "enabled": true,
    "title": "反思",
    "altText": "反思翻譯的過程，提供更多的想法與翻譯建議。這個步驟可能不只一遍。",
    "prompt": "請仔細審視你的翻譯結果，指出其中不符合中文表達習慣、不通順、不夠信雅達的地方，給我一個專業的翻譯建議。",
    "autoSubmit": true
});

customPrompts.push({
    "enabled": true,
    "title": "重翻",
    "altText": "基於反思與討論翻譯的討論過程，進行一次重新翻譯",
    "prompt": "請基於上面的審視結果，對當初的原文進行重新翻譯，務必做到信、雅、達的境界",
    "autoSubmit": true
});

customPrompts.push({
    "enabled": true,
    "title": "翻中",
    "altText": "將上述內容翻譯為中文",
    "prompt": "將上述內容翻譯為正體中文",
    "autoSubmit": true
});

customPrompts.push({
    "enabled": true,
    "title": "翻英",
    "altText": "Please translate the message into English",
    "prompt": "Please translate the message into English",
    "autoSubmit": true
});

customPrompts.push({
    "enabled": true,
    "title": "臉書",
    "altText": "撰寫臉書貼文",
    "prompt": "請將上述內容整理成一段用來分享到臉書的文案，內容要以記者的角度來報導這些內容，擷取精華的知識，並且分享給粉絲們，語氣上要輕鬆自在，適當的幽默更好。",
    "autoSubmit": true
});

customPrompts.push({
    "enabled": true,
    "title": "短點",
    "altText": "將內容縮少一點",
    "prompt": "再寫少一點文字",
    "autoSubmit": true
});

customPrompts.push({
    "enabled": true,
    "title": "長點",
    "altText": "將內容多寫一點",
    "prompt": "再寫多一點文字",
    "autoSubmit": true
});

customPrompts.push({
    "enabled": true,
    "title": "重寫",
    "altText": "換個語氣重寫文案",
    "prompt": "請隨意換個語氣重寫文案",
    "autoSubmit": true
});

// customPrompts.push({
//     "enabled": true,
//     "title": "心智圖(mermaid)",
//     "altText": "依據上述內容生成一份 mermaid 格式的心智圖",
//     "prompt": "請幫我依據上述內容生成一份 mermaid 格式的心智圖，將內容放入 markdown code fence，最後提供 https://mermaid.live/ 這個網址讓我可以快速預覽結果",
//     "autoSubmit": true
// });

customPrompts.push({
    "enabled": true,
    "title": "心智圖(markmap)",
    "altText": "依據上述內容生成一份 markmap 格式的心智圖",
    "prompt": "請幫我依據上述內容生成一份心智圖的結構，並用 Markdown 格式輸出，最後將內容放入 markdown code fence，最後提供 https://markmap.js.org/repl 這個網址讓我可以快速預覽結果",
    "autoSubmit": true
});

localStorage.setItem('chatgpttoolkit.customPrompts', JSON.stringify(customPrompts.filter(prompt => prompt.enabled && !!prompt.title)));