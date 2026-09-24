import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { downloadFile } from '../src/options/utils/helpers';
import { ensureHappyDom } from './utils/happyDom';

ensureHappyDom();

describe('helpers', () => {
  describe('downloadFile', () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;

    let revoked: string[] = [];
    let clicks: Array<{ href: string; download: string; connected: boolean }> = [];
    let blobs: Blob[] = [];
    let urlCounter = 0;
    const lastUrl = () => `blob:test-${urlCounter}`;

    beforeEach(() => {
      revoked = [];
      clicks = [];
      blobs = [];
      URL.createObjectURL = ((blob: Blob) => {
        blobs.push(blob);
        urlCounter += 1;
        return lastUrl();
      }) as typeof URL.createObjectURL;
      URL.revokeObjectURL = ((url: string) => {
        revoked.push(url);
      }) as typeof URL.revokeObjectURL;
      HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
        clicks.push({ href: this.getAttribute('href') || '', download: this.download, connected: this.isConnected });
      };
    });

    afterEach(() => {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      HTMLAnchorElement.prototype.click = originalClick;
    });

    test('clicks an attached anchor with the file name and removes it afterwards', () => {
      downloadFile('[]', 'prompts.json', 'application/json', 5);

      expect(clicks).toEqual([{ href: lastUrl(), download: 'prompts.json', connected: true }]);
      expect(document.querySelector('a[download]')).toBeNull();
      expect(blobs[0].type).toBe('application/json');
    });

    test('defers revoking the object URL until after the download started', async () => {
      downloadFile('{"a":1}', 'data.json', 'application/json', 5);
      const url = lastUrl();
      expect(revoked).not.toContain(url);

      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(revoked).toContain(url);
    });

    test('writes the provided data into the blob', async () => {
      downloadFile('hello', 'a.txt', 'text/plain', 5);
      expect(await blobs[0].text()).toBe('hello');
    });
  });
});
