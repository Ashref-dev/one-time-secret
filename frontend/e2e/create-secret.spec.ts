import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the home page with create secret form', async ({ page }) => {
    await expect(page.getByText('Share a Secret')).toBeVisible();
    await expect(page.getByPlaceholder('Paste your secret here...')).toBeVisible();
    await expect(page.getByText('🔐 Create Secret Link')).toBeVisible();
  });

  test('should show error when submitting empty secret', async ({ page }) => {
    await page.getByText('🔐 Create Secret Link').click();
    await expect(page.getByText('Please enter a secret to share')).toBeVisible();
  });

  test('should create a secret and display shareable link', async ({ page }) => {
    const testSecret = 'My test secret message';
    
    await page.getByPlaceholder('Paste your secret here...').fill(testSecret);
    await page.getByText('🔐 Create Secret Link').click();
    
    await expect(page.getByText('✅ Secret Ready to Share')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/http:\/\/localhost:\d+\/s\//)).toBeVisible();
  });

  test('should copy link to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    await page.getByPlaceholder('Paste your secret here...').fill('Test secret');
    await page.getByText('🔐 Create Secret Link').click();
    await page.getByText('✅ Secret Ready to Share').waitFor({ timeout: 10000 });
    
    await page.getByText('📋 Copy Link').click();
    
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toMatch(/http:\/\/localhost:\d+\/s\//);
  });

  test('should allow creating another secret after success', async ({ page }) => {
    await page.getByPlaceholder('Paste your secret here...').fill('First secret');
    await page.getByText('🔐 Create Secret Link').click();
    await page.getByText('✅ Secret Ready to Share').waitFor({ timeout: 10000 });
    
    await page.getByText('Create Another Secret').click();
    await expect(page.getByPlaceholder('Paste your secret here...')).toBeEmpty();
    await expect(page.getByText('🔐 Create Secret Link')).toBeVisible();
  });
});

test.describe('Create Secret with Passphrase', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show passphrase field when passphrase option is enabled', async ({ page }) => {
    await page.getByLabel('Require passphrase').check();
    await expect(page.getByPlaceholder('Enter a strong passphrase')).toBeVisible();
  });

  test('should show error when passphrase is enabled but empty', async ({ page }) => {
    await page.getByPlaceholder('Paste your secret here...').fill('Test secret');
    await page.getByLabel('Require passphrase').check();
    await page.getByText('🔐 Create Secret Link').click();
    
    await expect(page.getByText('Please enter a passphrase')).toBeVisible();
  });

  test('should create secret with passphrase', async ({ page }) => {
    const testSecret = 'Secret with passphrase';
    const passphrase = 'my-secure-passphrase-123';
    
    await page.getByPlaceholder('Paste your secret here...').fill(testSecret);
    await page.getByLabel('Require passphrase').check();
    await page.getByPlaceholder('Enter a strong passphrase').fill(passphrase);
    await page.getByText('🔐 Create Secret Link').click();
    
    await expect(page.getByText('✅ Secret Ready to Share')).toBeVisible({ timeout: 10000 });
    
    const urlDisplay = await page.locator('.url-display').textContent();
    expect(urlDisplay).not.toContain('#');
  });
});

test.describe('Expiry Options', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have default expiry of 1 hour', async ({ page }) => {
    const expirySelect = page.locator('#expiry');
    await expect(expirySelect).toHaveValue('3600');
  });

  test('should allow changing expiry time', async ({ page }) => {
    await page.locator('#expiry').selectOption('86400');
    await expect(page.locator('#expiry')).toHaveValue('86400');
  });
});

test.describe('Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should toggle between light and dark mode', async ({ page }) => {
    const themeButton = page.getByLabel(/Switch to/);
    
    const initialTheme = await page.locator('html').getAttribute('data-theme');
    
    await themeButton.click();
    
    const newTheme = await page.locator('html').getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);
  });
});

test.describe('How it Works Section', () => {
  test('should display security information', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.getByText('How it works')).toBeVisible();
    await expect(page.getByText('Your secret is encrypted in your browser using AES-256-GCM')).toBeVisible();
    await expect(page.getByText('The encryption key never leaves your device')).toBeVisible();
  });
});
