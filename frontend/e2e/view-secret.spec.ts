import { test, expect } from '@playwright/test';

test.describe('View Secret Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show not found for invalid secret ID', async ({ page }) => {
    await page.goto('/s/invalid-secret-id-12345');
    
    await expect(page.getByText('Secret unavailable')).toBeVisible();
    await expect(page.getByText('This secret does not exist or has already been viewed')).toBeVisible();
  });

  test('should show loading state while retrieving secret', async ({ page }) => {
    await page.goto('/s/test-secret-id');
    
    await expect(page.getByText('Retrieving secret...')).toBeVisible();
  });

  test('should decrypt and display secret with key in URL', async ({ page }) => {
    const secretMessage = 'My super secret message';
    
    await page.getByPlaceholder('Paste your secret here...').fill(secretMessage);
    await page.getByText('Create secret link').click();
    await page.getByText('Secret ready to share').waitFor({ timeout: 10000 });
    
    const linkElement = await page.locator('.url-display');
    const shareUrl = await linkElement.textContent();
    
    await page.goto(shareUrl!);
    
    await expect(page.getByText('Decrypted secret')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(secretMessage)).toBeVisible();
    await expect(page.getByText('This secret has been permanently deleted from the server')).toBeVisible();
  });

  test('should allow copying decrypted secret to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    const secretMessage = 'Copy this secret';
    
    await page.getByPlaceholder('Paste your secret here...').fill(secretMessage);
    await page.getByText('Create secret link').click();
    await page.getByText('Secret ready to share').waitFor({ timeout: 10000 });
    
    const shareUrl = await page.locator('.url-display').textContent();
    await page.goto(shareUrl!);
    
    await page.getByText('Decrypted secret').waitFor({ timeout: 10000 });
    await page.getByText('Copy secret').click();
    
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(secretMessage);
  });

  test('should show passphrase prompt for passphrase-protected secrets', async ({ page }) => {
    const secretMessage = 'Passphrase protected secret';
    const passphrase = 'test-passphrase-123';
    
    await page.getByPlaceholder('Paste your secret here...').fill(secretMessage);
    await page.getByLabel('Require passphrase').check();
    await page.getByPlaceholder('Enter a strong passphrase').fill(passphrase);
    await page.getByText('Create secret link').click();
    await page.getByText('Secret ready to share').waitFor({ timeout: 10000 });
    
    const shareUrl = await page.locator('.url-display').textContent();
    await page.goto(shareUrl!);
    
    await expect(page.getByText('Passphrase required')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('Enter the passphrase')).toBeVisible();
  });

  test('should decrypt secret with correct passphrase', async ({ page }) => {
    const secretMessage = 'Secret with passphrase test';
    const passphrase = 'correct-passphrase';
    
    await page.getByPlaceholder('Paste your secret here...').fill(secretMessage);
    await page.getByLabel('Require passphrase').check();
    await page.getByPlaceholder('Enter a strong passphrase').fill(passphrase);
    await page.getByText('Create secret link').click();
    await page.getByText('Secret ready to share').waitFor({ timeout: 10000 });
    
    const shareUrl = await page.locator('.url-display').textContent();
    await page.goto(shareUrl!);
    
    await page.getByText('Passphrase required').waitFor({ timeout: 10000 });
    await page.getByPlaceholder('Enter the passphrase').fill(passphrase);
    await page.getByText('Decrypt Secret').click();
    
    await expect(page.getByText('Decrypted secret')).toBeVisible();
    await expect(page.getByText(secretMessage)).toBeVisible();
  });

  test('should show error for incorrect passphrase', async ({ page }) => {
    const secretMessage = 'Another secret';
    const correctPassphrase = 'correct-one';
    
    await page.getByPlaceholder('Paste your secret here...').fill(secretMessage);
    await page.getByLabel('Require passphrase').check();
    await page.getByPlaceholder('Enter a strong passphrase').fill(correctPassphrase);
    await page.getByText('Create secret link').click();
    await page.getByText('Secret ready to share').waitFor({ timeout: 10000 });
    
    const shareUrl = await page.locator('.url-display').textContent();
    await page.goto(shareUrl!);
    
    await page.getByText('Passphrase required').waitFor({ timeout: 10000 });
    await page.getByPlaceholder('Enter the passphrase').fill('wrong-passphrase');
    await page.getByText('Decrypt Secret').click();
    
    await expect(page.getByText('Incorrect passphrase. Please try again.')).toBeVisible();
  });

  test('should provide link to create new secret after viewing', async ({ page }) => {
    await page.getByPlaceholder('Paste your secret here...').fill('Test secret');
    await page.getByText('Create secret link').click();
    await page.getByText('Secret ready to share').waitFor({ timeout: 10000 });
    
    const shareUrl = await page.locator('.url-display').textContent();
    await page.goto(shareUrl!);
    
    await page.getByText('Decrypted secret').waitFor({ timeout: 10000 });
    
    await expect(page.getByText('Create new secret')).toBeVisible();
    
    await page.getByText('Create new secret').click();
    
    await expect(page.getByText('Share a secret')).toBeVisible();
  });
});
