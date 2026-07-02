export function extractPromptEditorText(editor: HTMLElement | null): string {
  if (!editor) return '';
  if (editor instanceof HTMLTextAreaElement) return editor.value;

  const paragraphs = Array.from(editor.querySelectorAll<HTMLElement>('p'));
  if (paragraphs.length) {
    return paragraphs.map((paragraph) => extractTextPreservingBreaks(paragraph)).join('\n');
  }

  return editor.innerText || extractTextPreservingBreaks(editor) || editor.textContent || '';
}

function extractTextPreservingBreaks(element: HTMLElement): string {
  const parts: string[] = [];

  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent || '');
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if ((node as Element).tagName === 'BR') {
      parts.push('\n');
      return;
    }

    node.childNodes.forEach(visit);
  }

  visit(element);
  return parts.join('');
}
