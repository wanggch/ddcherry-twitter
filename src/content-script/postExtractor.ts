/**
 * Post Extractor module for X Post Saver
 * Extracts post data from X/Twitter page DOM
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 */

import { PostData, AuthorData, ExtractionResult, ErrorCode } from '../common/types';
import { extractPostId } from '../common/urlParser';
import { createError, formatMissingFieldsMessage } from '../common/errors';

/**
 * DOM Selectors for X/Twitter post elements
 */
const SELECTORS = {
  postContainer: 'article[data-testid="tweet"]',
  tweetText: '[data-testid="tweetText"]',
  tweetPhoto: '[data-testid="tweetPhoto"] img',
  userAvatar: '[data-testid="Tweet-User-Avatar"] img',
  userName: '[data-testid="User-Name"]',
  userLink: 'a[role="link"][href^="/"]',
  timestamp: 'time[datetime]',
};

/**
 * Extracts author information from the post container
 * Requirements: 1.5
 */
function extractAuthorData(postContainer: Element): AuthorData | null {
  try {
    // Find user avatar
    const avatarImg = postContainer.querySelector(SELECTORS.userAvatar) as HTMLImageElement | null;
    const avatarUrl = avatarImg?.src || '';

    let handle = '';
    let displayName = '';
    let profileUrl = '';

    // Use the User-Name container which has a specific structure:
    // - First <a> link contains the display name (e.g., "宝玉")
    // - Second <a> link (with tabindex="-1") contains the handle (e.g., "@dotey")
    const userNameContainer = postContainer.querySelector(SELECTORS.userName);
    
    if (userNameContainer) {
      const links = userNameContainer.querySelectorAll('a[role="link"]');
      
      // First link contains display name
      if (links.length > 0) {
        const firstLink = links[0] as HTMLAnchorElement;
        const href = firstLink.href;
        const match = href.match(/^https:\/\/(x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})$/);
        if (match) {
          profileUrl = href;
          // Extract display name from innermost span
          const spans = firstLink.querySelectorAll('span');
          for (const span of spans) {
            if (span.children.length === 0) {
              const text = span.textContent?.trim() || '';
              if (text && !text.startsWith('@')) {
                displayName = text;
                break;
              }
            }
          }
        }
      }
      
      // Second link (or any link with tabindex="-1") contains handle
      const handleLink = userNameContainer.querySelector('a[tabindex="-1"]') as HTMLAnchorElement | null;
      if (handleLink) {
        const handleSpan = handleLink.querySelector('span');
        if (handleSpan) {
          const text = handleSpan.textContent?.trim() || '';
          if (text.startsWith('@')) {
            handle = text;
          }
        }
      }
      
      // Fallback: extract handle from URL if not found in span
      if (!handle && profileUrl) {
        const match = profileUrl.match(/^https:\/\/(x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})$/);
        if (match) {
          handle = `@${match[2]}`;
        }
      }
    }

    // Fallback to old method if User-Name container not found
    if (!handle) {
      const userLinks = postContainer.querySelectorAll(SELECTORS.userLink);
      for (const link of userLinks) {
        const href = (link as HTMLAnchorElement).href;
        const match = href.match(/^https:\/\/(x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})$/);
        if (match) {
          handle = `@${match[2]}`;
          profileUrl = href;
          break;
        }
      }
    }

    if (!handle) {
      return null;
    }

    return {
      displayName: displayName || handle.substring(1),
      handle,
      avatarUrl,
      profileUrl,
    };
  } catch {
    return null;
  }
}


/**
 * Extracts text content from the post
 * Requirements: 1.3
 */
function extractTextContent(postContainer: Element): string {
  const textElement = postContainer.querySelector(SELECTORS.tweetText);
  if (textElement) {
    return textElement.textContent || '';
  }
  return '';
}

/**
 * Extracts image URLs from the post
 * Requirements: 1.4
 */
function extractImages(postContainer: Element): string[] {
  const images: string[] = [];
  const imgElements = postContainer.querySelectorAll(SELECTORS.tweetPhoto);
  
  imgElements.forEach((img) => {
    const src = (img as HTMLImageElement).src;
    if (src) {
      images.push(src);
    }
  });
  
  return images;
}

