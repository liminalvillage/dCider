<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { ethers } from 'ethers';

  export let userAddress: string | null = null;
  export let provider: any = null;
  export let addressBook: Array<{ name: string; address: string }> = [];

  const dispatch = createEventDispatcher();

  let inputValue = '';
  let validAddress: string | null = null;
  let error: string | null = null;
  let resolving = false;
  let resolvedAddress: string | null = null;
  let showSuggestions = false;
  let filteredSuggestions: Array<{ name: string; address: string }> = [];

  $: {
    validateAddress(inputValue);
  }

  $: {
    if (inputValue && addressBook.length > 0) {
      filteredSuggestions = addressBook.filter(
        (entry) =>
          entry.name.toLowerCase().includes(inputValue.toLowerCase()) ||
          entry.address.toLowerCase().includes(inputValue.toLowerCase())
      );
    } else {
      filteredSuggestions = addressBook;
    }
  }

  async function validateAddress(value: string) {
    error = null;
    validAddress = null;
    resolvedAddress = null;

    if (!value) {
      return;
    }

    // Check if it's a valid Ethereum address
    if (ethers.isAddress(value)) {
      const checksumAddress = ethers.getAddress(value);

      // Check for zero address
      if (checksumAddress === ethers.ZeroAddress) {
        error = 'Cannot delegate to zero address';
        return;
      }

      // Check for self-delegation
      if (userAddress && checksumAddress.toLowerCase() === userAddress.toLowerCase()) {
        error = 'Cannot delegate to yourself';
        return;
      }

      // Valid address
      validAddress = checksumAddress;
      inputValue = checksumAddress; // Normalize to checksum
      dispatch('addressChanged', { address: checksumAddress });
      return;
    }

    // Check if it might be an ENS name
    if (value.endsWith('.eth') && provider) {
      await resolveENS(value);
      return;
    }

    // Invalid address
    error = 'Invalid Ethereum address';
  }

  async function resolveENS(ensName: string) {
    resolving = true;
    error = null;

    try {
      const address = await provider.resolveName(ensName);

      if (!address) {
        error = 'ENS name not found';
        return;
      }

      const checksumAddress = ethers.getAddress(address);

      // Check for self-delegation
      if (userAddress && checksumAddress.toLowerCase() === userAddress.toLowerCase()) {
        error = 'Cannot delegate to yourself';
        return;
      }

      resolvedAddress = checksumAddress;
      validAddress = checksumAddress;
      dispatch('addressChanged', { address: checksumAddress });
    } catch (e: any) {
      error = 'Failed to resolve ENS name';
      console.error('ENS resolution error:', e);
    } finally {
      resolving = false;
    }
  }

  function handleFocus() {
    if (addressBook.length > 0) {
      showSuggestions = true;
    }
  }

  function handleBlur() {
    // Delay to allow click on suggestion
    setTimeout(() => {
      showSuggestions = false;
    }, 200);
  }

  function selectSuggestion(entry: { name: string; address: string }) {
    inputValue = entry.address;
    showSuggestions = false;
    validateAddress(entry.address);
  }

  function handleInput(event: Event) {
    inputValue = (event.target as HTMLInputElement).value;
  }
</script>

<div class="delegate-input">
  <label for="delegate-address">Delegate Address</label>

  <div class="input-container">
    <input
      id="delegate-address"
      type="text"
      placeholder="Enter delegate address or ENS name"
      value={inputValue}
      on:input={handleInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
      class:error={!!error}
      class:valid={!!validAddress}
    />

    {#if resolving}
      <div class="input-indicator">Resolving...</div>
    {:else if validAddress}
      <div class="input-indicator valid">✓</div>
    {/if}
  </div>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if resolvedAddress}
    <div class="resolved-message">
      Resolved: {resolvedAddress.slice(0, 10)}...{resolvedAddress.slice(-8)}
    </div>
  {/if}

  {#if showSuggestions && filteredSuggestions.length > 0}
    <div class="suggestions">
      {#each filteredSuggestions as suggestion}
        <button
          class="suggestion-item"
          on:click={() => selectSuggestion(suggestion)}
        >
          <span class="suggestion-name">{suggestion.name}</span>
          <span class="suggestion-address">
            {suggestion.address.slice(0, 8)}...{suggestion.address.slice(-6)}
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .delegate-input {
    position: relative;
    margin-bottom: 1rem;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #d1d5db;
  }

  .input-container {
    position: relative;
  }

  input {
    width: 100%;
    max-width: 100%;
    padding: 0.75rem;
    padding-right: 3rem;
    border: 1px solid #374151;
    border-radius: 8px;
    font-size: 0.95rem;
    font-family: 'Monaco', 'Courier New', monospace;
    transition: all 0.3s ease;
    background: #111827;
    color: #e5e7eb;
    box-sizing: border-box;
  }

  input::placeholder {
    color: #6b7280;
  }

  input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  input.error {
    border-color: #ef4444;
  }

  input.valid {
    border-color: #10b981;
  }

  .input-indicator {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.875rem;
    color: #9ca3af;
  }

  .input-indicator.valid {
    color: #6ee7b7;
    font-size: 1.25rem;
  }

  .error-message {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    border-radius: 4px;
    color: #fca5a5;
    font-size: 0.875rem;
  }

  .resolved-message {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid #10b981;
    border-radius: 4px;
    color: #6ee7b7;
    font-size: 0.875rem;
    font-family: 'Monaco', 'Courier New', monospace;
  }

  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.5rem;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
  }

  .suggestion-item {
    width: 100%;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s ease;
  }

  .suggestion-item:hover {
    background: #374151;
  }

  .suggestion-item:not(:last-child) {
    border-bottom: 1px solid #374151;
  }

  .suggestion-name {
    font-weight: 500;
    color: #d1d5db;
  }

  .suggestion-address {
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 0.875rem;
    color: #9ca3af;
  }
</style>
