/**
 * Notification Store
 * Manages toast notifications for user feedback
 */

import { writable } from 'svelte/store';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number; // in ms, 0 = permanent
}

function createNotificationStore() {
  const { subscribe, update } = writable<Notification[]>([]);

  return {
    subscribe,

    /**
     * Add a notification
     */
    add(notification: Omit<Notification, 'id'>): string {
      const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const duration = notification.duration ?? 5000;

      const newNotification: Notification = {
        id,
        ...notification,
        duration
      };

      update(notifications => [...notifications, newNotification]);

      // Auto-remove after duration (if not permanent)
      if (duration > 0) {
        setTimeout(() => {
          this.remove(id);
        }, duration);
      }

      return id;
    },

    /**
     * Remove a notification
     */
    remove(id: string) {
      update(notifications => notifications.filter(n => n.id !== id));
    },

    /**
     * Clear all notifications
     */
    clear() {
      update(() => []);
    },

    /**
     * Convenience methods
     */
    success(message: string, duration?: number) {
      return this.add({ type: 'success', message, duration });
    },

    error(message: string, duration?: number) {
      return this.add({ type: 'error', message, duration });
    },

    info(message: string, duration?: number) {
      return this.add({ type: 'info', message, duration });
    },

    warning(message: string, duration?: number) {
      return this.add({ type: 'warning', message, duration });
    }
  };
}

export const notifications = createNotificationStore();
