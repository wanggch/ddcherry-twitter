/**
 * Background script utilities for showing in-page toast notifications.
 */

import { showToastInPage, type ToastType } from '../common/toast';

export interface ToastOptions {
  title: string;
  message: string;
  type: ToastType;
}

/**
 * Shows a toast notification in the specified tab by injecting the toast
 * function directly into the page context.
 */
export async function showToast(tabId: number, options: ToastOptions): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: showToastInPage,
      args: [options.title, options.message, options.type],
    });
  } catch (error) {
    console.error('Failed to show toast:', error);
    // Fallback to Chrome notification if toast injection fails
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: options.title,
      message: options.message,
      requireInteraction: options.type === 'error',
    });
  }
}

/**
 * Shows a success toast with a default title.
 */
export async function showSuccessToast(tabId: number, message: string): Promise<void> {
  return showToast(tabId, {
    title: 'X Post Saver',
    message,
    type: 'success',
  });
}

/**
 * Shows an error toast with a default title.
 */
export async function showErrorToast(tabId: number, message: string): Promise<void> {
  return showToast(tabId, {
    title: 'X Post Saver - Error',
    message,
    type: 'error',
  });
}
