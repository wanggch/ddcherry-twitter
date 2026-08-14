/**
 * Post Extractor module for X Post Saver
 * Extracts post data from X/Twitter page DOM
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 */

import { PostData, ExtractionResult, ErrorCode } from '../common/types';
import { extractPostId } from '../common/urlParser';
import { createError, formatMissingFieldsMessage } from '../common/errors';
import {
  type ExtractionContext,
  resolveDocument,
  resolveUrl,
  findTweetContainer,
  extractAuthorFromContainer,
  extractTimestampFromContainer,
  serializeTweetText,
  isAvatarOrDecorativeImage,
} from './pageDom';

/**
 * Extracts text content from the post
 * Requirements: 1.3
 */
function extractTextContent(postContainer: Element): string {
  const textElement = postContainer.querySelector('[data-testid="tweetText"]');
  if (textElement) {
    return serializeTweetText(textElement);
  }

  const autoDirs = Array.from(postContainer.querySelectorAll('div[dir="auto"]'));
  for (const el of autoDirs) {
    if (el.closest('.x-article-body')) {
      continue;
    }
    if (el.querySelector('h1, .x-article-body')) {
      continue;
    }
    const text = serializeTweetText(el);
    if (text) {
      return text;
    }
  }

  return '';
}

/**
 * Extracts image URLs from the post
 * Requirements: 1.4
 */
function extractImages(postContainer: Element): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  const photoImgs = postContainer.querySelectorAll('[data-testid="tweetPhoto"] img');
  photoImgs.forEach((img) => {
    const src = (img as HTMLImageElement).src;
    if (src && !seen.has(src)) {
      seen.add(src);
      images.push(src);
    }
  });

  if (images.length > 0) {
    return images;
  }

  postContainer.querySelectorAll('img').forEach((img) => {
    const image = img as HTMLImageElement;
    const src = image.src;
    if (!src || seen.has(src) || isAvatarOrDecorativeImage(image)) {
      return;
    }
    if ((image.getAttribute('alt') || '') === 'Article cover image') {
      return;
    }
    seen.add(src);
    images.push(src);
  });

  return images;
}

/**
 * Extracts post data using meta tags as fallback
 * Requirements: 1.7
 */
function extractFromMetaTags(doc: Document): Partial<PostData> {
  const result: Partial<PostData> = {};

  const ogTitle = doc.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    const titleContent = ogTitle.getAttribute('content') || '';
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

  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const imageUrl = ogImage.getAttribute('content');
    if (imageUrl) {
      result.images = [imageUrl];
    }
  }

  const ogUrl = doc.querySelector('meta[property="og:url"]');
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
export function extractPostData(ctx?: ExtractionContext): PostData | null {
  const result = extractPostDataWithDetails(ctx);
  return result.success ? result.data! : null;
}

/**
 * Extracts post data with detailed error information
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 *
 * @returns ExtractionResult with data or error details
 */
export function extractPostDataWithDetails(ctx?: ExtractionContext): ExtractionResult {
  const missingFields: string[] = [];
  const doc = resolveDocument(ctx);
  const currentUrl = resolveUrl(ctx);

  try {
    const postId = extractPostId(currentUrl);

    if (!postId) {
      return {
        success: false,
        error: createError(ErrorCode.INVALID_URL, 'Could not extract post ID from URL'),
      };
    }

    const postContainer = findTweetContainer(doc, postId);

    if (postContainer) {
      const author = extractAuthorFromContainer(postContainer, doc);
      const content = extractTextContent(postContainer);
      const images = extractImages(postContainer);
      const createdAt = extractTimestampFromContainer(postContainer, doc) || new Date().toISOString();

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

    const metaData = extractFromMetaTags(doc);

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
