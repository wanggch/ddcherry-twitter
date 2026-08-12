/**
 * Popup script for X Post Saver
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

import type {
  ArticleData,
  ClipboardResult,
  ContentData,
  ContentType,
  SaveResult,
} from '../common/types';
import { getConfig, isConfigValid, hasApiUrl } from '../common/storage';
import { formatContentAsMarkdown } from '../common/markdownFormatter';
import { showToastInPage, type ToastType } from '../common/toast';

/**
 * Popup state interface
 */
interface PopupState {
  pageType: ContentType | null;
  contentData: ContentData | null;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  localSaveStatus: 'idle' | 'saving' | 'success' | 'error';
  errorMessage: string | null;
  configValid: boolean;
  extractionWarning: string | null;
  hasApiUrl: boolean; // Whether API URL is configured (false = clipboard mode)
  apiKey: string;
}

// DOM Elements
let statusIcon: HTMLElement;
let statusText: HTMLElement;
let previewSection: HTMLElement;
let previewTitle: HTMLElement;
let coverPreview: HTMLImageElement;
let authorName: HTMLElement;
let authorHandle: HTMLElement;
let contentPreview: HTMLElement;
let timestampText: HTMLElement;
let saveButton: HTMLButtonElement;
let localSaveButton: HTMLButtonElement;
let resultSection: HTMLElement;
let resultMessage: HTMLElement;

// State
const state: PopupState = {
  pageType: null,
  contentData: null,
  saveStatus: 'idle',
  localSaveStatus: 'idle',
  errorMessage: null,
  configValid: false,
  extractionWarning: null,
  hasApiUrl: false,
  apiKey: '',
};

const LOCAL_NOTE_API_URL = 'http://127.0.0.1:27123/api/note';

/**
 * Truncates content with ellipsis
 * Requirements: 2.4, 5.1
 */
function truncateContent(content: string, maxLength: number): string {
  if (!content || typeof content !== 'string' || maxLength <= 0) {
    return '';
  }
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength) + '...';
}

function formatDisplayTime(value: string): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function sanitizeTitleText(value: string): string {
  return value
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '');
}

function normalizeTitle(value: string): string {
  const sanitized = sanitizeTitleText(value);
  const collapsed = sanitized.replace(/\s+/g, ' ').trim();
  if (!collapsed) {
    return 'Untitled';
  }
  return collapsed.length > 100 ? collapsed.slice(0, 100) : collapsed;
}

