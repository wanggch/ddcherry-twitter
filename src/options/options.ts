/**
 * Options page script for X Post Saver
 * Requirements: 5.1, 5.2, 5.3
 */

import { getConfig, saveConfig } from '../common/storage';
import type { ExtensionConfig } from '../common/types';

// DOM Elements
const form = document.getElementById('options-form') as HTMLFormElement;
const apiUrlInput = document.getElementById('api-url') as HTMLInputElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const apiUrlError = document.getElementById('api-url-error') as HTMLSpanElement;
const saveButton = document.getElementById('save-button') as HTMLButtonElement;
const statusMessage = document.getElementById('status-message') as HTMLDivElement;
const enableObsidianInput = document.getElementById('enable-obsidian') as HTMLInputElement;
const obsidianBaseUrlInput = document.getElementById('obsidian-base-url') as HTMLInputElement;
const obsidianBaseUrlError = document.getElementById('obsidian-base-url-error') as HTMLSpanElement;

/**
 * Validates the API URL input
 * Requirements: 5.3
 * 
 * @param url - The URL to validate
 * @returns Error message if invalid, null if valid (empty URL is valid for clipboard-only mode)
 */
function validateApiUrl(url: string): string | null {
  const trimmedUrl = url.trim();
  
  // Empty URL is valid - enables clipboard-only mode (Requirements: 5.3)
  if (!trimmedUrl) {
    return null;
  }
  
  try {
    const parsedUrl = new URL(trimmedUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return 'API URL must use HTTP or HTTPS protocol';
    }
  } catch {
    return 'Please enter a valid URL';
  }
  
  return null;
}

/**
 * Shows an error message for the API URL field
 */
function showApiUrlError(message: string): void {
  apiUrlError.textContent = message;
  apiUrlError.classList.remove('hidden');
  apiUrlInput.classList.add('input-error');
}

/**
 * Clears the API URL error message
 */
function clearApiUrlError(): void {
  apiUrlError.textContent = '';
  apiUrlError.classList.add('hidden');
  apiUrlInput.classList.remove('input-error');
}

function validateObsidianBaseUrl(url: string): string | null {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return '本地服务地址不能为空';
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return '本地服务地址必须使用 HTTP 或 HTTPS 协议';
    }
  } catch {
    return '请输入有效的本地服务地址';
  }

  return null;
}

function showObsidianBaseUrlError(message: string): void {
  obsidianBaseUrlError.textContent = message;
  obsidianBaseUrlError.classList.remove('hidden');
  obsidianBaseUrlInput.classList.add('input-error');
}

function clearObsidianBaseUrlError(): void {
  obsidianBaseUrlError.textContent = '';
  obsidianBaseUrlError.classList.add('hidden');
  obsidianBaseUrlInput.classList.remove('input-error');
}

/**
 * Shows a status message
 * 
 * @param message - The message to display
 * @param type - The type of message ('success' or 'error')
 */
function showStatus(message: string, type: 'success' | 'error'): void {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.classList.remove('hidden');
  
  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.classList.add('hidden');
    }, 3000);
  }
}

/**
 * Hides the status message
 */
function hideStatus(): void {
  statusMessage.classList.add('hidden');
}

/**
 * Loads existing configuration and populates the form
 * Requirements: 5.1
 */
async function loadConfiguration(): Promise<void> {
  try {
    const config = await getConfig();
    apiUrlInput.value = config.apiUrl || '';
    apiKeyInput.value = config.apiKey || '';
    enableObsidianInput.checked = config.enableObsidian ?? false;
    obsidianBaseUrlInput.value = config.obsidianBaseUrl || '';
  } catch (error) {
    console.error('Failed to load configuration:', error);
    showStatus('Failed to load settings', 'error');
  }
}

/**
 * Handles form submission
 * Requirements: 5.2, 5.3
 */
async function handleSubmit(event: Event): Promise<void> {
  event.preventDefault();
  
  // Clear previous errors
  clearApiUrlError();
  clearObsidianBaseUrlError();
  hideStatus();

  const apiUrl = apiUrlInput.value;
  const apiKey = apiKeyInput.value;
  const enableObsidian = enableObsidianInput.checked;
  const obsidianBaseUrl = obsidianBaseUrlInput.value;

  // Validate API URL
  const urlError = validateApiUrl(apiUrl);
  if (urlError) {
    showApiUrlError(urlError);
    return;
  }

  if (enableObsidian) {
    const obsidianError = validateObsidianBaseUrl(obsidianBaseUrl);
    if (obsidianError) {
      showObsidianBaseUrlError(obsidianError);
      return;
    }
  }

  // Disable button during save
  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';

  try {
    const config: ExtensionConfig = {
      apiUrl: apiUrl.trim(),
      apiKey: apiKey.trim(),
      enableObsidian,
      obsidianBaseUrl: obsidianBaseUrl.trim(),
    };
    
    await saveConfig(config);
    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    console.error('Failed to save configuration:', error);
    showStatus('Failed to save settings. Please try again.', 'error');
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save Settings';
  }
}

/**
 * Handles real-time validation on API URL input
 */
function handleApiUrlInput(): void {
  const urlError = validateApiUrl(apiUrlInput.value);
  if (urlError && apiUrlInput.value.trim()) {
    showApiUrlError(urlError);
  } else {
    clearApiUrlError();
  }
}

// Initialize options page
document.addEventListener('DOMContentLoaded', () => {
  loadConfiguration();
  
  // Form submission handler
  form.addEventListener('submit', handleSubmit);
  
  // Real-time validation for API URL
  apiUrlInput.addEventListener('blur', handleApiUrlInput);
});