/**
 * Extracts timestamp from the post
 * Requirements: 1.6
 */
function extractTimestamp(postContainer: Element): string {
  const timeElement = postContainer.querySelector(SELECTORS.timestamp);
  if (timeElement) {
    const datetime = timeElement.getAttribute('datetime');
    if (datetime) {
      return datetime;
    }
  }
  return new Date().toISOString();
}

/**
 * Extracts post data using meta tags as fallback
 * Requirements: 1.7
 */
function extractFromMetaTags(): Partial<PostData> {
  const result: Partial<PostData> = {};
  
  // og:title often contains author and content preview
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    const titleContent = ogTitle.getAttribute('content') || '';
    // Title format is often: "Author on X: "content""
    const match = titleContent.match(/^(.+?) on X: "(.+)"$/);
    if (match) {
      result.author = {
        displayName: match[1],
        handle: '',
        avatarUrl: '',
        profileUrl: '',
      };
      result.content = match[2];
    }
  }
  
  // og:image for post image
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const imageUrl = ogImage.getAttribute('content');
    if (imageUrl) {
      result.images = [imageUrl];
    }
  }
  
  // og:url for post URL
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) {
    const url = ogUrl.getAttribute('content');
    if (url) {
      result.url = url;
      const postId = extractPostId(url);
      if (postId) {
        result.postId = postId;
      }
    }
  }
  
  return result;
}

/**
 * Main function to extract post data from the current page
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 * 
 * @returns PostData object or null if extraction fails
 */
export function extractPostData(): PostData | null {
  const result = extractPostDataWithDetails();
  return result.success ? result.data! : null;
}

/**
 * Extracts post data with detailed error information
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 * 
 * @returns ExtractionResult with data or error details
 */
export function extractPostDataWithDetails(): ExtractionResult {
  const missingFields: string[] = [];
  
  try {
    const currentUrl = window.location.href;
    const postId = extractPostId(currentUrl);
    
    if (!postId) {
      return {
        success: false,
        error: createError(ErrorCode.INVALID_URL, 'Could not extract post ID from URL'),
      };
    }
    
    // Try to find the post container
    const postContainer = document.querySelector(SELECTORS.postContainer);
    
    if (postContainer) {
      // Extract data from DOM
      const author = extractAuthorData(postContainer);
      const content = extractTextContent(postContainer);
      const images = extractImages(postContainer);
      const createdAt = extractTimestamp(postContainer);
      
      // Track missing fields
      if (!author) {
        missingFields.push('author information');
      }
      if (!content) {
        missingFields.push('post content');
      }
      
      if (author) {
        const postData: PostData = {
          type: 'post',
          postId,
          url: currentUrl,
          content,
          images,
          author,
          createdAt,
        };
        
        return {
          success: true,
          data: postData,
          missingFields: missingFields.length > 0 ? missingFields : undefined,
          contentType: 'post',
        };
      }
    } else {
      missingFields.push('post container');
    }
    
    // Fallback to meta tags (Requirement 1.7)
    const metaData = extractFromMetaTags();
    
    if (metaData.postId || postId) {
      const postData: PostData = {
        type: 'post',
        postId: metaData.postId || postId,
        url: metaData.url || currentUrl,
        content: metaData.content || '',
        images: metaData.images || [],
        author: metaData.author || {
          displayName: '',
          handle: '',
          avatarUrl: '',
          profileUrl: '',
        },
        createdAt: new Date().toISOString(),
      };
      
      // Track what's missing from meta fallback
      if (!metaData.author?.displayName) {
        missingFields.push('author name');
      }
      if (!metaData.content) {
        missingFields.push('post content');
      }
      
      return {
        success: true,
        data: postData,
        missingFields: missingFields.length > 0 ? missingFields : undefined,
        contentType: 'post',
      };
    }
    
    // Complete failure
    return {
      success: false,
      error: createError(
        ErrorCode.POST_NOT_FOUND,
        formatMissingFieldsMessage(missingFields)
      ),
      missingFields,
    };
  } catch (error) {
    return {
      success: false,
      error: createError(
        ErrorCode.DOM_PARSING_FAILED,
        error instanceof Error ? error.message : 'Unknown parsing error'
      ),
    };
  }
}
