import {test, expect, openPad, activate} from '../utils';

test.describe('ep_webrtc media errors', () => {
  for (const [name, message] of [
    ['NotAllowedError', 'Failed to get permission to access'],
    ['NotFoundError', 'Failed to access'],
    ['NotReadableError', 'hardware error occurred'],
    ['AbortError', 'not a hardware error'],
  ]) {
    test(name, async ({page}) => {
      await openPad(page, {av: false, webrtcaudioenabled: false, webrtcvideoenabled: false});
      await activate(page);
      await page.evaluate((name) => {
        const win = window as any;
        win.$.gritter.removeAll({fade: false});
        navigator.mediaDevices.getUserMedia = async () => {
          const error = new Error();
          error.name = name;
          throw error;
        };
      }, name);
      await page.locator('.video-btn').click();
      await expect(page.locator('.gritter-title')).toHaveText('Error');
      await expect(page.locator('.gritter-content')).toContainText(message);
    });
  }
});
