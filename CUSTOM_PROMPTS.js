let customPrompts = [];
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
    "title": "提升品質",
    "altText": "有時候 ChatGPT 會回答出錯誤、不合邏輯的答案，透過重新審視答案，可以大幅提昇回應品質，提高正確率。",
    "prompt": "你確定你的回答是正確的嗎？請再釐清一次我的問題，重新審視一次你的回答，然後重新回答我。",
    "autoSubmit": true
});
customPrompts.push({
    "enabled": true,
    "title": "總結內容",
    "prompt": "請將我們剛剛的對話總結為一個清單，讓我可以更快的掌握重點。",
    "autoSubmit": true
});

customPrompts.push({
    "enabled": true,
    "title": "提供反思",
    "altText": "反思翻譯的過程，提供更多的想法與翻譯建議。這個步驟可能不只一遍。",
    "prompt": "請仔細審視你的翻譯結果，指出其中不符合中文表達習慣、不通順、不夠信雅達的地方，給我一個專業的翻譯建議。",
    "autoSubmit": true
});

customPrompts.push({
    "enabled": true,
    "title": "重新翻譯",
    "altText": "基於反思與討論翻譯的討論過程，進行一次重新翻譯",
    "prompt": "請基於上面的審視結果，對當初的原文進行重新翻譯，務必做到信、雅、達的境界",
    "autoSubmit": true
});

// customPrompts.push({
//     "enabled": true,
//     "title": "翻成中文",
//     "prompt": "請將上述回應內容翻譯成臺灣常用的正體中文",
//     "autoSubmit": true
// });
// customPrompts.push({
//     "enabled": true,
//     "title": "翻成英文",
//     "prompt": "Please translate the above response into English.",
//     "autoSubmit": true
// });

// customPrompts.push({
//     "enabled": false,
//     "title": "舉例說明",
//     "prompt": "請舉例說明",
//     "autoSubmit": true
// });
// customPrompts.push({
//     "enabled": false,
//     "title": "提供細節",
//     "prompt": "請提供更多細節說明",
//     "autoSubmit": true
// });
// customPrompts.push({
//     "enabled": false,
//     "title": "翻成日文",
//     "prompt": "Please translate the above response into Japanese.",
//     "autoSubmit": true
// });
// customPrompts.push({
//     "enabled": false,
//     "title": "搞笑寫作",
//     "prompt": "請用喜劇演員的口語，將上述的回應重寫一次，讓它變得更有趣。",
//     "autoSubmit": true
// });
// customPrompts.push({
//     "enabled": false,
//     "title": "移除文字",
//     "prompt": "請移除圖片中所有文字",
//     "autoSubmit": true
// });
// customPrompts.push({
//     "enabled": true,
//     "title": "",
//     "prompt": "",
//     "autoSubmit": true
// });
// customPrompts.push({
//     "enabled": true,
//     "title": "",
//     "prompt": "",
//     "autoSubmit": true
// });

localStorage.setItem('chatgpttoolkit.customPrompts', JSON.stringify(customPrompts.filter(prompt => prompt.enabled && !!prompt.title)));