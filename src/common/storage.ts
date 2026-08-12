/**
 * Storage utilities for X Post Saver
 * Requirements: 5.2, 5.3, 5.4
 */

import type { ExtensionConfig } from './types';

const CONFIG_KEY = 'extensionConfig';

const DEFAULT_CONFIG: ExtensionConfig = {
  apiUrl: '',
  apiKey: '',
  enableObsidian: false,
  obsidianBaseUrl: 'http://127.0.0.1:18787',
};

/**
 * Retrieves the extension configuration from chrome.storage.sync
 * Requirements: 5.2
 * 
 * @returns Promise resolving to the extension configuration
 */
export async function getConfig(): Promise<ExtensionConfig> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([CONFIG_KEY], (result) => {
      const config = result[CONFIG_KEY] as ExtensionConfig | undefined;
      resolve(config ?? DEFAULT_CONFIG);
    });
  });
}

/**
 * Saves the extension configuration to chrome.storage.sync
 * Requirements: 5.2
 * 
 * @param config - The configuration to save
 * @returns Promise resolving when the configuration is saved
 */
export async function saveConfig(config: ExtensionConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [CONFIG_KEY]: config }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Checks if the configuration has an API URL configured
 * Requirements: 5.3, 8.1
 * 
 * @param config - The configuration to check
 * @returns true if the apiUrl field is non-empty and contains non-whitespace characters
 */
export function hasApiUrl(config: ExtensionConfig): boolean {
  if (!config || typeof config.apiUrl !== 'string') {
    return false;
  }
  return config.apiUrl.trim().length > 0;
}

/**
 * Validates if the configuration is valid for the extension to operate
 * A configuration is always valid - empty API URL means clipboard-only mode
 * Requirements: 5.3, 8.1
 * 
 * @param config - The configuration to validate
 * @returns true if the configuration is valid (always true for valid config objects)
 */
export function isConfigValid(config: ExtensionConfig): boolean {
  // Configuration is always valid - empty API URL means clipboard-only mode
  // We just need to ensure the config object exists and has the expected shape
  if (!config) {
    return false;
  }
  // Both apiUrl and apiKey can be empty strings (clipboard-only mode)
  return (
    typeof config.apiUrl === 'string' &&
    typeof config.apiKey === 'string' &&
    typeof config.enableObsidian === 'boolean' &&
    typeof config.obsidianBaseUrl === 'string'
  );
}

/**
 * Checks if the stored configuration is valid
 * Requirements: 5.3, 5.4
 * 
 * @returns Promise resolving to true if the stored configuration is valid
 */
export async function isStoredConfigValid(): Promise<boolean> {
  const config = await getConfig();
  return isConfigValid(config);
}
