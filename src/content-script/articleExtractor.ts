/**
 * Article Extractor module for X Post Saver
 * Extracts long-form article data from X/Twitter article pages
 * and from articles embedded in status pages (including the 2026 X redesign).
 */

import {
  ArticleData,
  ExtractionResult,
  ErrorCode,
} from '../common/types';
import { extractArticleId, extractPostId, isArticlePage } from '../common/urlParser';
import { createError, formatMissingFieldsMessage } from '../common/errors';
import {
  type ExtractionContext,
  resolveDocument,
  resolveUrl,
  findArticleRoot,
  findArticleIdInDom,
  hasArticleDom,
  extractAuthorFromContainer,
  extractTimestampFromContainer,
  serializeInline,
  isAvatarOrDecorativeImage,
} from './pageDom';

const ARTICLE_SELECTORS = {
  title: '[data-testid="article-title"], [data-testid="twitter-article-title"], h1',
  coverImage: '[data-testid="article-cover"] img, img[alt="Article cover image"]',
};

function extractTitle(root: ParentNode, doc: Document): string {
  const titleElement = root.querySelector(ARTICLE_SELECTORS.title);
  if (titleElement?.textContent) {
    return titleElement.textContent.trim();
  }

  const ogDescription = doc.querySelector('meta[property="og:description"]');
  const description = ogDescription?.getAttribute('content')?.trim() ?? '';
  if (description && !/^https?:\/\//.test(description)) {
    return description;
  }

  return '';
}

