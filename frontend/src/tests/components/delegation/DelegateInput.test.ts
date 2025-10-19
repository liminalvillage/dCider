/**
 * T048: Frontend component test for DelegateInput
 * Tests address input and validation UI component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import DelegateInput from '$components/delegation/DelegateInput.svelte';
import { ethers } from 'ethers';

describe('DelegateInput Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render input field', () => {
    render(DelegateInput);

    const input = screen.getByPlaceholderText(/Enter delegate address/i);
    expect(input).toBeInTheDocument();
  });

  it('should accept valid Ethereum address', async () => {
    const { component } = render(DelegateInput);
    const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

    const input = screen.getByPlaceholderText(/Enter delegate address/i);
    await fireEvent.input(input, { target: { value: validAddress } });

    // Should not show error
    expect(screen.queryByText(/Invalid address/i)).not.toBeInTheDocument();

    // Should normalize to checksum address
    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe(ethers.getAddress(validAddress));
    });
  });

  it('should show error for invalid address', async () => {
    render(DelegateInput);

    const input = screen.getByPlaceholderText(/Enter delegate address/i);
    await fireEvent.input(input, { target: { value: 'invalid-address' } });

    await waitFor(() => {
      expect(screen.getByText(/Invalid Ethereum address/i)).toBeInTheDocument();
    });
  });

  it('should show error for zero address', async () => {
    render(DelegateInput);

    const input = screen.getByPlaceholderText(/Enter delegate address/i);
    await fireEvent.input(input, { target: { value: ethers.ZeroAddress } });

    await waitFor(() => {
      expect(screen.getByText(/Cannot delegate to zero address/i)).toBeInTheDocument();
    });
  });

  it('should emit event with valid address', async () => {
    const { component } = render(DelegateInput);
    let emittedAddress: string | null = null;

    component.$on('addressChanged', (event: CustomEvent) => {
      emittedAddress = event.detail.address;
    });

    const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    const input = screen.getByPlaceholderText(/Enter delegate address/i);
    await fireEvent.input(input, { target: { value: validAddress } });

    await waitFor(() => {
      expect(emittedAddress).toBe(ethers.getAddress(validAddress));
    });
  });

  it('should not emit event for invalid address', async () => {
    const { component } = render(DelegateInput);
    let eventCount = 0;

    component.$on('addressChanged', () => {
      eventCount++;
    });

    const input = screen.getByPlaceholderText(/Enter delegate address/i);
    await fireEvent.input(input, { target: { value: 'invalid' } });

    await waitFor(() => {
      expect(screen.getByText(/Invalid Ethereum address/i)).toBeInTheDocument();
    });

    expect(eventCount).toBe(0);
  });

  it('should resolve ENS name', async () => {
    // Mock ENS resolution
    const mockProvider = {
      resolveName: vi.fn(() => Promise.resolve('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'))
    };

    const { component } = render(DelegateInput, { provider: mockProvider });

    const input = screen.getByPlaceholderText(/Enter delegate address/i);
    await fireEvent.input(input, { target: { value: 'vitalik.eth' } });

    await waitFor(() => {
      expect(screen.getByText(/Resolved:/i)).toBeInTheDocument();
    });

    expect(mockProvider.resolveName).toHaveBeenCalledWith('vitalik.eth');
  });

  it('should show error for unresolved ENS name', async () => {
    const mockProvider = {
      resolveName: vi.fn(() => Promise.resolve(null))
    };

    render(DelegateInput, { provider: mockProvider });

    const input = screen.getByPlaceholderText(/Enter delegate address/i);
    await fireEvent.input(input, { target: { value: 'nonexistent.eth' } });

    await waitFor(() => {
      expect(screen.getByText(/ENS name not found/i)).toBeInTheDocument();
    });
  });

  it('should clear error when input is cleared', async () => {
    render(DelegateInput);

    const input = screen.getByPlaceholderText(/Enter delegate address/i);

    // Enter invalid address
    await fireEvent.input(input, { target: { value: 'invalid' } });

    await waitFor(() => {
      expect(screen.getByText(/Invalid Ethereum address/i)).toBeInTheDocument();
    });

    // Clear input
    await fireEvent.input(input, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.queryByText(/Invalid Ethereum address/i)).not.toBeInTheDocument();
    });
  });

  it('should show suggestion for address book', async () => {
    const addressBook = [
      { name: 'Alice', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' },
      { name: 'Bob', address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed' }
    ];

    render(DelegateInput, { addressBook });

    const input = screen.getByPlaceholderText(/Enter delegate address/i);
    await fireEvent.focus(input);

    // Should show suggestions
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('should filter suggestions based on input', async () => {
    const addressBook = [
      { name: 'Alice', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' },
      { name: 'Bob', address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed' }
    ];

    render(DelegateInput, { addressBook });

    const input = screen.getByPlaceholderText(/Enter delegate address/i);
    await fireEvent.input(input, { target: { value: 'Ali' } });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });
  });

  it('should select suggestion on click', async () => {
    const addressBook = [
      { name: 'Alice', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' }
    ];

    const { component } = render(DelegateInput, { addressBook });
    let emittedAddress: string | null = null;

    component.$on('addressChanged', (event: CustomEvent) => {
      emittedAddress = event.detail.address;
    });

    const input = screen.getByPlaceholderText(/Enter delegate address/i);
    await fireEvent.focus(input);

    const aliceButton = await screen.findByText('Alice');
    await fireEvent.click(aliceButton);

    expect(emittedAddress).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
  });

  it('should prevent self-delegation', async () => {
    const userAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    render(DelegateInput, { userAddress });

    const input = screen.getByPlaceholderText(/Enter delegate address/i);
    await fireEvent.input(input, { target: { value: userAddress } });

    await waitFor(() => {
      expect(screen.getByText(/Cannot delegate to yourself/i)).toBeInTheDocument();
    });
  });

  it('should show loading state during ENS resolution', async () => {
    const mockProvider = {
      resolveName: vi.fn(() => new Promise(resolve => setTimeout(() => resolve('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'), 100)))
    };

    render(DelegateInput, { provider: mockProvider });

    const input = screen.getByPlaceholderText(/Enter delegate address/i);
    await fireEvent.input(input, { target: { value: 'vitalik.eth' } });

    expect(screen.getByText(/Resolving.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/Resolving.../i)).not.toBeInTheDocument();
    }, { timeout: 200 });
  });
});
