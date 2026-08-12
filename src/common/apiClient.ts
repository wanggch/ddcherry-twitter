/**
 * API Client for X Post Saver
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import type { ContentData, PostData, SaveResult, ExtensionConfig } from './types';
import { serializeContentData } from './serialization';
import { createApiError, createNetworkError, formatErrorMessage } from './errors';

/**
 * Generates the Authorization header value for API requests
 * Requirements: 4.3
 * 
 * @param apiKey - The API key to use
 * @returns The Authorization header value in Bearer token format
 */
export function generateAuthHeader(apiKey: string): string {
  return `Bearer ${apiKey}`;
}

/**
 * Sends content data to the configured backend API
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 * 
 * @param contentData - The content data to save
 * @param config - The extension configuration containing API URL and key
 * @returns Promise resolving to the save result
 */
export async function saveContent(
  contentData: ContentData,
  config: ExtensionConfig
): Promise<SaveResult> {
  const { apiUrl, apiKey } = config;

  if (!apiUrl || apiUrl.trim().length === 0) {
    return {
      success: false,
      error: 'API URL is not configured',
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add Authorization header if API key is provided
  if (apiKey && apiKey.trim().length > 0) {
    headers['Authorization'] = generateAuthHeader(apiKey);
  }

  try {
    const payload = contentData.type === 'article' ? contentData : { ...contentData, type: 'post' as const };
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: serializeContentData(payload),
    });

    if (response.ok) {
      // Requirements: 4.4 - Success response (2xx status)
      const defaultMessage = payload.type === 'article' ? 'Article saved successfully' : 'Post saved successfully';
      let message = defaultMessage;
      try {
        const data = await response.json();
        if (data.message) {
          message = data.message;
        }
      } catch {
        // Response may not be JSON, use default message
      }
      return {
        success: true,
        message,
      };
    } else {
      // Requirements: 4.5 - Error response (non-2xx status)
      let responseMessage: string | undefined;
      try {
        const data = await response.json();
        responseMessage = data.error || data.message;
      } catch {
        // Response may not be JSON
      }
      
      const error = createApiError(response.status, response.statusText, responseMessage);
      return {
        success: false,
        error: formatErrorMessage(error),
      };
    }
  } catch (error) {
    // Requirements: 4.6 - Network error
    const networkError = createNetworkError(error);
      return {
        success: false,
        error: formatErrorMessage(networkError),
      };
  }
}

/**
 * Backward compatible wrapper to save post-only payloads
 */
export async function savePost(
  postData: PostData,
  config: ExtensionConfig
): Promise<SaveResult> {
  return saveContent({ ...postData, type: 'post' }, config);
}
