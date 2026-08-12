/**
 * Error handling utilities for X Post Saver
 * Requirements: 1.8, 2.7, 4.5, 4.6
 */

import { ErrorCode, ExtensionError } from './types';

/**
 * User-friendly error messages for each error code
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // DOM/Extraction errors
  [ErrorCode.DOM_PARSING_FAILED]: 'Failed to parse page content. The page structure may have changed.',
  [ErrorCode.POST_NOT_FOUND]: 'Could not find post content on this page.',
  [ErrorCode.AUTHOR_NOT_FOUND]: 'Could not extract author information from the post.',
  [ErrorCode.INVALID_URL]: 'This page is not a valid X post URL.',
  [ErrorCode.ARTICLE_NOT_FOUND]: 'Could not find the article content on this page.',
  [ErrorCode.ARTICLE_TITLE_MISSING]: 'Could not extract the article title.',
  [ErrorCode.ARTICLE_CONTENT_MISSING]: 'Could not extract the article body content.',
  [ErrorCode.ARTICLE_AUTHOR_MISSING]: 'Could not extract the article author information.',
  
  // Configuration errors
  [ErrorCode.CONFIG_MISSING]: 'Please configure API URL in extension options.',
  [ErrorCode.CONFIG_INVALID_URL]: 'The configured API URL is invalid.',
  
  // API errors
  [ErrorCode.NETWORK_ERROR]: 'Unable to connect to the server. Please check your internet connection.',
  [ErrorCode.API_CLIENT_ERROR]: 'The request was rejected by the server.',
  [ErrorCode.API_SERVER_ERROR]: 'The server encountered an error. Please try again later.',
  [ErrorCode.API_INVALID_RESPONSE]: 'Received an invalid response from the server.',
  [ErrorCode.API_TIMEOUT]: 'The request timed out. Please try again.',
  
  // General errors
  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
};

/**
 * Creates a structured error object
 * Requirements: 1.8, 2.7, 4.5, 4.6
 * 
 * @param code - The error code
 * @param details - Optional additional details about the error
 * @returns A structured ExtensionError object
 */
export function createError(code: ErrorCode, details?: string): ExtensionError {
  return {
    code,
    message: ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR],
    details,
  };
}

/**
 * Formats an error for display to the user
 * Requirements: 2.7
 * 
 * @param error - The error to format
 * @returns A user-friendly error message string
 */
export function formatErrorMessage(error: ExtensionError): string {
  if (error.details) {
    return `${error.message} (${error.details})`;
  }
  return error.message;
}

/**
 * Creates an error from an HTTP response status
 * Requirements: 4.5, 4.6
 * 
 * @param status - The HTTP status code
 * @param statusText - The HTTP status text
 * @param responseMessage - Optional message from the response body
 * @returns A structured ExtensionError object
 */
export function createApiError(
  status: number,
  statusText: string,
  responseMessage?: string
): ExtensionError {
  const details = responseMessage || `${status} ${statusText}`;
  
  if (status >= 400 && status < 500) {
    return createError(ErrorCode.API_CLIENT_ERROR, details);
  }
  
  if (status >= 500) {
    return createError(ErrorCode.API_SERVER_ERROR, details);
  }
  
  return createError(ErrorCode.UNKNOWN_ERROR, details);
}

/**
 * Creates an error from a network/fetch error
 * Requirements: 4.6
 * 
 * @param error - The original error
 * @returns A structured ExtensionError object
 */
export function createNetworkError(error: unknown): ExtensionError {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return createError(ErrorCode.NETWORK_ERROR, 'Network request failed');
  }
  
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return createError(ErrorCode.API_TIMEOUT);
    }
    return createError(ErrorCode.NETWORK_ERROR, error.message);
  }
  
  return createError(ErrorCode.NETWORK_ERROR);
}

/**
 * Formats missing fields into a user-friendly message
 * Requirements: 1.8
 * 
 * @param missingFields - Array of field names that could not be extracted
 * @returns A formatted message describing the missing fields
 */
export function formatMissingFieldsMessage(missingFields: string[]): string {
  if (missingFields.length === 0) {
    return '';
  }
  
  if (missingFields.length === 1) {
    return `Could not extract: ${missingFields[0]}`;
  }
  
  const lastField = missingFields[missingFields.length - 1];
  const otherFields = missingFields.slice(0, -1).join(', ');
  return `Could not extract: ${otherFields} and ${lastField}`;
}