function formatTitleTimestamp(value: string): string {
  const date = new Date(value);
  const safeDate = isNaN(date.getTime()) ? new Date() : date;
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');
  const hours = String(safeDate.getHours()).padStart(2, '0');
  const minutes = String(safeDate.getMinutes()).padStart(2, '0');
  const seconds = String(safeDate.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function getContentTitle(contentData: ContentData): string {
  if (contentData.type === 'article') {
    const rawTitle = contentData.title ? contentData.title.trim() : '';
    if (rawTitle) {
      return normalizeTitle(rawTitle);
    }
    return 'Untitled';
  }

  const authorLabel =
    (contentData.author?.displayName || contentData.author?.handle || 'Unknown').trim();
  const timestamp = formatTitleTimestamp(contentData.createdAt);
  const prefix = `${timestamp}-`;
  const remaining = Math.max(0, 100 - prefix.length);
  const authorTitle = normalizeTitle(authorLabel).slice(0, remaining);
  return `${prefix}${authorTitle || 'Unknown'}`;
}

function formatContentForLocalNote(contentData: ContentData): string {
  const markdown = formatContentAsMarkdown(contentData);
  if (contentData.type !== 'article') {
    return markdown;
  }
  return markdown.replace(/^# .*(\r?\n)+/, '');
}

/**
 * Initialize DOM element references
 */
function initElements(): void {
  statusIcon = document.getElementById('status-icon')!;
  statusText = document.getElementById('status-text')!;
  previewSection = document.getElementById('preview-section')!;
  previewTitle = document.getElementById('preview-title')!;
  coverPreview = document.getElementById('cover-preview') as HTMLImageElement;
  authorName = document.getElementById('author-name')!;
  authorHandle = document.getElementById('author-handle')!;
  contentPreview = document.getElementById('content-preview')!;
  timestampText = document.getElementById('timestamp-text')!;
  saveButton = document.getElementById('save-button') as HTMLButtonElement;
  localSaveButton = document.getElementById('local-save-button') as HTMLButtonElement;
  resultSection = document.getElementById('result-section')!;
  resultMessage = document.getElementById('result-message')!;
}


/**
 * Update the status indicator UI
 * Requirements: 2.2, 2.3
 */
function updateStatusUI(): void {
  if (state.pageType === 'post') {
    statusIcon.className = 'status-icon valid';
    statusText.textContent = 'Valid post page';
  } else if (state.pageType === 'article') {
    statusIcon.className = 'status-icon valid';
    statusText.textContent = 'Valid article page';
  } else {
    statusIcon.className = 'status-icon invalid';
    statusText.textContent = 'Not a supported X page';
  }
}

/**
 * Update the preview section UI
 * Requirements: 2.4
 */
function updatePreviewUI(): void {
  if (state.contentData && state.pageType) {
    const isArticle = state.contentData.type === 'article';
    if (isArticle) {
      const articleData = state.contentData as ArticleData;
      previewTitle.textContent = articleData.title;
      previewTitle.classList.remove('hidden');

      if (articleData.coverImage) {
        coverPreview.src = articleData.coverImage;
        coverPreview.classList.remove('hidden');
      } else {
        coverPreview.classList.add('hidden');
        coverPreview.removeAttribute('src');
      }
    } else {
      previewTitle.textContent = '';
      previewTitle.classList.add('hidden');
      coverPreview.classList.add('hidden');
      coverPreview.removeAttribute('src');
    }

    authorName.textContent = state.contentData.author.displayName;
    authorHandle.textContent = state.contentData.author.handle;
    const previewLength = isArticle ? 200 : 50;
    contentPreview.textContent = truncateContent(state.contentData.content, previewLength);
    const formattedTime = formatDisplayTime(state.contentData.createdAt);
    timestampText.textContent = formattedTime;
    timestampText.classList.toggle('hidden', !formattedTime);
    previewSection.classList.remove('hidden');
  } else {
    previewSection.classList.add('hidden');
  }
}

/**
 * Update the save button state
 * Requirements: 2.3, 2.5, 8.1
 */
function updateSaveButtonUI(): void {
  const canSave = !!state.pageType && state.configValid && state.contentData !== null;
  const isBusy = state.saveStatus === 'saving' || state.localSaveStatus === 'saving';
  saveButton.disabled = !canSave || isBusy;
  localSaveButton.disabled = !canSave || isBusy;
  
  if (state.saveStatus === 'saving') {
    saveButton.textContent = state.hasApiUrl ? '保存中...' : '复制中...';
  } else {
    // Update button text based on mode (Requirements: 8.1)
    saveButton.textContent = state.hasApiUrl ? '保存到后端' : '复制到剪切板';
  }

  if (state.localSaveStatus === 'saving') {
    localSaveButton.textContent = '保存中...';
  } else {
    localSaveButton.textContent = '保存到本地';
  }
}

/**
 * Show result message
 * Requirements: 2.6, 2.7
 */
function showResult(success: boolean, message: string, isWarning: boolean = false): void {
  resultMessage.textContent = message;
  if (isWarning) {
    resultMessage.className = 'result warning';
  } else {
    resultMessage.className = success ? 'result success' : 'result error';
  }
  resultSection.classList.remove('hidden');
}

/**
 * Hide result message
 */
function hideResult(): void {
  resultSection.classList.add('hidden');
}

/**
 * Get the current active tab
 */
async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

/**
 * Show a toast notification in the current active tab.
 */
async function showToastInCurrentTab(message: string, type: ToastType): Promise<void> {
  const tab = await getCurrentTab();
  if (!tab?.id) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showToastInPage,
      args: [type === 'success' ? 'X Post Saver' : 'X Post Saver - Error', message, type],
    });
  } catch (error) {
    console.error('Failed to show toast from popup:', error);
  }
}

/**
 * Check if current page is a supported content page
 * Requirements: 2.2, 2.3
 */
