/**
 * Article Extractor module for X Post Saver
 * Extracts long-form article data from X/Twitter article pages
 */

import {
  ArticleData,
  AuthorData,
  ExtractionResult,
  ErrorCode,
} from '../common/types';
import { extractArticleId, isArticlePage } from '../common/urlParser';
import { createError, formatMissingFieldsMessage } from '../common/errors';

const ARTICLE_SELECTORS = {
  containers: [
    '[data-testid="longformRichTextComponent"]',
    '[data-testid="twitterArticleRichTextView"]',
    '[data-testid="twitterArticleReadView"]',
    '[data-testid="article-content"]',
    'article',
  ],
  title: '[data-testid="article-title"], [data-testid="twitter-article-title"], h1',
  coverImage: '[data-testid="article-cover"] img',
  timestamp: 'time[datetime]',
};

function findArticleContainer(): Element | null {
  for (const selector of ARTICLE_SELECTORS.containers) {
    const el = document.querySelector(selector);
    if (el) {
      return el as Element;
    }
  }
  return null;
}

function findArticleIdFromDom(): string | null {
  const links = Array.from(document.querySelectorAll('a[href*="/article/"]')) as HTMLAnchorElement[];
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    const match = href.match(/\/article\/(\d+)/);
    if (match) {
      return match[1];
    }
  }

  const ogUrl = document.querySelector('meta[property="og:url"]');
  const ogHref = ogUrl?.getAttribute('content') || '';
  const ogMatch = ogHref.match(/\/article\/(\d+)/);
  if (ogMatch) {
    return ogMatch[1];
  }

  return null;
}

function extractTitle(root: ParentNode): string {
  const titleElement = root.querySelector(ARTICLE_SELECTORS.title);
  if (titleElement?.textContent) {
    return titleElement.textContent.trim();
  }

  const docTitle = document.querySelector('title');
  if (docTitle?.textContent) {
    return docTitle.textContent.trim();
  }

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    return ogTitle.getAttribute('content')?.trim() ?? '';
  }

  return '';
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const children = Array.from(el.childNodes)
      .map(serializeNode)
      .join('');

    switch (el.tagName) {
      case 'A': {
        const href = (el as HTMLAnchorElement).href;
        const text = children || href;
        return href ? `[${text}](${href})` : text;
      }
      case 'STRONG':
      case 'B':
        return children ? `**${children}**` : children;
      case 'EM':
      case 'I':
        return children ? `*${children}*` : children;
      case 'BR':
        return '\n';
      default:
        return children;
    }
  }

  return '';
}

function extractContent(container: Element): string {
  const richText =
    container.matches('[data-testid="longformRichTextComponent"]')
      ? container
      : container.querySelector('[data-testid="longformRichTextComponent"]');

  const root = richText ?? container;

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
        const match = style.match(/url\\(["']?(.*?)["']?\\)/);
        if (match && match[1]) {
          urls.push(match[1]);
        }
      }
      return urls;
    };

    for (const block of blockNodes) {
      const text = serializeNode(block).trim();
      const imageUrls = extractImagesFromBlock(block);

      // Emit images before text if present in this block
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
        // Start code block
        if (parts.length && parts[parts.length - 1] !== '') {
          parts.push('');
        }
        parts.push('```');
        inBlockquote = true;
      }

      if (!isBlockquote && inBlockquote) {
        // Close code block before returning to normal paragraphs
        parts.push('```');
        inBlockquote = false;
        if (parts.length && parts[parts.length - 1] !== '') {
          parts.push('');
        }
      }

      const listPrefix = getListPrefix(block);
      parts.push(`${listPrefix}${text}`);

      if (!isBlockquote) {
        // Add paragraph spacing between non-quote blocks
        parts.push('');
      }
    }

    if (inBlockquote) {
      parts.push('```');
    }

    // Trim trailing empty lines
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
      .map((p) => serializeNode(p).trim())
      .filter((text) => text.length > 0);

    if (lines.length > 0) {
      return lines.join('\n\n');
    }
  }

  const text = root.textContent?.trim() ?? '';
  return text;
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
  const match = style.match(/url\\(["']?(.*?)["']?\\)/i);
  if (match && match[1]) {
    return normalizeImageUrl(match[1]);
  }
  return undefined;
}

function extractCoverImage(container?: Element): string | undefined {
  const root: ParentNode = container ?? document;
  const imgSelectors = [
    ARTICLE_SELECTORS.coverImage,
    'a[href*="/article/"][href*="/media/"] [data-testid="tweetPhoto"] img',
    'a[href*="/article/"][href*="/media/"] img',
  ];

  for (const selector of imgSelectors) {
    const img = root.querySelector(selector) as HTMLImageElement | null;
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
    const el = root.querySelector(selector);
    const url = extractBackgroundImageUrl(el);
    if (url) {
      return url;
    }
  }

  if (root !== document) {
    const docCover = extractCoverImage();
    if (docCover) {
      return docCover;
    }
  }

  const ogImage = document.querySelector('meta[property="og:image"]');
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

    // Skip obvious avatars or decorative images
    const isAvatar =
      src.includes('profile_images') ||
      src.includes('emoji') ||
      img.closest('[data-testid="Tweet-User-Avatar"]') !== null;

    if (isAvatar) {
      return;
    }

    if (coverImage && src === coverImage) {
      return;
    }

    urls.add(src);
  });

  return Array.from(urls);
}