function extractContent(container: Element): string {
  const articleBody = container.matches('.x-article-body')
    ? container
    : container.querySelector('.x-article-body');

  const richText =
    container.matches('[data-testid="longformRichTextComponent"]')
      ? container
      : container.querySelector('[data-testid="longformRichTextComponent"]');

  const root = articleBody ?? richText ?? container;

  const blockNodes = Array.from(root.querySelectorAll('[data-block="true"]'));
  if (blockNodes.length > 0) {
    const parts: string[] = [];
    let inBlockquote = false;

    const getListPrefix = (block: Element): string => {
      const li = block.closest('li');
      if (!li) return '';
      const depthMatch = li.className.match(/depth(\d+)/);
      const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;

      const isOrdered =
        li.classList.contains('public-DraftStyleDefault-orderedListItem') ||
        li.closest('ol') !== null;

      const prefix = isOrdered ? '1.' : '-';
      return `${'  '.repeat(depth)}${prefix} `;
    };

    const extractImagesFromBlock = (block: Element): string[] => {
      const urls: string[] = [];
      const img = block.querySelector('[data-testid="tweetPhoto"] img') as HTMLImageElement | null;
      if (img?.src) {
        urls.push(img.src);
      } else {
        const bgDiv = block.querySelector('[data-testid="tweetPhoto"] div[style*="background-image"]') as HTMLElement | null;
        const style = bgDiv?.getAttribute('style') || '';
        const match = style.match(/url\(["']?(.*?)["']?\)/);
        if (match && match[1]) {
          urls.push(match[1]);
        }
      }
      return urls;
    };

    for (const block of blockNodes) {
      const text = serializeInline(block).trim();
      const imageUrls = extractImagesFromBlock(block);

      if (imageUrls.length > 0) {
        for (const url of imageUrls) {
          parts.push(`![image](${url})`);
        }
        parts.push('');
      }

      if (!text) {
        continue;
      }

      const isBlockquote = !!block.closest('blockquote.longform-blockquote');

      if (isBlockquote && !inBlockquote) {
        if (parts.length && parts[parts.length - 1] !== '') {
          parts.push('');
        }
        parts.push('```');
        inBlockquote = true;
      }

      if (!isBlockquote && inBlockquote) {
        parts.push('```');
        inBlockquote = false;
        if (parts.length && parts[parts.length - 1] !== '') {
          parts.push('');
        }
      }

      const listPrefix = getListPrefix(block);
      parts.push(`${listPrefix}${text}`);

      if (!isBlockquote) {
        parts.push('');
      }
    }

    if (inBlockquote) {
      parts.push('```');
    }

    while (parts.length > 0 && parts[parts.length - 1] === '') {
      parts.pop();
    }

    if (parts.length > 0) {
      return parts.join('\n');
    }
  }

  const paragraphs = Array.from(root.querySelectorAll('p'));
  if (paragraphs.length > 0) {
    const lines = paragraphs
      .map((p) => serializeInline(p).trim())
      .filter((text) => text.length > 0);

    if (lines.length > 0) {
      return lines.join('\n\n');
    }
  }

  return (root.textContent?.trim() ?? '');
}

function normalizeImageUrl(url: string): string {
  return url.replace(/&amp;/g, '&').trim();
}

function extractBackgroundImageUrl(element: Element | null): string | undefined {
  if (!element) {
    return undefined;
  }

  const style =
    (element as HTMLElement).style.backgroundImage ||
    element.getAttribute('style') ||
    '';
  const match = style.match(/url\(["']?(.*?)["']?\)/i);
  if (match && match[1]) {
    return normalizeImageUrl(match[1]);
  }
  return undefined;
}

function extractCoverImage(container: Element, doc: Document): string | undefined {
  const imgSelectors = [
    ARTICLE_SELECTORS.coverImage,
    'a[href*="/article/"][href*="/media/"] [data-testid="tweetPhoto"] img',
    'a[href*="/article/"][href*="/media/"] img',
  ];

  for (const selector of imgSelectors) {
    const img = container.querySelector(selector) as HTMLImageElement | null;
    if (img?.src) {
      return normalizeImageUrl(img.src);
    }
  }

  const bgSelectors = [
    '[data-testid="article-cover"] [style*="background-image"]',
    'a[href*="/article/"][href*="/media/"] [style*="background-image"]',
    '[data-testid="tweetPhoto"][style*="background-image"]',
  ];

  for (const selector of bgSelectors) {
    const el = container.querySelector(selector);
    const url = extractBackgroundImageUrl(el);
    if (url) {
      return url;
    }
  }

  const itemImage = container.querySelector('meta[itemprop="image"]');
  const itemContent = itemImage?.getAttribute('content');
  if (itemContent) {
    return normalizeImageUrl(itemContent.replace(/:large$/, ''));
  }

  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const content = ogImage.getAttribute('content');
    if (content) {
      return normalizeImageUrl(content);
    }
  }

  return undefined;
}

function extractArticleImages(container: Element, coverImage?: string): string[] {
  const urls = new Set<string>();
  const imgElements = container.querySelectorAll('img');

  imgElements.forEach((img) => {
    const src = (img as HTMLImageElement).src;
    if (!src) {
      return;
    }

    if (isAvatarOrDecorativeImage(img as HTMLImageElement)) {
      return;
    }

    const normalized = normalizeImageUrl(src);
    if (coverImage && (normalized === coverImage || src === coverImage)) {
      return;
    }

    urls.add(normalized);
  });

  return Array.from(urls);
}

function extractFromMeta(articleId: string, url: string, doc: Document): ArticleData {
  const metaTitle = doc.querySelector('meta[property="og:title"]');
  const metaDesc = doc.querySelector('meta[name="description"]') ?? doc.querySelector('meta[property="og:description"]');
  const metaImage = doc.querySelector('meta[property="og:image"]');
  const metaPublished = doc.querySelector('meta[property="article:published_time"]');
  const metaAuthor = doc.querySelector('meta[name="author"]');

  const authorName = metaAuthor?.getAttribute('content') || '';

  return {
    type: 'article',
    articleId,
    url,
    title: metaDesc?.getAttribute('content') || metaTitle?.getAttribute('content') || '',
    content: '',
    coverImage: metaImage?.getAttribute('content') || undefined,
    images: [],
    author: {
      displayName: authorName,
      handle: '',
      avatarUrl: '',
      profileUrl: '',
    },
    createdAt: metaPublished?.getAttribute('content') || '',
  };
}

/**
 * Extracts article data with detailed error information
 */
export function extractArticleDataWithDetails(
  ctx?: ExtractionContext
): ExtractionResult<ArticleData> {
  const missingFields: string[] = [];
  const doc = resolveDocument(ctx);
  const currentUrl = resolveUrl(ctx);

  try {
    const container = findArticleRoot(doc, currentUrl);
    const articleDomPresent = Boolean(container) || hasArticleDom(doc);
    const urlArticleId = extractArticleId(currentUrl);
    const domArticleId =
      (container ? findArticleIdInDom(container) : null) ?? findArticleIdInDom(doc);
    const postId = extractPostId(currentUrl);
    const articleId = urlArticleId ?? domArticleId ?? (articleDomPresent ? postId : null);

    const canonicalUrl = currentUrl;

    if (!articleDomPresent && !isArticlePage(currentUrl)) {
      return {
        success: false,
        error: createError(ErrorCode.INVALID_URL, 'Could not extract article ID from page'),
        contentType: 'article',
      };
    }

    if (!articleId) {
      return {
        success: false,
        error: createError(ErrorCode.INVALID_URL, 'Could not extract article ID from page'),
        contentType: 'article',
      };
    }

    if (container) {
      const title = extractTitle(container, doc);
      const content = extractContent(container);
      const coverImage = extractCoverImage(container, doc);
      const images = extractArticleImages(container, coverImage);
      const author = extractAuthorFromContainer(container, doc);
      const createdAt = extractTimestampFromContainer(container, doc);

      if (!title) {
        missingFields.push('article title');
      }
      if (!content) {
        missingFields.push('article content');
      }
      if (!author) {
        missingFields.push('article author');
      }

      if (author && content) {
        const articleData: ArticleData = {
          type: 'article',
          articleId,
          url: canonicalUrl,
          title,
          content,
          coverImage: coverImage ?? (images.length > 0 ? images[0] : undefined),
          images,
          author,
          createdAt,
        };

        return {
          success: true,
          data: articleData,
          missingFields: missingFields.length > 0 ? missingFields : undefined,
          contentType: 'article',
        };
      }

      if (author && !content) {
        missingFields.push('article content');
      }
    } else {
      missingFields.push('article container');
    }

    const metaData = extractFromMeta(articleId, canonicalUrl, doc);
    if (metaData.title || metaData.content) {
      if (!metaData.author.displayName) {
        missingFields.push('article author');
      }
      if (!metaData.title) {
        missingFields.push('article title');
      }
      if (!metaData.content) {
        missingFields.push('article content');
      }

      return {
        success: true,
        data: metaData,
        missingFields: missingFields.length > 0 ? missingFields : undefined,
        contentType: 'article',
      };
    }

    return {
      success: false,
      error: createError(
        missingFields.includes('article title')
          ? ErrorCode.ARTICLE_TITLE_MISSING
          : missingFields.includes('article content')
            ? ErrorCode.ARTICLE_CONTENT_MISSING
            : missingFields.includes('article author')
              ? ErrorCode.ARTICLE_AUTHOR_MISSING
              : ErrorCode.ARTICLE_NOT_FOUND,
        formatMissingFieldsMessage(missingFields)
      ),
      missingFields,
      contentType: 'article',
    };
  } catch (error) {
    return {
      success: false,
      error: createError(
        ErrorCode.DOM_PARSING_FAILED,
        error instanceof Error ? error.message : 'Unknown parsing error'
      ),
      contentType: 'article',
    };
  }
}

/**
 * Extracts article data or null on failure
 */
export function extractArticleData(ctx?: ExtractionContext): ArticleData | null {
  const result = extractArticleDataWithDetails(ctx);
  return result.success ? result.data ?? null : null;
}
