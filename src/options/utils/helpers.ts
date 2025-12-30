/**
 * Helper function to safely get property with default value
 * Returns the property value if it exists (even if undefined), otherwise returns defaultValue
 */
export function getProperty<T, K extends keyof T, D>(
  obj: T,
  key: K,
  defaultValue: D
): T[K] | D {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : defaultValue;
}

/**
 * Escape HTML to prevent XSS (efficient character replacement)
 */
export function escapeHtml(text: string | undefined | null): string {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char] || char));
}

/**
 * Download data as a file
 */
export function downloadFile(data: string, filename: string, mimeType: string): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
