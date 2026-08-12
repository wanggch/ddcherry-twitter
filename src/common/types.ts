/**
 * Type definitions for X Post Saver Chrome Extension
 * Requirements: 6.1, 6.2
 */

/**
 * Author information extracted from X post
 * Requirements: 6.2
 */
export interface AuthorData {
  displayName: string;
  handle: string; // Includes @ prefix
  avatarUrl: string;
  profileUrl: string;
}

export type ContentType = 'post' | 'article';

/**
 * Post data extracted from X page
 * Requirements: 6.1
 */
export interface PostData {
  type?: 'post';
  postId: string;
  url: string;
  content: string;
  images: string[];
  author: AuthorData;
  createdAt: string; // ISO 8601 format
}

export interface ArticleData {
  type: 'article';
  articleId: string;
  url: string;
  title: string;
  content: string;
  coverImage?: string;
  images: string[];
  author: AuthorData;
  createdAt: string;
}

export type ContentData = PostData | ArticleData;

/**
 * Result of a save operation
 */
export interface SaveResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Extension configuration stored in chrome.storage.sync
 */
export interface ExtensionConfig {
  apiUrl: string;
  apiKey: string;
  enableObsidian: boolean;
  obsidianBaseUrl: string;
}

/**
 * Error codes for categorizing different types of errors
 * Requirements: 1.8, 2.7, 4.5, 4.6
 */
export enum ErrorCode {
  // DOM/Extraction errors
  DOM_PARSING_FAILED = 'DOM_PARSING_FAILED',
  POST_NOT_FOUND = 'POST_NOT_FOUND',
  AUTHOR_NOT_FOUND = 'AUTHOR_NOT_FOUND',
  INVALID_URL = 'INVALID_URL',
  ARTICLE_NOT_FOUND = 'ARTICLE_NOT_FOUND',
  ARTICLE_TITLE_MISSING = 'ARTICLE_TITLE_MISSING',
  ARTICLE_CONTENT_MISSING = 'ARTICLE_CONTENT_MISSING',
  ARTICLE_AUTHOR_MISSING = 'ARTICLE_AUTHOR_MISSING',
  
  // Configuration errors
  CONFIG_MISSING = 'CONFIG_MISSING',
  CONFIG_INVALID_URL = 'CONFIG_INVALID_URL',
  
  // API errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_CLIENT_ERROR = 'API_CLIENT_ERROR',
  API_SERVER_ERROR = 'API_SERVER_ERROR',
  API_INVALID_RESPONSE = 'API_INVALID_RESPONSE',
  API_TIMEOUT = 'API_TIMEOUT',
  
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Structured error with code and user-friendly message
 * Requirements: 1.8, 2.7, 4.5, 4.6
 */
export interface ExtensionError {
  code: ErrorCode;
  message: string;
  details?: string;
}

/**
 * Result of post data extraction
 * Requirements: 1.8
 */
export interface ExtractionResult<TData = PostData> {
  success: boolean;
  data?: TData;
  error?: ExtensionError;
  missingFields?: string[];
  contentType?: ContentType | null;
}

/**
 * Message types for inter-component communication
 */
export type Message =
  | { type: 'GET_POST_DATA' }
  | { type: 'GET_POST_DATA_WITH_DETAILS' }
  | { type: 'CHECK_POST_PAGE' }
  | { type: 'GET_ARTICLE_DATA' }
  | { type: 'GET_ARTICLE_DATA_WITH_DETAILS' }
  | { type: 'CHECK_ARTICLE_PAGE' }
  | { type: 'CHECK_PAGE_TYPE' }
  | { type: 'GET_PAGE_DATA_WITH_DETAILS' }
  | { type: 'SAVE_CONTENT'; payload: ContentData }
  | { type: 'SAVE_POST'; payload: PostData }
  | { type: 'GET_CONFIG' }
  | { type: 'COPY_TO_CLIPBOARD'; payload: string };

/**
 * Extraction result payload for detailed extraction response
 */
export interface ExtractionResultPayload<TData = ContentData> {
  success: boolean;
  data?: TData;
  error?: string;
  missingFields?: string[];
  contentType?: ContentType | null;
}

/**
 * Clipboard operation result
 * Requirements: 8.7, 8.8
 */
export interface ClipboardResult {
  success: boolean;
  error?: string;
}

/**
 * Response types for inter-component communication
 */
export type MessageResponse =
  | { type: 'POST_DATA'; payload: PostData | null }
  | { type: 'ARTICLE_DATA'; payload: ArticleData | null }
  | { type: 'EXTRACTION_RESULT'; payload: ExtractionResultPayload }
  | { type: 'IS_POST_PAGE'; payload: boolean }
  | { type: 'IS_ARTICLE_PAGE'; payload: boolean }
  | { type: 'PAGE_TYPE'; payload: ContentType | null }
  | { type: 'SAVE_RESULT'; payload: SaveResult }
  | { type: 'CONFIG'; payload: ExtensionConfig }
  | { type: 'CLIPBOARD_RESULT'; payload: ClipboardResult }
  | { type: 'ERROR'; payload: string };