async function checkPageType(): Promise<ContentType | null> {
  const tab = await getCurrentTab();
  if (!tab?.id || !tab.url) {
    return null;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_PAGE_TYPE' });
    if (response?.type === 'PAGE_TYPE') {
      return response.payload;
    }
  } catch {
    // ignore and try fallbacks
  }

  try {
    const [articleResp, postResp] = await Promise.allSettled([
      chrome.tabs.sendMessage(tab.id, { type: 'CHECK_ARTICLE_PAGE' }),
      chrome.tabs.sendMessage(tab.id, { type: 'CHECK_POST_PAGE' }),
    ]);

    const isArticle =
      articleResp.status === 'fulfilled' && articleResp.value?.payload === true;
    if (isArticle) {
      return 'article';
    }

    const isPost = postResp.status === 'fulfilled' && postResp.value?.payload === true;
    if (isPost) {
      return 'post';
    }
  } catch {
    // no-op
  }

  return null;
}

/**
 * Extraction result with details
 */
interface ExtractionResponse {
  success: boolean;
  data?: ContentData;
  error?: string;
  missingFields?: string[];
  contentType?: ContentType | null;
}

/**
 * Request content data from content script with detailed error info
 * Requirements: 2.4, 1.8, 5.1
 */
async function getContentDataWithDetails(): Promise<ExtractionResponse> {
  const tab = await getCurrentTab();
  if (!tab?.id) {
    return { success: false, error: 'Could not access the current tab' };
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_DATA_WITH_DETAILS' });
    if (response?.type === 'EXTRACTION_RESULT') {
      return response.payload;
    }
    // Fallback to simple extraction
    const [articleResp, postResp] = await Promise.allSettled([
      chrome.tabs.sendMessage(tab.id, { type: 'GET_ARTICLE_DATA_WITH_DETAILS' }),
      chrome.tabs.sendMessage(tab.id, { type: 'GET_POST_DATA_WITH_DETAILS' }),
    ]);

    if (articleResp.status === 'fulfilled' && articleResp.value?.type === 'EXTRACTION_RESULT') {
      return articleResp.value.payload;
    }
    if (postResp.status === 'fulfilled' && postResp.value?.type === 'EXTRACTION_RESULT') {
      return postResp.value.payload;
    }
    return { success: false, error: 'Failed to extract page data' };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to communicate with page'
    };
  }
}



/**
 * Save content to backend via service worker
 * Requirements: 2.5, 2.6, 2.7
 */
async function saveContentToBackend(): Promise<SaveResult> {
  if (!state.contentData) {
    return { success: false, error: 'No content data available' };
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_CONTENT',
      payload: state.contentData,
    });
    
    if (response?.type === 'SAVE_RESULT') {
      return response.payload;
    }
    if (response?.type === 'ERROR') {
      return { success: false, error: response.payload };
    }
    return { success: false, error: 'Unknown error occurred' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save content' };
  }
}

/**
 * Save content to local Markdown API
 */
async function saveContentToLocal(): Promise<SaveResult> {
  if (!state.contentData) {
    return { success: false, error: 'No content data available' };
  }

  const title = getContentTitle(state.contentData);
  const content = formatContentForLocalNote(state.contentData);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const apiKey = state.apiKey.trim();
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  try {
    const response = await fetch(LOCAL_NOTE_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, content }),
    });

    if (response.ok) {
      let message = 'Saved to local notes!';
      try {
        const data = await response.json();
        if (data?.path) {
          message = `Saved to ${data.path}`;
        } else if (data?.filename) {
          message = `Saved as ${data.filename}`;
        }
      } catch {
        // Ignore non-JSON responses
      }
      return { success: true, message };
    }

    let errorMessage = 'Failed to save to local notes';
    try {
      const data = await response.json();
      if (data?.error?.message) {
        errorMessage = data.error.message;
      } else if (data?.message) {
        errorMessage = data.message;
      }
    } catch {
      // Ignore non-JSON responses
    }
    return { success: false, error: errorMessage };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reach local note service',
    };
  }
}

/**
 * Copy post to clipboard as Markdown
 * Requirements: 8.1, 8.7, 8.8
 * 
 * Note: We use the clipboard API directly in the popup context
 * because it has the user interaction context needed for clipboard access.
 * Content scripts lose this context when receiving messages.
 */
