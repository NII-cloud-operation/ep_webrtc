import {test, expect, openPad, activate, tracks} from '../utils';

test.describe('ep_webrtc control/track races', () => {
  for (const enabled of [false, true]) {
    for (const sequence of ['deactivate-click-activate', 'click-deactivate-activate',
      'deactivate-activate-click', 'click-while-reactivate', 'many-clicks']) {
      test(`${sequence} initially ${enabled}`, async ({page}) => {
        await openPad(page, {av: false}, {audioEnabledOnStart: enabled, videoEnabledOnStart: enabled});
        await activate(page);
        const initial = await tracks(page);
        expect(initial.audio).toBe(enabled);
        expect(initial.video).toBe(enabled);
        for (let iteration = 0; iteration < 10; iteration++) {
          const result = await page.evaluate(async (sequence) => {
            const win = window as any;
            const rtc = win.ep_webrtc;
            const $ = win.$;
            const stream = () => $('#rtcbox video')[0].srcObject;
            const oldTracks = stream().getTracks();
            const click = () => { $('.audio-btn').click(); $('.video-btn').click(); };
            const idle = () => Promise.all([
              $('.audio-btn').data('idle')('click'), $('.video-btn').data('idle')('click'),
            ]);
            if (sequence === 'deactivate-click-activate') {
              await rtc.deactivate(); click(); await rtc.activate();
            } else if (sequence === 'click-deactivate-activate') {
              click(); await rtc.deactivate(); await rtc.activate();
            } else if (sequence === 'deactivate-activate-click' || sequence === 'click-while-reactivate') {
              await rtc.deactivate();
              const activation = rtc.activate();
              if (sequence === 'deactivate-activate-click') {
                await new Promise<void>((resolve) => {
                  const ready = () => $('.interface-container').length === 1
                    ? resolve() : requestAnimationFrame(ready);
                  ready();
                });
              }
              click();
              await Promise.all([activation, idle()]);
            } else {
              $('.audio-btn').click(); $('.audio-btn').click(); $('.audio-btn').click();
              $('.video-btn').click(); $('.video-btn').click();
              await idle();
            }
            const newTracks = stream().getTracks();
            const live = (track: MediaStreamTrack) => track.readyState === 'live' && track.enabled;
            return {audio: win.webrtcTest.microphoneTracks.some(live),
              video: win.webrtcTest.cameraTracks.some(live),
              muted: $('.audio-btn').hasClass('muted'), off: $('.video-btn').hasClass('off'),
              oldEnded: oldTracks.every((t) => t.readyState === 'ended'),
              newLive: newTracks.every((t) => t.readyState === 'live'),
              distinct: newTracks.every((t) => !oldTracks.includes(t))};
          }, sequence);
          const toggled = sequence === 'deactivate-activate-click' || sequence === 'click-while-reactivate';
          const audio = sequence === 'many-clicks' ? (iteration % 2 === 0 ? !enabled : enabled)
            : toggled ? !enabled : enabled;
          const video = sequence === 'many-clicks' ? enabled : toggled ? !enabled : enabled;
          expect(result.audio).toBe(audio);
          expect(result.video).toBe(video);
          expect(result.muted).toBe(!audio);
          expect(result.off).toBe(!video);
          if (sequence !== 'many-clicks' && !(sequence === 'click-while-reactivate' && enabled)) {
            expect(result.oldEnded).toBe(true);
            expect(result.newLive).toBe(true);
            expect(result.distinct).toBe(true);
          }
        }
      });
    }
  }
});
