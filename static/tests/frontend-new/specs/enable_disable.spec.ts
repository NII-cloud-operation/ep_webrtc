import {test, expect, installTestMedia, openPad} from '../utils';

test('the pad call starts for current and later visitors and stops for everyone', async ({page, browser}) => {
  await openPad(page, {av: true}, {rtcEnabled: true});
  const allow = page.locator('label[for=padsettings-enablertc]');
  const guest = await browser.newPage();
  try {
    await installTestMedia(guest);
    await guest.goto(page.url());
    await guest.locator('#rtcbox').waitFor({state: 'attached'});
    await guest.waitForFunction(() => (window as any).$('#rtcbox').data('initialized'));
    for (const visitor of [page, guest]) await expect(visitor.locator('#rtcbox video')).toHaveCount(0);

    await page.locator('[data-key="settings"] button').click();
    await allow.click();
    for (const visitor of [page, guest]) await expect(visitor.locator('#rtcbox video').first()).toBeVisible();

    await guest.reload();
    await expect(guest.locator('#rtcbox video').first()).toBeVisible();
    await allow.click();
    for (const visitor of [page, guest]) await expect(visitor.locator('#rtcbox video')).toHaveCount(0);
  } finally {
    await guest.close();
  }
});