async function copyContentToClipboard(): Promise<SaveResult> {
  if (!state.contentData) {
    return { success: false, error: 'No content data available' };
  }

  const markdown = formatContentAsMarkdown(state.contentData);
  const label = state.contentData.type === 'article' ? 'Article' : 'Post';

  try {
    // Use clipboard API directly in popup context (has user interaction)
    await navigator.clipboard.writeText(markdown);
    return { success: true, message: `${label} copied to clipboard!` };
  } catch (error) {
    // Fallback: try via content script (may work in some contexts)
    const tab = await getCurrentTab();
    if (tab?.id) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'COPY_TO_CLIPBOARD',
          payload: markdown,
        });
        
        if (response?.type === 'CLIPBOARD_RESULT') {
          const result = response.payload as ClipboardResult;
          if (result.success) {
            return { success: true, message: `${label} copied to clipboard!` };
          }
        }
      } catch {
        // Content script fallback also failed
      }
    }
    
    // Both methods failed
    if (error instanceof Error) {
      return { success: false, error: `Failed to copy: ${error.message}` };
    }
    return { success: false, error: 'Failed to copy to clipboard' };
  }
}


/**
 * Handle save button click
 * Requirements: 2.5, 2.6, 2.7, 8.1, 8.7, 8.8
 */
async function handleSaveClick(): Promise<void> {
  if (state.saveStatus === 'saving' || state.localSaveStatus === 'saving') {
    return;
  }

  state.saveStatus = 'saving';
  updateSaveButtonUI();
  hideResult();

  // Choose save method based on whether API URL is configured
  const result = state.hasApiUrl 
    ? await saveContentToBackend() 
    : await copyContentToClipboard();

  if (result.success) {
    state.saveStatus = 'success';
    const label = state.contentData?.type === 'article' ? 'Article' : 'Post';
    const defaultMessage = state.hasApiUrl ? `${label} saved successfully!` : `${label} copied to clipboard!`;
    await showToastInCurrentTab(result.message ?? defaultMessage, 'success');
  } else {
    state.saveStatus = 'error';
    const label = state.contentData?.type === 'article' ? 'article' : 'post';
    const baseError = state.hasApiUrl ? `Failed to save ${label}` : 'Failed to copy to clipboard';
    state.errorMessage =
      state.hasApiUrl && label === 'article' && result.error
        ? `Failed to save article: ${result.error}`
        : result.error ?? baseError;
    await showToastInCurrentTab(state.errorMessage, 'error');
  }

  updateSaveButtonUI();
}

/**
 * Handle local save button click
 */
async function handleLocalSaveClick(): Promise<void> {
  if (state.localSaveStatus === 'saving' || state.saveStatus === 'saving') {
    return;
  }

  state.localSaveStatus = 'saving';
  updateSaveButtonUI();
  hideResult();

  const result = await saveContentToLocal();

  if (result.success) {
    state.localSaveStatus = 'success';
    await showToastInCurrentTab(result.message ?? 'Saved to local notes!', 'success');
  } else {
    state.localSaveStatus = 'error';
    await showToastInCurrentTab(result.error ?? 'Failed to save to local notes', 'error');
  }

  updateSaveButtonUI();
}

/**
 * Initialize the popup
 * Requirements: 2.1, 2.2, 2.3, 2.4, 1.8, 8.1
 */
async function init(): Promise<void> {
  initElements();

  // Check configuration validity
  const config = await getConfig();
  state.configValid = isConfigValid(config);
  state.hasApiUrl = hasApiUrl(config);
  state.apiKey = config.apiKey ?? '';

  if (!state.configValid) {
    statusIcon.className = 'status-icon warning';
    statusText.textContent = 'Configuration error. Please check options.';
    statusText.style.cursor = 'pointer';
    statusText.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    saveButton.disabled = true;
    localSaveButton.disabled = true;
    return;
  }

  // Check if current page is a supported page
  state.pageType = await checkPageType();
  updateStatusUI();

  if (state.pageType) {
    // Get content data for preview with detailed error info
    const extractionResult = await getContentDataWithDetails();
    
    if (extractionResult.success && extractionResult.data) {
      state.contentData = extractionResult.data;
      state.pageType = extractionResult.contentType ?? state.pageType;
      
      // Show warning if some fields couldn't be extracted
      if (extractionResult.missingFields && extractionResult.missingFields.length > 0) {
        state.extractionWarning = `Note: Some data may be incomplete (${extractionResult.missingFields.join(', ')})`;
        showResult(false, state.extractionWarning, true);
      }
    } else if (extractionResult.error) {
      // Show extraction error
      state.errorMessage = extractionResult.error;
      showResult(false, extractionResult.error);
    }
    
    updatePreviewUI();
  }

  updateSaveButtonUI();

  // Attach event listener
  saveButton.addEventListener('click', handleSaveClick);
  localSaveButton.addEventListener('click', handleLocalSaveClick);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
