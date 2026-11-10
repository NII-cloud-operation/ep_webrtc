import {test as base, expect, type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';

export {expect};
export const test = base.extend({
  launchOptions: {args: ['--autoplay-policy=no-user-gesture-required']},
  page: async ({page}, use) => {
    await page.addInitScript(() => {
      const win = window as any;
      let rtc;
      Object.defineProperty(window, 'ep_webrtc', {
        configurable: true,
        get: () => rtc,
        set(value) {
          rtc = value;
          let soraClient = null;
          Object.defineProperty(rtc, '_soraClient', {
            get: () => soraClient,
            set(client) {
              // Local-control tests do not establish SFU connections.
              if (client !== null) {
                client.connect = async () => {};
                client.disconnect = async () => {};
                client.replaceLocalTrack = async () => {};
              }
              soraClient = client;
            },
          });
        },
      });
      const makeStream = async ({audio, video}) => {
        const tracks = [];
        if (audio) {
          const audioContext = new AudioContext();
          tracks.push(...audioContext.createMediaStreamDestination().stream.getAudioTracks());
        }
        if (video) {
          const {width: {ideal: width = 160} = {}, height: {ideal: height = 120} = {}} = video;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          setInterval(() => {
            context.fillStyle = `rgb(${Date.now() % 255}, 0, 0)`;
            context.fillRect(0, 0, width, height);
          }, 50);
          tracks.push(...canvas.captureStream().getVideoTracks());
        }
        return new MediaStream(tracks);
      };
      win.webrtcTest = {makeStream, audioTrack: null, videoTrack: null,
        microphoneTracks: [], cameraTracks: []};
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (!constraints.audio && !constraints.video) throw new TypeError('audio or video required');
        const stream = await makeStream(constraints);
        [win.webrtcTest.audioTrack] = stream.getAudioTracks();
        [win.webrtcTest.videoTrack] = stream.getVideoTracks();
        win.webrtcTest.microphoneTracks.push(...stream.getAudioTracks());
        win.webrtcTest.cameraTracks.push(...stream.getVideoTracks());
        return stream;
      };
    });
    await use(page);
  },
});

export function* cartesian(...arrays: unknown[][]): Generator<any[]> {
  if (arrays.length === 0) { yield []; return; }
  const [first, ...rest] = arrays;
  for (const value of first) for (const tail of cartesian(...rest)) yield [value, ...tail];
}

export const openPad = async (page: Page, params = {}, prefs = {}) => {
  await page.context().addCookies([{
    name: 'prefsHttp', value: encodeURIComponent(JSON.stringify(prefs)), url: 'http://localhost:9001',
  }]);
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  await page.goto(`http://localhost:9001/p/webrtc-${randomUUID()}?${query}`);
  await page.locator('#rtcbox').waitFor({state: 'attached'});
  await page.waitForFunction(() => (window as any).$('#rtcbox').data('initialized'));
  const acknowledge = page.getByRole('button', {name: "I've saved it", exact: true});
  await acknowledge.click();
  await expect(acknowledge).toBeHidden();
};

export const activate = (page: Page) => page.evaluate(() => (window as any).ep_webrtc.activate());

export const tracks = (page: Page) => page.evaluate(() => {
  const win = window as any;
  const live = (track: MediaStreamTrack) => track.readyState === 'live' && track.enabled;
  // SFU canvas filler is not a camera track; inspect all tracks acquired from devices.
  return {
    audio: win.webrtcTest.microphoneTracks.some(live),
    video: win.webrtcTest.cameraTracks.some(live),
    muted: win.$('.audio-btn').hasClass('muted'),
    off: win.$('.video-btn').hasClass('off'),
  };
});

export const readPrefs = async (page: Page) => {
  const cookie = (await page.context().cookies()).find(({name}) => name === 'prefsHttp')!;
  return JSON.parse(decodeURIComponent(cookie.value));
};
