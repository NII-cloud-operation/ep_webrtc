import {test, expect, cartesian, openPad, activate} from '../utils';

test.describe('ep_webrtc audio/video on start', () => {
  for (const [kind, cookieVal, queryVal] of cartesian(['audio', 'video'],
    [null, false, true], [null, false, true])) {
    test(`${kind} cookie=${cookieVal} query=${queryVal}`, async ({page}) => {
      await openPad(page, queryVal == null ? {av: false}
        : {av: false, [`webrtc${kind}enabled`]: queryVal},
      cookieVal == null ? {} : {[`${kind}EnabledOnStart`]: cookieVal});
      await activate(page);
      await expect(page.locator(`#options-${kind}enabledonstart`))
        .toBeChecked({checked: queryVal ?? cookieVal ?? true});
    });
  }
});
