import {test, expect, cartesian, openPad} from '../utils';

test.describe('ep_webrtc enable/disable', () => {
  for (const [cookieVal, queryVal] of cartesian([null, false, true],
    [null, false, true, 'NO', 'YES', 'ignored'])) {
    test(`cookie=${cookieVal} query=${queryVal}`, async ({page}) => {
      await openPad(page, queryVal == null ? {} : {av: queryVal},
        cookieVal == null ? {} : {rtcEnabled: cookieVal});
      const query = typeof queryVal === 'boolean' ? queryVal
        : queryVal === 'YES' ? true : queryVal === 'NO' ? false : null;
      const expected = query ?? cookieVal ?? false;
      const checkbox = page.locator('#options-enablertc');
      await expect(checkbox).toBeChecked({checked: expected});
      await expect(page.locator('#rtcbox video')).toHaveCount(expected ? 1 : 0);
      await checkbox.evaluate((element: HTMLInputElement) => element.click());
      await expect(checkbox).toBeChecked({checked: !expected});
      await expect(page.locator('#rtcbox video')).toHaveCount(expected ? 0 : 1);
    });
  }
});
