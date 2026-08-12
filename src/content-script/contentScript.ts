/**
 * Content script for X Post Saver
 * This script runs on X/Twitter pages and extracts post data
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.2, 2.3
 */

import { Message, MessageResponse } from '../common/types';
import { detectContentType, isArticlePage, isPostDetailPage } from '../common/urlParser';
import { extractPostData, extractPostDataWithDetails } from './postExtractor';
import { extractArticleData, extractArticleDataWithDetails } from './articleExtractor';
import { formatErrorMessage } from '../common/errors';

function isArticleDomPresent(): boolean {
  return (
    document.querySelector('[data-testid="longformRichTextComponent"]') !== null ||
    document.querySelector('[data-testid="twitterArticleReadView"]') !== null ||
    document.querySelector('[data-testid="twitterArticleRichTextView"]') !== null
  );
}

/**
 * Handles incoming messages from popup or service worker
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.2, 2.3
 */
function handleMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
): boolean {
  switch (message.type) {
    case 'GET_POST_DATA': {
      // Extract post data from the current page
      const postData = extractPostData();
      sendResponse({
        type: 'POST_DATA',
        payload: postData,
      });
      return true;
    }
    
    case 'GET_POST_DATA_WITH_DETAILS': {
      // Extract post data with detailed error information
      // Requirements: 1.8
      const result = extractPostDataWithDetails();
      sendResponse({
        type: 'EXTRACTION_RESULT',
        payload: {
          success: result.success,
          data: result.data,
          error: result.error ? formatErrorMessage(result.error) : undefined,
          missingFields: result.missingFields,
          contentType: 'post',
        },
      });
      return true;
    }
    
    case 'GET_ARTICLE_DATA': {
      const articleData = extractArticleData();
      sendResponse({
        type: 'ARTICLE_DATA',
        payload: articleData,
      });
      return true;
    }

    case 'GET_ARTICLE_DATA_WITH_DETAILS': {
      const result = extractArticleDataWithDetails();
      sendResponse({
        type: 'EXTRACTION_RESULT',
        payload: {
          success: result.success,
          data: result.data,
          error: result.error ? formatErrorMessage(result.error) : undefined,
          missingFields: result.missingFields,
          contentType: 'article',
        },
      });
      return true;
    }

    case 'GET_PAGE_DATA_WITH_DETAILS': {
      // Always attempt article extraction first to handle articles embedded in status pages
      const articleResult = extractArticleDataWithDetails();
      if (articleResult.success) {
        sendResponse({
          type: 'EXTRACTION_RESULT',
          payload: {
            success: articleResult.success,
            data: articleResult.data,
            error: articleResult.error ? formatErrorMessage(articleResult.error) : undefined,
            missingFields: articleResult.missingFields,
            contentType: 'article',
          },
        });
        return true;
      }

      // Fallback to post extraction
      const postResult = extractPostDataWithDetails();
      sendResponse({
        type: 'EXTRACTION_RESULT',
        payload: {
          success: postResult.success,
          data: postResult.data,
          error: postResult.error ? formatErrorMessage(postResult.error) : undefined,
          missingFields: postResult.missingFields,
          contentType: postResult.success ? 'post' : null,
        },
      });
      return true;
    }

    case 'CHECK_POST_PAGE': {
      // Check if current page is a post detail page
      const currentUrl = window.location.href;
      const isPostPage = isPostDetailPage(currentUrl);
      sendResponse({
        type: 'IS_POST_PAGE',
        payload: isPostPage,
      });
      return true;
    }

    case 'CHECK_ARTICLE_PAGE': {
      const currentUrl = window.location.href;
      const isArticle = isArticlePage(currentUrl);
      sendResponse({
        type: 'IS_ARTICLE_PAGE',
        payload: isArticle,
      });
      return true;
    }

    case 'CHECK_PAGE_TYPE': {
      const pageType = isArticlePage(window.location.href) || isArticleDomPresent()
        ? 'article'
        : detectContentType(window.location.href);
      sendResponse({
        type: 'PAGE_TYPE',
        payload: pageType,
      });
      return true;
    }
    
    case 'COPY_TO_CLIPBOARD': {
      // Copy text to clipboard
      // Requirements: 8.1, 8.7, 8.8
      const textToCopy = message.payload;
      copyToClipboard(textToCopy).then((result) => {
        sendResponse({
          type: 'CLIPBOARD_RESULT',
          payload: result,
        });
      });
      return true; // Keep channel open for async response
    }
    
    default:
      // Unknown message type
      sendResponse({
        type: 'ERROR',
        payload: 'Unknown message type',
      });
      return true;
  }
}

/**
 * Copies text to clipboard using the Clipboard API
 * Requirements: 8.1, 8.7, 8.8
 * 
 * @param text - The text to copy to clipboard
 * @returns Promise resolving to clipboard operation result
 */
async function copyToClipboard(text: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!navigator.clipboard) {
      return { success: false, error: 'Clipboard API not available' };
    }
    await navigator.clipboard.writeText(text);
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        return { success: false, error: 'Clipboard permission denied' };
      }
      return { success: false, error: `Failed to copy to clipboard: ${error.message}` };
    }
    return { success: false, error: 'Failed to copy to clipboard' };
  }
}

// Register message listener
chrome.runtime.onMessage.addListener(handleMessage);

console.log('X Post Saver content script loaded');
