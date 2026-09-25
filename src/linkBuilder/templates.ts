export interface PromptTemplate {
  name: string;
  prompt: string;
}

// The Traditional Chinese list is the original web builder's; the others are adapted so the
// language-related templates ("reply in…", "translate into…") use the reader's language.
const ZH_TW: readonly PromptTemplate[] = [
  { name: '使用正體中文回應', prompt: '請以台灣常用的正體中文回應。' },
  {
    name: '翻譯成正體中文',
    prompt: 'You are a professional translation AI proficient in Chinese and English language. Please help me translate content into Traditional Chinese with Taiwan culture.',
  },
  {
    name: '總結長文內容',
    prompt: 'Please help me summarize content and list the key points. Then translate all the content into Traditional Chinese. No explanations and additional information of the translations are required. Do not add pronunciation annotations.',
  },
  { name: '擴寫文章', prompt: '請幫我擴寫以下文章內容，使其更加詳細、豐富，並保持原有的語氣和風格。' },
  { name: '改寫文章', prompt: '請幫我改寫以下文章，使用不同的表達方式，但保持原意不變。' },
  { name: '修正錯字與文法', prompt: '請幫我檢查並修正以下內容的錯字、標點符號和文法錯誤，並提供修正後的完整內容。' },
  { name: '改寫郵件（專業版）', prompt: '請幫我將以下內容改寫成專業且禮貌的商業郵件格式。' },
  { name: '縮減文字量', prompt: '請幫我將以下內容精簡，保留核心重點，減少不必要的描述。' },
  {
    name: 'Code Review',
    prompt: 'Please review the following code and provide feedback on code quality, potential bugs, performance issues, and best practices. Suggest improvements where necessary.',
  },
  {
    name: '最佳化程式碼',
    prompt: 'Please optimize the following code for better performance, readability, and maintainability. Explain the changes you make.',
  },
  { name: '將 PRD 轉成 Spec', prompt: '請將以下產品需求文件（PRD）轉換為詳細的技術規格文件（Spec），包含系統架構、API 設計、資料模型等技術細節。' },
  { name: '整理會議記錄', prompt: '請幫我整理以下會議記錄，提取重點、決議事項、待辦事項，並以清晰的格式呈現。' },
  { name: '生成測試計畫', prompt: '請根據以下需求或功能描述，生成一份完整的測試計畫，包含測試範圍、測試案例、預期結果等。' },
  { name: '解析 PDF 並總結內容', prompt: '請幫我解析並總結這份文件的主要內容，提取關鍵資訊和重點摘要。' },
];

const EN: readonly PromptTemplate[] = [
  { name: 'Reply in English', prompt: 'Please reply in English.' },
  {
    name: 'Translate into English',
    prompt: 'You are a professional translator. Please translate the following content into natural, fluent English.',
  },
  { name: 'Summarize a long text', prompt: 'Please summarize the following content and list the key points.' },
  {
    name: 'Expand a text',
    prompt: 'Please expand the following text to make it more detailed and richer, while keeping the original tone and style.',
  },
  { name: 'Rewrite a text', prompt: 'Please rewrite the following text using different wording while keeping the original meaning.' },
  {
    name: 'Fix typos and grammar',
    prompt: 'Please check the following text for typos, punctuation and grammar mistakes, and provide the corrected full text.',
  },
  { name: 'Rewrite as a business email', prompt: 'Please rewrite the following as a professional and polite business email.' },
  { name: 'Make it shorter', prompt: 'Please condense the following text, keeping the key points and removing unnecessary details.' },
  {
    name: 'Code review',
    prompt: 'Please review the following code and provide feedback on code quality, potential bugs, performance issues, and best practices. Suggest improvements where necessary.',
  },
  {
    name: 'Optimize code',
    prompt: 'Please optimize the following code for better performance, readability, and maintainability. Explain the changes you make.',
  },
  {
    name: 'Turn a PRD into a spec',
    prompt: 'Please convert the following product requirements document (PRD) into a detailed technical specification, including the system architecture, API design and data models.',
  },
  {
    name: 'Organize meeting notes',
    prompt: 'Please organize the following meeting notes into key points, decisions and action items, in a clear format.',
  },
  {
    name: 'Create a test plan',
    prompt: 'Based on the following requirements or feature description, please create a complete test plan, including the scope, test cases and expected results.',
  },
  {
    name: 'Summarize a PDF',
    prompt: 'Please analyze and summarize the main content of this document, and extract the key information and highlights.',
  },
];

const JA: readonly PromptTemplate[] = [
  { name: '日本語で回答', prompt: '日本語で回答してください。' },
  { name: '日本語に翻訳', prompt: 'あなたはプロの翻訳者です。以下の内容を自然で読みやすい日本語に翻訳してください。' },
  { name: '長文を要約', prompt: '以下の内容を要約し、要点を箇条書きでまとめてください。' },
  { name: '文章を膨らませる', prompt: '以下の文章を、元の語調とスタイルを保ったまま、より詳しく豊かな内容に書き広げてください。' },
  { name: '文章を書き換える', prompt: '以下の文章を、意味を変えずに別の表現で書き換えてください。' },
  { name: '誤字と文法を修正', prompt: '以下の内容の誤字、句読点、文法の誤りを確認して修正し、修正後の全文を示してください。' },
  { name: 'ビジネスメールに書き換え', prompt: '以下の内容を、丁寧でプロフェッショナルなビジネスメールに書き換えてください。' },
  { name: '文章を短くする', prompt: '以下の内容を、要点を残して不要な説明を省き、簡潔にまとめてください。' },
  {
    name: 'コードレビュー',
    prompt: '以下のコードをレビューし、コード品質、潜在的なバグ、パフォーマンスの問題、ベストプラクティスの観点からフィードバックしてください。必要に応じて改善案も示してください。',
  },
  { name: 'コードを最適化', prompt: '以下のコードを、パフォーマンス・可読性・保守性の観点から最適化し、変更点を説明してください。' },
  {
    name: 'PRD を仕様書に変換',
    prompt: '以下の製品要求仕様書（PRD）を、システム構成、API 設計、データモデルなどの技術的な詳細を含む技術仕様書に変換してください。',
  },
  { name: '議事録を整理', prompt: '以下の議事録を整理し、要点・決定事項・ToDo を分かりやすい形式でまとめてください。' },
  { name: 'テスト計画を作成', prompt: '以下の要件または機能の説明をもとに、テスト範囲、テストケース、期待結果を含むテスト計画を作成してください。' },
  { name: 'PDF を要約', prompt: 'このドキュメントの主な内容を分析して要約し、重要な情報と要点を抽出してください。' },
];

/**
 * Templates in the language of the extension's messages (`options_lang_tag`: `zh-Hant-TW`, `ja`, `en`).
 */
export function getPromptTemplates(langTag: string): readonly PromptTemplate[] {
  const lang = langTag.toLowerCase();
  if (lang.startsWith('zh')) return ZH_TW;
  if (lang.startsWith('ja')) return JA;
  return EN;
}