function extractTimestamp(container?: Element): string {
  const timeElement = (container ?? document).querySelector(
    ARTICLE_SELECTORS.timestamp
  ) as HTMLTimeElement | null;

  if (timeElement?.dateTime) {
    return timeElement.dateTime;
  }

  const metaPublished = document.querySelector(
    'meta[property="article:published_time"]'
  );
  if (metaPublished) {
    const content = metaPublished.getAttribute('content');
    if (content) {
      return content;
    }
  }

  return new Date().toISOString();
}

function extractAuthor(container?: Element): AuthorData | null {
  const root: ParentNode = container ?? document;
  const avatarImg =
    (root.querySelector('[data-testid="Tweet-User-Avatar"] img') as HTMLImageElement | null) ??
    (document.querySelector('[data-testid="Tweet-User-Avatar"] img') as HTMLImageElement | null);
  const avatarUrl = avatarImg?.src || '';

  let handle = '';
  let displayName = '';
  let profileUrl = '';

  const userNameContainer =
    root.querySelector('[data-testid="User-Name"]') ??
    document.querySelector('[data-testid="User-Name"]');

  if (userNameContainer) {
    const links = userNameContainer.querySelectorAll('a[role="link"]');

    if (links.length > 0) {
      const firstLink = links[0] as HTMLAnchorElement;
      const href = firstLink.href;
      const match = href.match(/^https:\/\/(x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})$/);
      if (match) {
        profileUrl = href;
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

    const handleLink = userNameContainer.querySelector('a[tabindex="-1"]') as HTMLAnchorElement | null;
    if (handleLink) {
      const handleSpan = handleLink.querySelector('span');
      const text = handleSpan?.textContent?.trim() || '';
      if (text.startsWith('@')) {
        handle = text;
      }
    }

    if (!handle && profileUrl) {
      const match = profileUrl.match(/^https:\/\/(x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})$/);
      if (match) {
        handle = `@${match[2]}`;
      }
    }
  }

  if (!handle) {
    const metaAuthor = document.querySelector('meta[name="author"]');
    const authorName = metaAuthor?.getAttribute('content')?.trim();
    if (authorName) {
      displayName = authorName;
    }
  }

  if (!handle && profileUrl) {
    handle = `@${profileUrl.split('/').pop()}`;
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
}

function extractFromMeta(articleId: string, url: string): ArticleData {
  const metaTitle = document.querySelector('meta[property="og:title"]');
  const metaDesc = document.querySelector('meta[name="description"]') ?? document.querySelector('meta[property="og:description"]');
  const metaImage = document.querySelector('meta[property="og:image"]');
  const metaPublished = document.querySelector('meta[property="article:published_time"]');
  const metaAuthor = document.querySelector('meta[name="author"]');

  const authorName = metaAuthor?.getAttribute('content') || '';

  return {
    type: 'article',
    articleId,
    url,
    title: metaTitle?.getAttribute('content') || '',
    content: metaDesc?.getAttribute('content') || '',
    coverImage: metaImage?.getAttribute('content') || undefined,
    images: [],
    author: {
      displayName: authorName,
      handle: '',
      avatarUrl: '',
      profileUrl: '',
    },
    createdAt: metaPublished?.getAttribute('content') || new Date().toISOString(),
  };
}

/**
 * Extracts article data with detailed error information
 */
export function extractArticleDataWithDetails(): ExtractionResult<ArticleData> {
  const missingFields: string[] = [];

  try {
    const currentUrl = window.location.href;
    const articleId = extractArticleId(currentUrl) ?? findArticleIdFromDom();
    const container = findArticleContainer();
    const hasArticleDom = Boolean(container);
    const canonicalUrl = isArticlePage(currentUrl)
      ? currentUrl
      : articleId
        ? `https://x.com/i/article/${articleId}`
        : currentUrl;

    if (!articleId || (!isArticlePage(currentUrl) && !hasArticleDom)) {
      return {
        success: false,
        error: createError(ErrorCode.INVALID_URL, 'Could not extract article ID from page'),
        contentType: 'article',
      };
    }

    if (container) {
      const title = extractTitle(container);
      const content = extractContent(container);
      const coverImage = extractCoverImage(container);
      const images = extractArticleImages(container, coverImage);
      const author = extractAuthor(container);
      const createdAt = extractTimestamp(container);

      if (!title) {
        missingFields.push('article title');
      }
      if (!content) {
        missingFields.push('article content');
      }
      if (!author) {
        missingFields.push('article author');
      }

      if (author) {
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
    } else {
      missingFields.push('article container');
    }

    const metaData = extractFromMeta(articleId, canonicalUrl);
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
export function extractArticleData(): ArticleData | null {
  const result = extractArticleDataWithDetails();
  return result.success ? result.data ?? null : null;
}
