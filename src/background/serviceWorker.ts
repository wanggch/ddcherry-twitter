/**
 * Service Worker for X Post Saver Chrome Extension
 * Handles background tasks, context menu, and API calls
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 2.5, 4.1
 */

import { saveContent } from '../common/apiClient';
import { getConfig, isConfigValid, hasApiUrl } from '../common/storage';
import { formatContentAsMarkdown } from '../common/markdownFormatter';
import { extractContentDataFromTab, copyToClipboard } from './pageUtils';
import { showSuccessToast, showErrorToast } from './toastUtils';
import { handleActionClick } from './iconClickHandler';
import type {
  ContentData,
  ContentType,
  Message,
  MessageResponse,
  PostData,
  SaveResult,
} from '../common/types';

const CONTEXT_MENU_POST_ID = 'save-x-post';
const CONTEXT_MENU_ARTICLE_ID = 'save-x-article';

/**
 * Sets up the context menu item on extension install
 * Requirements: 3.1, 3.2
 */
function setupContextMenu(): void {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_POST_ID,
    title: 'Save this post',
    contexts: ['page'],
    documentUrlPatterns: ['https://x.com/*/status/*', 'https://twitter.com/*/status/*'],
  });

  chrome.contextMenus.create({
    id: CONTEXT_MENU_ARTICLE_ID,
    title: 'Save this article',
    contexts: ['page'],
    documentUrlPatterns: ['https://x.com/i/article/*', 'https://twitter.com/i/article/*'],
  });
}

/**
 * Handles context menu click events
 * Requirements: 3.3, 3.4, 3.5, 1.8, 8.1, 8.7, 8.8
 */
async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab | undefined
): Promise<void> {
  if (
    (info.menuItemId !== CONTEXT_MENU_POST_ID &&
      info.menuItemId !== CONTEXT_MENU_ARTICLE_ID) ||
    !tab?.id
  ) {
    return;
  }

  const tabId = tab.id;
  const targetType: ContentType =
    info.menuItemId === CONTEXT_MENU_ARTICLE_ID ? 'article' : 'post';

  // Check if configuration is valid
  const config = await getConfig();
  if (!isConfigValid(config)) {
    showErrorToast(tabId, 'Configuration error. Please check extension options.');
    return;
  }

  // Extract content data from the current tab with detailed error info
  const extractionResult = await extractContentDataFromTab(tabId);
  if (!extractionResult.success || !extractionResult.data) {
    const errorMessage =
      extractionResult.error ||
      `Failed to extract ${targetType === 'article' ? 'article' : 'post'} data. Make sure you are on a supported page.`;
    showErrorToast(tabId, errorMessage);
    return;
  }

  if (targetType === 'article' && extractionResult.data.type !== 'article') {
    showErrorToast(tabId, 'Could not detect an article on this page.');
    return;
  }

  const contentData: ContentData =
    extractionResult.data.type === 'article'
      ? extractionResult.data
      : { ...extractionResult.data, type: 'post' as const };

  const isArticle = contentData.type === 'article';

  // Check if API URL is configured
  if (hasApiUrl(config)) {
    // Save the content via API
    const result = await saveContent(contentData, config);
    const successMessage = isArticle ? 'Article saved successfully!' : 'Post saved successfully';
    const errorMessage = isArticle ? 'Failed to save article' : 'Failed to save post';

    if (result.success) {
      showSuccessToast(tabId, result.message || successMessage);
    } else {
      const failureMessage =
        isArticle && result.error ? `Failed to save article: ${result.error}` : result.error || errorMessage;
      showErrorToast(tabId, failureMessage);
    }
  } else {
    // Clipboard mode - copy as Markdown
    const markdown = formatContentAsMarkdown(contentData);
    const clipboardResult = await copyToClipboard(tabId, markdown);
    if (clipboardResult.success) {
      showSuccessToast(tabId, isArticle ? 'Article copied to clipboard!' : 'Post copied to clipboard!');
    } else {
      showErrorToast(tabId, clipboardResult.error || 'Failed to copy to clipboard');
    }
  }
}

/**
 * Handles SAVE_POST message from popup
 * Requirements: 2.5, 4.1, 8.1
 */
async function handleSaveContent(contentData: ContentData): Promise<SaveResult> {
  const config = await getConfig();
  if (!isConfigValid(config)) {
    return {
      success: false,
      error: 'Configuration error. Please check extension options.',
    };
  }
  
  // Only save to backend if API URL is configured
  if (!hasApiUrl(config)) {
    // Clipboard mode is handled by popup directly
    return {
      success: false,
      error: 'No API URL configured. Use clipboard mode instead.',
    };
  }
  
  const payload = contentData.type === 'article' ? contentData : { ...contentData, type: 'post' as const };
  return saveContent(payload, config);
}

async function handleSavePost(postData: PostData): Promise<SaveResult> {
  return handleSaveContent({ ...postData, type: 'post' });
}

/**
 * Message router - handles messages from popup and content scripts
 * Requirements: 2.5, 4.1
 */
async function handleMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  switch (message.type) {
    case 'SAVE_CONTENT':
      const saveContentResult = await handleSaveContent(message.payload);
      return { type: 'SAVE_RESULT', payload: saveContentResult };

    case 'SAVE_POST':
      const saveResult = await handleSavePost(message.payload);
      return { type: 'SAVE_RESULT', payload: saveResult };

    case 'GET_CONFIG':
      const config = await getConfig();
      return { type: 'CONFIG', payload: config };

    default:
      return { type: 'ERROR', payload: 'Unknown message type' };
  }
}

// Register event listeners
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
  console.log('X Post Saver extension installed');
});

chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
chrome.action.onClicked.addListener(handleActionClick);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep the message channel open for async response
});

console.log('X Post Saver service worker loaded');
