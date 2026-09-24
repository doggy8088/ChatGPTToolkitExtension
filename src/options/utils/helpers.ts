/**
 * Delay before revoking a download's object URL. Revoking synchronously right after `click()` can
 * cancel the download before the browser has started reading the blob.
 */
export const OBJECT_URL_REVOKE_DELAY_MS = 1000;

/**
 * Download data as a file.
 */
export function downloadFile(
  data: string,
  filename: string,
  mimeType: string,
  revokeDelayMs: number = OBJECT_URL_REVOKE_DELAY_MS
): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), revokeDelayMs);
  }
}
