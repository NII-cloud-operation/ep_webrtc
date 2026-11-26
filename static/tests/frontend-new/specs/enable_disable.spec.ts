import {test, expect, openPad} from '../utils';

test('call permission belongs to the pad and joining is personal', async ({page, browser}) => {
  await openPad(page, {av: true}, {rtcEnabled: true});
  const join = page.getByRole('button', {name: 'Join call'});
  const allow = page.locator('label[for=padsettings-enablertc]');
  const settings = page.locator('[data-key="settings"] button');
  await expect(join).toBeHidden();
  await expect(page.locator('#rtcbox video')).toHaveCount(0);

  const guest = await browser.newPage();
  try {
    await guest.goto(page.url());
    await guest.getByRole('button', {name: "I've saved it", exact: true}).click();
    const guestJoin = guest.getByRole('button', {name: 'Join call'});
    await settings.click();
    await allow.click();
    await settings.click();
    await expect(guestJoin).toBeVisible();
    await join.click();
    await expect(page.getByRole('button', {name: 'Leave call'})).toBeEnabled();
    await expect(page.locator('#rtcbox video')).toHaveCount(1);
    await expect(guest.locator('#rtcbox video')).toHaveCount(0);
    await guest.reload();
    await expect(guestJoin).toBeVisible();

    await settings.click();
    await allow.click();
    await expect(guestJoin).toBeHidden();
    await expect(page.locator('#rtcbox video')).toHaveCount(0);
  } finally {
    await guest.close();
  }
});
