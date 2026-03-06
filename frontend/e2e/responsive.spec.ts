import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const viewport of VIEWPORTS) {
  test(`layout stays responsive on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Share a secret' })).toBeVisible();
    await expect(page.locator('.header-surface')).toBeVisible();
    await expect(page.locator('.create-surface')).toBeVisible();

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - window.innerWidth;
    });

    expect(overflow).toBeLessThanOrEqual(2);
  });
}

test('mobile navigation keeps all controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.locator('.brand')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle color theme' })).toBeVisible();
  await expect(page.getByText('About')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Why' })).toBeVisible();
});
