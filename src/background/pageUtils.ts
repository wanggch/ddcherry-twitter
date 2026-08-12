/**
 * Shared background utilities for page extraction, clipboard and notifications.
 */

import type { ContentData, ContentType } from '../common/types';

export function showNotification(title: string, message: string): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title,
    message,
  });
}

export async function extractContentDataFromTab(tabId: number): Promise<{
  success: boolean;
  data?: ContentData;
  error?: string;
  contentType?: ContentType | null;
}> {
  const tryExtract = async (): Promise<{
    success: boolean;
    data?: ContentData;
    error?: string;
    contentType?: ContentType | null;
  }> => {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_DATA_WITH_DETAILS' });
    if (response && response.type === 'EXTRACTION_RESULT') {
      return response.payload;
    }

    const [articleResp, postResp] = await Promise.allSettled([
      chrome.tabs.sendMessage(tabId, { type: 'GET_ARTICLE_DATA_WITH_DETAILS' }),
      chrome.tabs.sendMessage(tabId, { type: 'GET_POST_DATA_WITH_DETAILS' }),
    ]);

    if (articleResp.status === 'fulfilled' && articleResp.value?.type === 'EXTRACTION_RESULT') {
      return articleResp.value.payload;
    }
    if (postResp.status === 'fulfilled' && postResp.value?.type === 'EXTRACTION_RESULT') {
      return postResp.value.payload;
    }

    return { success: false, error: 'Could not find content on this page', contentType: null };
  };

  try {
    return await tryExtract();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Receiving end does not exist')) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-script.js'],
        });
        // Give the content script a moment to initialize its listener.
        await new Promise((resolve) => setTimeout(resolve, 150));
        return await tryExtract();
      } catch (injectionError) {
        console.error('Failed to inject content script:', injectionError);
      }
    }
    console.error('Failed to extract content data:', error);
    return {
      success: false,
      error: 'Failed to communicate with page. Try refreshing the page.',
      contentType: null,
    };
  }
}

export async function copyToClipboard(
  tabId: number,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (textToCopy: string) => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(textToCopy);
            return { success: true };
          }

          const textarea = document.createElement('textarea');
          textarea.value = textToCopy;
          textarea.style.position = 'fixed';
          textarea.style.left = '-9999px';
          textarea.style.top = '-9999px';
          document.body.appendChild(textarea);
          textarea.select();
          const success = document.execCommand('copy');
          document.body.removeChild(textarea);

          if (success) {
            return { success: true };
          }
          return { success: false, error: 'execCommand copy failed' };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Clipboard operation failed',
          };
        }
      },
      args: [text],
    });

    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
    return { success: false, error: 'Failed to execute clipboard script' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to copy to clipboard',
    };
  }
}
