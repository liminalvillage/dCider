/**
 * T049: E2E test for delegation user journey
 * Tests complete user flow from wallet connection to delegation
 */

import { test, expect, type Page } from '@playwright/test';
import { setupMetaMask, connectWallet, switchToChiado } from './helpers/metamask';

// Test wallet addresses (from test mnemonic)
const ALICE_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const BOB_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

test.describe('Delegation User Journey', () => {
  test.beforeEach(async ({ page, context }) => {
    // Setup MetaMask extension
    await setupMetaMask(context);

    // Navigate to app
    await page.goto('http://localhost:5173');
  });

  test('E2E: Complete delegation flow', async ({ page }) => {
    // Step 1: Connect wallet
    await test.step('Connect wallet', async () => {
      const connectButton = page.locator('button:has-text("Connect Wallet")');
      await expect(connectButton).toBeVisible();
      await connectButton.click();

      // Handle MetaMask popup
      await connectWallet(page);

      // Verify connection
      await expect(page.locator('text=/Connected: 0x/i')).toBeVisible({ timeout: 10000 });
    });

    // Step 2: Switch to Chiado network
    await test.step('Switch to Chiado network', async () => {
      const networkIndicator = page.locator('[data-testid="network-indicator"]');

      // If not on Chiado, switch
      if (await networkIndicator.textContent() !== 'Chiado') {
        await switchToChiado(page);
      }

      await expect(networkIndicator).toHaveText('Chiado');
    });

    // Step 3: Navigate to delegation page
    await test.step('Navigate to delegation page', async () => {
      await page.click('a:has-text("Delegate")');
      await expect(page).toHaveURL(/.*\/delegate/);
    });

    // Step 4: Select topic
    await test.step('Select topic', async () => {
      await expect(page.locator('text=Select a Topic')).toBeVisible();

      // Wait for topics to load
      await expect(page.locator('.topic-item')).toHaveCount(4, { timeout: 10000 });

      // Click on "Climate Policy" topic
      await page.click('text=Climate Policy');

      // Verify selection
      await expect(page.locator('.topic-item.selected')).toContainText('Climate Policy');
    });

    // Step 5: Enter delegate address
    await test.step('Enter delegate address', async () => {
      const addressInput = page.locator('input[placeholder*="delegate address"]');
      await addressInput.fill(BOB_ADDRESS);

      // Verify address is valid (no error shown)
      await expect(page.locator('text=/Invalid address/i')).not.toBeVisible();

      // Verify delegate button is enabled
      await expect(page.locator('button:has-text("Delegate Vote")')).toBeEnabled();
    });

    // Step 6: Submit delegation
    await test.step('Submit delegation', async () => {
      const delegateButton = page.locator('button:has-text("Delegate Vote")');
      await delegateButton.click();

      // Handle MetaMask transaction confirmation
      const metamaskPopup = await page.waitForEvent('popup');
      await metamaskPopup.click('button:has-text("Confirm")');

      // Wait for transaction confirmation
      await expect(page.locator('text=/Delegation successful/i')).toBeVisible({ timeout: 30000 });
    });

    // Step 7: Verify delegation in UI
    await test.step('Verify delegation', async () => {
      // Should show current delegation
      await expect(page.locator('[data-testid="current-delegation"]')).toBeVisible();
      await expect(page.locator('[data-testid="current-delegation"]')).toContainText(BOB_ADDRESS.slice(0, 8));

      // Should show revoke button
      await expect(page.locator('button:has-text("Revoke Delegation")')).toBeVisible();
    });
  });

  test('E2E: Revoke delegation', async ({ page }) => {
    // Prerequisite: User already has active delegation
    await connectAndDelegate(page, BOB_ADDRESS);

    await test.step('Navigate to delegation page', async () => {
      await page.click('a:has-text("Delegate")');
      await expect(page).toHaveURL(/.*\/delegate/);
    });

    await test.step('Select same topic', async () => {
      await page.click('text=Climate Policy');
    });

    await test.step('Revoke delegation', async () => {
      const revokeButton = page.locator('button:has-text("Revoke Delegation")');
      await expect(revokeButton).toBeVisible();
      await revokeButton.click();

      // Confirm revocation
      await page.click('button:has-text("Confirm Revoke")');

      // Handle MetaMask transaction
      const metamaskPopup = await page.waitForEvent('popup');
      await metamaskPopup.click('button:has-text("Confirm")');

      // Wait for confirmation
      await expect(page.locator('text=/Revocation successful/i')).toBeVisible({ timeout: 30000 });
    });

    await test.step('Verify revocation', async () => {
      // Should not show current delegation
      await expect(page.locator('[data-testid="current-delegation"]')).not.toBeVisible();

      // Should show delegate button again
      await expect(page.locator('button:has-text("Delegate Vote")')).toBeVisible();
    });
  });

  test('E2E: Change delegation', async ({ page }) => {
    const CHARLIE_ADDRESS = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

    // Prerequisite: User delegates to Bob
    await connectAndDelegate(page, BOB_ADDRESS);

    await test.step('Navigate to delegation page', async () => {
      await page.click('a:has-text("Delegate")');
    });

    await test.step('Select same topic', async () => {
      await page.click('text=Climate Policy');
    });

    await test.step('Change delegate address', async () => {
      // Current delegation should be shown
      await expect(page.locator('[data-testid="current-delegation"]')).toBeVisible();

      // Enter new delegate address
      const addressInput = page.locator('input[placeholder*="delegate address"]');
      await addressInput.fill(CHARLIE_ADDRESS);

      // Submit new delegation
      const delegateButton = page.locator('button:has-text("Update Delegation")');
      await delegateButton.click();

      // Confirm MetaMask transaction
      const metamaskPopup = await page.waitForEvent('popup');
      await metamaskPopup.click('button:has-text("Confirm")');

      await expect(page.locator('text=/Delegation updated/i')).toBeVisible({ timeout: 30000 });
    });

    await test.step('Verify new delegation', async () => {
      await expect(page.locator('[data-testid="current-delegation"]')).toContainText(CHARLIE_ADDRESS.slice(0, 8));
    });
  });

  test('E2E: Prevent self-delegation', async ({ page }) => {
    await connectAndNavigate(page);

    await test.step('Select topic', async () => {
      await page.click('text=Climate Policy');
    });

    await test.step('Enter own address', async () => {
      const addressInput = page.locator('input[placeholder*="delegate address"]');
      await addressInput.fill(ALICE_ADDRESS);

      // Should show error
      await expect(page.locator('text=/Cannot delegate to yourself/i')).toBeVisible();

      // Delegate button should be disabled
      await expect(page.locator('button:has-text("Delegate Vote")')).toBeDisabled();
    });
  });

  test('E2E: View delegation graph', async ({ page }) => {
    await connectAndNavigate(page);

    await test.step('Navigate to graph page', async () => {
      await page.click('a:has-text("Graph")');
      await expect(page).toHaveURL(/.*\/graph/);
    });

    await test.step('Select topic', async () => {
      await page.click('text=Climate Policy');
    });

    await test.step('Verify graph visualization', async () => {
      // Graph should load
      await expect(page.locator('[data-testid="delegation-graph"]')).toBeVisible({ timeout: 10000 });

      // Should show nodes
      await expect(page.locator('.graph-node')).toHaveCount(1, { timeout: 5000 }); // At least current user

      // Should show legend
      await expect(page.locator('.graph-legend')).toBeVisible();
    });

    await test.step('Interact with graph', async () => {
      // Hover over node
      const node = page.locator('.graph-node').first();
      await node.hover();

      // Should show tooltip with address and voting power
      await expect(page.locator('.node-tooltip')).toBeVisible();
    });
  });

  test('E2E: Delegation to dead-end should fail', async ({ page }) => {
    await connectAndNavigate(page);

    await test.step('Select topic', async () => {
      await page.click('text=Climate Policy');
    });

    await test.step('Enter dead-end delegate address', async () => {
      // Assume BOB_ADDRESS has declared dead-end
      const addressInput = page.locator('input[placeholder*="delegate address"]');
      await addressInput.fill(BOB_ADDRESS);
    });

    await test.step('Attempt delegation', async () => {
      const delegateButton = page.locator('button:has-text("Delegate Vote")');
      await delegateButton.click();

      // MetaMask confirmation
      const metamaskPopup = await page.waitForEvent('popup');
      await metamaskPopup.click('button:has-text("Confirm")');

      // Should show error
      await expect(page.locator('text=/delegate is a dead-end/i')).toBeVisible({ timeout: 30000 });
    });
  });

  test('E2E: Invalid address handling', async ({ page }) => {
    await connectAndNavigate(page);

    await test.step('Select topic', async () => {
      await page.click('text=Climate Policy');
    });

    await test.step('Enter invalid address', async () => {
      const addressInput = page.locator('input[placeholder*="delegate address"]');
      await addressInput.fill('not-an-address');

      // Should show validation error
      await expect(page.locator('text=/Invalid Ethereum address/i')).toBeVisible();

      // Delegate button should be disabled
      await expect(page.locator('button:has-text("Delegate Vote")')).toBeDisabled();
    });
  });
});

// Helper functions

async function connectAndNavigate(page: Page) {
  await test.step('Connect wallet and navigate', async () => {
    const connectButton = page.locator('button:has-text("Connect Wallet")');
    await connectButton.click();
    await connectWallet(page);
    await expect(page.locator('text=/Connected: 0x/i')).toBeVisible({ timeout: 10000 });

    await page.click('a:has-text("Delegate")');
    await expect(page).toHaveURL(/.*\/delegate/);
  });
}

async function connectAndDelegate(page: Page, delegateAddress: string) {
  await connectAndNavigate(page);

  await test.step('Perform delegation', async () => {
    await page.click('text=Climate Policy');

    const addressInput = page.locator('input[placeholder*="delegate address"]');
    await addressInput.fill(delegateAddress);

    const delegateButton = page.locator('button:has-text("Delegate Vote")');
    await delegateButton.click();

    const metamaskPopup = await page.waitForEvent('popup');
    await metamaskPopup.click('button:has-text("Confirm")');

    await expect(page.locator('text=/Delegation successful/i')).toBeVisible({ timeout: 30000 });
  });
}
