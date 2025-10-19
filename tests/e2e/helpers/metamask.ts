/**
 * MetaMask Helper Functions for E2E Tests
 * Utilities for interacting with MetaMask extension in Playwright tests
 */

import type { BrowserContext, Page } from '@playwright/test';

/**
 * Setup MetaMask extension in browser context
 */
export async function setupMetaMask(context: BrowserContext): Promise<void> {
  // In real implementation, you would:
  // 1. Load MetaMask extension
  // 2. Initialize with test mnemonic
  // 3. Unlock wallet
  // This is a placeholder for the actual implementation
  console.log('MetaMask setup (mock for now)');
}

/**
 * Connect MetaMask wallet to the dApp
 */
export async function connectWallet(page: Page): Promise<void> {
  // Handle MetaMask connection popup
  // In real tests, you would interact with the MetaMask extension window
  // For now, this is a placeholder
  console.log('Connecting wallet (mock)');

  // Simulate approval
  await page.waitForTimeout(1000);
}

/**
 * Switch to Chiado testnet
 */
export async function switchToChiado(page: Page): Promise<void> {
  // In real implementation, would interact with MetaMask to add/switch network
  console.log('Switching to Chiado (mock)');
  await page.waitForTimeout(500);
}

/**
 * Confirm transaction in MetaMask
 */
export async function confirmTransaction(page: Page): Promise<void> {
  // Handle MetaMask transaction confirmation popup
  console.log('Confirming transaction (mock)');
  await page.waitForTimeout(1000);
}

/**
 * Reject transaction in MetaMask
 */
export async function rejectTransaction(page: Page): Promise<void> {
  console.log('Rejecting transaction (mock)');
  await page.waitForTimeout(500);
}

/**
 * Sign message in MetaMask
 */
export async function signMessage(page: Page): Promise<void> {
  console.log('Signing message (mock)');
  await page.waitForTimeout(500);
}

/**
 * Get current account address from MetaMask
 */
export async function getCurrentAccount(page: Page): Promise<string> {
  // In real implementation, would query MetaMask state
  return '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
}

/**
 * Switch MetaMask account
 */
export async function switchAccount(page: Page, accountIndex: number): Promise<void> {
  console.log(`Switching to account ${accountIndex} (mock)`);
  await page.waitForTimeout(500);
}
