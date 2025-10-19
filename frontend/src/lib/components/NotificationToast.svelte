<script lang="ts">
  import { notifications } from '$lib/stores/notifications';
  import { formatAddress } from '$lib/web3/walletConnect';

  function getIcon(type: string) {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return '';
    }
  }
</script>

<div class="toast-container">
  {#each $notifications as notification (notification.id)}
    <div
      class="toast toast-{notification.type}"
      on:click={() => notifications.remove(notification.id)}
    >
      <span class="toast-icon">{getIcon(notification.type)}</span>
      <span class="toast-message">{notification.message}</span>
      <button
        class="toast-close"
        on:click|stopPropagation={() => notifications.remove(notification.id)}
      >
        ×
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 400px;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: #1f2937;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    border: 1px solid #374151;
    border-left: 4px solid;
    animation: slideIn 0.3s ease-out;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  }

  .toast:hover {
    transform: translateX(-4px);
    box-shadow: 0 6px 25px rgba(0, 0, 0, 0.6);
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .toast-success {
    border-left-color: #10b981;
    background: linear-gradient(135deg, #1f2937 0%, rgba(16, 185, 129, 0.1) 100%);
  }

  .toast-error {
    border-left-color: #ef4444;
    background: linear-gradient(135deg, #1f2937 0%, rgba(239, 68, 68, 0.1) 100%);
  }

  .toast-warning {
    border-left-color: #f59e0b;
    background: linear-gradient(135deg, #1f2937 0%, rgba(245, 158, 11, 0.1) 100%);
  }

  .toast-info {
    border-left-color: #6366f1;
    background: linear-gradient(135deg, #1f2937 0%, rgba(99, 102, 241, 0.1) 100%);
  }

  .toast-icon {
    font-size: 20px;
    font-weight: bold;
    flex-shrink: 0;
  }

  .toast-success .toast-icon {
    color: #6ee7b7;
  }

  .toast-error .toast-icon {
    color: #fca5a5;
  }

  .toast-warning .toast-icon {
    color: #fbbf24;
  }

  .toast-info .toast-icon {
    color: #a5b4fc;
  }

  .toast-message {
    flex: 1;
    font-size: 14px;
    color: #e5e7eb;
    line-height: 1.4;
  }

  .toast-close {
    background: none;
    border: none;
    font-size: 24px;
    color: #6b7280;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: color 0.2s;
  }

  .toast-close:hover {
    color: #d1d5db;
  }

  @media (max-width: 768px) {
    .toast-container {
      right: 10px;
      left: 10px;
      max-width: none;
    }
  }
</style>
