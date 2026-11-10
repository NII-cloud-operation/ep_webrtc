import {test, expect, openPad, activate} from '../utils';

test.describe('ep_webrtc interface buttons', () => {
  test('enlarges then shrinks', async ({page}) => {
    await openPad(page, {av: false});
    await activate(page);
    const video = page.locator('#rtcbox video');
    const dimensions = () => video.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {width: rect.width, height: rect.height};
    });
    await expect.poll(async () => (await dimensions()).width).toBeCloseTo(160, 0);
    await expect.poll(async () => (await dimensions()).height).toBeCloseTo(120, 0);
    await page.locator('.enlarge-btn').click();
    await expect.poll(async () => (await dimensions()).width).toBeGreaterThan(259);
    await expect.poll(async () => (await dimensions()).height).toBeGreaterThan(194);
    await page.locator('.enlarge-btn').click();
    await expect.poll(async () => (await dimensions()).width).toBeLessThan(161);
    await expect.poll(async () => (await dimensions()).height).toBeLessThan(121);
  });

  for (const initiallyEnabled of [true, false]) {
    for (const kind of ['audio', 'video']) {
      test(`${kind} toggles when initially ${initiallyEnabled ? 'on' : 'off'}`, async ({page}) => {
        await openPad(page, {av: false}, {audioEnabledOnStart: initiallyEnabled,
          videoEnabledOnStart: initiallyEnabled});
        await activate(page);
        const button = page.locator(`.${kind}-btn`);
        const state = () => page.evaluate((kind) => {
          const win = window as any;
          const track = win.webrtcTest[`${kind}Track`];
          return {enabled: track != null && track.enabled,
            off: win.$(`.${kind}-btn`).hasClass(kind === 'audio' ? 'muted' : 'off')};
        }, kind);
        const expectState = async (enabled: boolean) => {
          await expect.poll(state).toEqual({enabled, off: !enabled});
          if (kind === 'audio') await expect(button).toHaveAttribute('title', enabled ? 'Mute' : 'Unmute');
          else await expect(button).toHaveAttribute('title', enabled ? /Disable/ : /Enable/);
        };
        await expectState(initiallyEnabled);
        await button.click();
        await expectState(!initiallyEnabled);
        await button.click();
        await expectState(initiallyEnabled);
      });
    }
  }

  for (const kind of ['audio', 'video']) {
    test(`hard-disabled ${kind} cannot be enabled`, async ({page}) => {
      await openPad(page, {av: false});
      await page.evaluate(() => {
        const rtc = (window as any).ep_webrtc;
        rtc._settings.audio.disabled = 'hard';
        rtc._settings.video.disabled = 'hard';
      });
      await activate(page);
      const button = page.locator(`.${kind}-btn`);
      await expect(button).toHaveClass(/disallowed/);
      await expect(button).toHaveAttribute('title', kind === 'audio'
        ? 'Audio disallowed by admin' : 'Video disallowed by admin');
      await button.dispatchEvent('click');
      const state = await page.evaluate(() => {
        const win = window as any;
        return {audio: win.webrtcTest.audioTrack, video: win.webrtcTest.videoTrack,
          muted: win.$('.audio-btn').hasClass('muted'), off: win.$('.video-btn').hasClass('off')};
      });
      expect(state).toEqual({audio: null, video: null, muted: true, off: true});
    });
  }
});
