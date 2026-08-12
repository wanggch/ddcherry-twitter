/**
 * URL Parser utilities for X Post Saver
 * Requirements: 1.1, 2.2, 2.3, 7.3
 */

/**
 * Regular expression pattern for X/Twitter post detail page URLs
 * Matches: https://x.com/{handle}/status/{postId} or https://twitter.com/{handle}/status/{postId}
 * Handle: alphanumeric and underscore, 1-15 characters
 * PostId: numeric string
 */
const POST_URL_PATTERN = /^https:\/\/(x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})\/status\/(\d+)/;
const ARTICLE_URL_PATTERN = /^https:\/\/(x\.com|twitter\.com)\/i\/article\/(\d+)/;

/**
 * Checks if the given URL is an X/Twitter post detail page
 * Requirements: 2.2, 2.3, 7.3
 * 
 * @param url - The URL to check
 * @returns true if the URL matches the post detail page pattern
 */
export function isPostDetailPage(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return POST_URL_PATTERN.test(url);
}

/**
 * Extracts the post ID from an X/Twitter post URL
 * Requirements: 1.1
 * 
 * @param url - The URL to extract the post ID from
 * @returns The post ID string, or null if the URL is not a valid post URL
 */
export function extractPostId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  const match = url.match(POST_URL_PATTERN);
  if (!match) {
    return null;
  }
  
  return match[3]; // The third capture group is the post ID
}

/**
 * Extracts the handle from an X/Twitter post URL
 * 
 * @param url - The URL to extract the handle from
 * @returns The handle string (without @), or null if the URL is not a valid post URL
 */
export function extractHandle(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  const match = url.match(POST_URL_PATTERN);
  if (!match) {
    return null;
  }
  
  return match[2]; // The second capture group is the handle
}

/**
 * Checks if the given URL is an X/Twitter article page
 * @param url - The URL to check
 * @returns true if the URL matches the article URL pattern
 */
export function isArticlePage(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return ARTICLE_URL_PATTERN.test(url);
}

/**
 * Extracts the article ID from an article URL
 * @param url - The URL to extract the article ID from
 * @returns The article ID string, or null if not a valid article URL
 */
export function extractArticleId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  const match = url.match(ARTICLE_URL_PATTERN);
  if (!match) {
    return null;
  }
  
  return match[2];
}

/**
 * Determines the content type of the provided URL
 * @param url - The current page URL
 * @returns 'post' | 'article' | null
 */
export function detectContentType(url: string): 'post' | 'article' | null {
  if (isPostDetailPage(url)) {
    return 'post';
  }
  if (isArticlePage(url)) {
    return 'article';
  }
  return null;
}
