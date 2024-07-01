let customPrompts = [];
customPrompts.push({
    "enabled": true,
    "title": "提供反思",
    "altText": "",
    "prompt": "Your task is to carefully read a source text and a translation from English to Traditional Chinese, and then give constructive criticism and helpful suggestions to improve the translation. The final style and tone of the translation should match the style of Traditional Chinese colloquially spoken in Taiwan. When writing suggestions, pay attention to whether there are ways to improve the translation's \n(i) accuracy (by correcting errors of addition, mistranslation, omission, or untranslated text),\n(ii) fluency (by applying Traditional Chinese grammar, spelling and punctuation rules, and ensuring there are no unnecessary repetitions),\n(iii) style (by ensuring the translations reflect the style of the source text and takes into account any cultural context),\n(iv) terminology (by ensuring terminology use is consistent and reflects the source text domain; and by only ensuring you use equivalent idioms Traditional Chinese).\nWrite a list of specific, helpful and constructive suggestions for improving the translation. Each suggestion should address one specific part of the translation. Output only the suggestions and nothing else.",
    "autoSubmit": true
});
customPrompts.push({
    "enabled": true,
    "title": "優化回應",
    "altText": "",
    "prompt": "Please take into account the expert suggestions when editing the translation. Edit the translation by ensuring:\n\n(i) accuracy (by correcting errors of addition, mistranslation, omission, or untranslated text),\n(ii) fluency (by applying {target_lang} grammar, spelling and punctuation rules and ensuring there are no unnecessary repetitions),\n(iii) style (by ensuring the translations reflect the style of the source text)\n(iv) terminology (inappropriate for context, inconsistent use), or\n(v) other errors.\n\nOutput only the new translation and nothing else.",
    "autoSubmit": true
});

customPrompts.push({
    "enabled": false,
    "title": "提升品質",
    "altText": "有時候 ChatGPT 會回答出錯誤、不合邏輯的答案，透過重新審視答案，可以大幅提昇回應品質，提高正確率。",
    "prompt": "請再審視一次你的回答，你確定你寫的是正確的嗎？",
    "autoSubmit": true
});
customPrompts.push({
    "enabled": true,
    "title": "總結內容",
    "prompt": "請將我們剛剛的對話總結為一個清單，讓我可以更快的掌握重點。",
    "autoSubmit": true
});
customPrompts.push({
    "enabled": false,
    "title": "舉例說明",
    "prompt": "請舉例說明",
    "autoSubmit": true
});
customPrompts.push({
    "enabled": false,
    "title": "提供細節",
    "prompt": "請提供更多細節說明",
    "autoSubmit": true
});
customPrompts.push({
    "enabled": true,
    "title": "翻成中文",
    "prompt": "請將上述回應內容翻譯成臺灣常用的正體中文",
    "autoSubmit": true
});
customPrompts.push({
    "enabled": true,
    "title": "翻成英文",
    "prompt": "Please translate the above response into English.",
    "autoSubmit": true
});
customPrompts.push({
    "enabled": false,
    "title": "翻成日文",
    "prompt": "Please translate the above response into Japanese.",
    "autoSubmit": true
});
customPrompts.push({
    "enabled": false,
    "title": "搞笑寫作",
    "prompt": "請用喜劇演員的口語，將上述的回應重寫一次，讓它變得更有趣。",
    "autoSubmit": true
});
customPrompts.push({
    "enabled": false,
    "title": "移除文字",
    "prompt": "請移除圖片中所有文字",
    "autoSubmit": true
});
customPrompts.push({
    "enabled": true,
    "title": "",
    "prompt": "",
    "autoSubmit": true
});
customPrompts.push({
    "enabled": true,
    "title": "",
    "prompt": "",
    "autoSubmit": true
});

localStorage.setItem('chatgpttoolkit.customPrompts', JSON.stringify(customPrompts.filter(prompt => prompt.enabled && !!prompt.title)));