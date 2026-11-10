import {test, expect, cartesian, openPad, readPrefs} from '../utils';

test.describe('ep_webrtc settingToCheckbox', () => {
  for (const [defaultVal, cookieVal, queryVal] of cartesian(
    [false, true], [null, false, true], [null, false, true])) {
    test(`default=${defaultVal} cookie=${cookieVal} query=${queryVal}`, async ({page}) => {
      await openPad(page, queryVal == null ? {av: false} : {av: false, testQuery: queryVal},
        cookieVal == null ? {} : {testCookie: cookieVal});
      const expected = queryVal ?? cookieVal ?? defaultVal;
      const result = await page.evaluate(({defaultVal}) => {
        const win = window as any;
        win.$('#settings').append('<input type="checkbox" id="testCheckbox">');
        win.ep_webrtc.settingToCheckbox({urlVar: 'testQuery', cookie: 'testCookie',
          defaultVal, checkboxId: '#testCheckbox'});
        return win.$('#testCheckbox').prop('checked');
      }, {defaultVal});
      expect(result).toBe(expected);
      expect((await readPrefs(page)).testCookie).toBe(queryVal ?? cookieVal ?? undefined);
      await page.locator('#testCheckbox').evaluate((element: HTMLInputElement) => element.click());
      expect((await readPrefs(page)).testCookie).toBe(!expected);
    });
  }
  for (const key of ['urlVar', 'cookie', 'defaultVal', 'checkboxId']) {
    test(`rejects missing ${key}`, async ({page}) => {
      await openPad(page, {av: false});
      await expect(page.evaluate((key) => {
        const params = {urlVar: 'query', cookie: 'cookie', defaultVal: true, checkboxId: '#test'};
        delete params[key];
        (window as any).ep_webrtc.settingToCheckbox(params);
      }, key)).rejects.toThrow(new RegExp(key));
    });
  }
});
