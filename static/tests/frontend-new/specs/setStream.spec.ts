import {test, expect, cartesian, openPad, activate} from '../utils';

test.describe('ep_webrtc setStream', () => {
  const cases = [...cartesian([false, true], [false, true], [false, true], [false, true])]
    .map(([audio, video, peerAudio, peerVideo]) => ({audio, video, peerAudio, peerVideo, hard: false}));
  cases.push({audio: true, video: true, peerAudio: false, peerVideo: false, hard: true});
  for (const state of cases) {
    test(JSON.stringify(state), async ({page}) => {
      await openPad(page, {av: false, webrtcaudioenabled: state.audio, webrtcvideoenabled: state.video});
      if (state.hard) await page.evaluate(() => {
        (window as any).ep_webrtc._settings.audio.disabled = 'hard';
        (window as any).ep_webrtc._settings.video.disabled = 'hard';
      });
      await activate(page);
      await page.evaluate(async ({peerAudio, peerVideo}) => {
        const win = window as any;
        const stream = await win.webrtcTest.makeStream({audio: peerAudio, video: peerVideo});
        await win.ep_webrtc.setStream('other_user_id', stream);
      }, state);
      await expect(page.locator('.interface-container')).toHaveCount(2);
      const ownId = await page.evaluate(() => (window as any).ep_webrtc.getUserId().replace(/\./g, '_'));
      const self = page.locator(`#interface_video_${ownId}`);
      await expect(page.locator(`#video_${ownId}`)).toHaveJSProperty('muted', true);
      await expect(self.locator('.audio-btn')).toHaveCount(1);
      await expect(self.locator('.video-btn')).toHaveCount(1);
      await expect(self.locator('.enlarge-btn')).not.toContainClass('large');
      expect(await self.locator('.audio-btn').evaluate((el) => el.classList.contains('muted')))
        .toBe(state.hard || !state.audio);
      expect(await self.locator('.video-btn').evaluate((el) => el.classList.contains('off')))
        .toBe(state.hard || !state.video);
      expect(await self.locator('.audio-btn').evaluate((el) => el.classList.contains('disallowed')))
        .toBe(state.hard);
      expect(await self.locator('.video-btn').evaluate((el) => el.classList.contains('disallowed')))
        .toBe(state.hard);
      const peer = page.locator('#interface_video_other_user_id');
      await expect(peer.locator('.audio-btn')).toHaveCount(1);
      await expect(peer.locator('.video-btn')).toHaveCount(0);
      await expect(peer.locator('.enlarge-btn')).not.toContainClass('large');
      expect(await peer.locator('.audio-btn').evaluate((el) => el.classList.contains('muted')))
        .toBe(await page.locator('#video_other_user_id').evaluate((el: HTMLVideoElement) => el.muted));
    });
  }
});
