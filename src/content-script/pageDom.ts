/**
 * Shared DOM helpers for X page extraction.
 * Supports both the legacy data-testid markup and the 2026 redesign
 * (article[data-tweet-id], .x-article-body, img[alt="Article cover image"]).
 */

import type { AuthorData } from '../common/types';
import { extractPostId } from '../common/urlParser';

export interface ExtractionContext {
  document?: Document;
  url?: string;
}

export function resolveDocument(ctx?: ExtractionContext): Document {
  return ctx?.document ?? document;
}

export function resolveUrl(ctx?: ExtractionContext): string {
  if (ctx?.url) {
    return ctx.url;
  }
  if (typeof window !== 'undefined' && window.location) {
    return window.location.href;
  }
  return '';
}

const TWEET_CONTAINER = 'article[data-testid="tweet"], article[data-tweet-id]';

const ARTICLE_BODY_SELECTORS = [
  '[data-testid="twitterArticleReadView"]',
  '[data-testid="twitterArticleRichTextView"]',
  '[data-testid="article-content"]',
  '.x-article-body',
  '[data-testid="longformRichTextComponent"]',
];

function widenArticleRoot(el: Element): Element {
  const wrapper = el.closest(
    'article, [data-testid="twitterArticleReadView"], [data-testid="twitterArticleRichTextView"], [data-testid="article-content"]'
  );
  if (wrapper) {
    return wrapper;
  }

  let current: Element | null = el.parentElement;
  while (current) {
    if (current.querySelector('h1, img[alt="Article cover image"]')) {
      return current;
    }
    current = current.parentElement;
  }

  return el;
}

export function hasArticleDom(root: ParentNode): boolean {
  return ARTICLE_BODY_SELECTORS.some((selector) => root.querySelector(selector) !== null)
    || root.querySelector('img[alt="Article cover image"]') !== null;
}

export function findTweetContainer(doc: Document, postId?: string | null): Element | null {
  if (postId) {
    const byAttr = doc.querySelector(`article[data-tweet-id="${postId}"]`);
    if (byAttr) {
      return byAttr;
    }

    const tweets = Array.from(doc.querySelectorAll(TWEET_CONTAINER));
    for (const tweet of tweets) {
      const links = Array.from(tweet.querySelectorAll('a[href*="/status/"]'));
      const matchesId = links.some((link) => {
        const href = link.getAttribute('href') || '';
        return href.includes(`/status/${postId}`);
      });
      if (matchesId) {
        return tweet;
      }
    }
  }

  return doc.querySelector(TWEET_CONTAINER);
}

export function findArticleRoot(doc: Document, url: string): Element | null {
  const postId = extractPostId(url);
  if (postId) {
    const tweet = findTweetContainer(doc, postId);
    if (tweet && hasArticleDom(tweet)) {
      return tweet;
    }
  }

  for (const selector of ARTICLE_BODY_SELECTORS) {
    const el = doc.querySelector(selector);
    if (!el) {
      continue;
    }
    return widenArticleRoot(el);
  }

  const cover = doc.querySelector('img[alt="Article cover image"]');
  if (cover) {
    return cover.closest('article') ?? cover.parentElement;
  }

  return null;
}

function isDocumentNode(root: ParentNode): root is Document {
  return (root as Document).nodeType === 9 && Boolean((root as Document).documentElement);
}

export function findArticleIdInDom(root: ParentNode): string | null {
  const links = Array.from(root.querySelectorAll('a[href*="/article/"]')) as HTMLAnchorElement[];
  for (const link of links) {
    const href = link.getAttribute('href') || link.href || '';
    const match = href.match(/\/article\/(\d+)/);
    if (match) {
      return match[1];
    }
  }

  const html = isDocumentNode(root)
    ? root.documentElement?.innerHTML ?? ''
    : (root as Element).innerHTML ?? '';
  const embedded = Array.from(
    html.matchAll(/(?:x\.com|twitter\.com)\/i\/article\/(\d+)/g)
  )
    .map((match) => match[1])
    .filter((id) => id.length >= 10)
    .sort((a, b) => b.length - a.length)[0];
  if (embedded) {
    return embedded;
  }

  if (isDocumentNode(root)) {
    const ogUrl = root.querySelector('meta[property="og:url"]');
    const ogHref = ogUrl?.getAttribute('content') || '';
    const ogMatch = ogHref.match(/\/article\/(\d+)/);
    if (ogMatch) {
      return ogMatch[1];
    }
  }

  return null;
}

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

export function serializeInline(node: Node): string {
  if (node.nodeType === TEXT_NODE) {
    return node.textContent ?? '';
  }

  if (node.nodeType !== ELEMENT_NODE) {
    return '';
  }

  const el = node as HTMLElement;
  const children = Array.from(el.childNodes).map(serializeInline).join('');

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
    case 'IMG': {
      const alt = el.getAttribute('alt') || '';
      return alt;
    }
    default:
      return children;
  }
}

export function serializeTweetText(element: Element): string {
  return serializeInline(element).replace(/\n{3,}/g, '\n\n').trim();
}

export function extractAuthorFromContainer(
  container: Element,
  doc: Document
): AuthorData | null {
  const avatarImg =
    (container.querySelector('[data-testid="Tweet-User-Avatar"] img') as HTMLImageElement | null)
    ?? (container.querySelector('img[alt="user avatar"]') as HTMLImageElement | null)
    ?? (doc.querySelector('[data-testid="Tweet-User-Avatar"] img') as HTMLImageElement | null)
    ?? (doc.querySelector('img[alt="user avatar"]') as HTMLImageElement | null);
  const avatarUrl = avatarImg?.src || '';

  let handle = '';
  let displayName = '';
  let profileUrl = '';

  const userNameContainer =
    container.querySelector('[data-testid="User-Name"]')
    ?? doc.querySelector('[data-testid="User-Name"]');

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
    const links = Array.from(container.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    for (const link of links) {
      const text = link.textContent?.trim() || '';
      if (/^@[a-zA-Z0-9_]{1,15}$/.test(text)) {
        handle = text;
        profileUrl = link.href || profileUrl;
        break;
      }
    }

    for (const link of links) {
      const href = link.getAttribute('href') || link.href || '';
      const match =
        href.match(/^https:\/\/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})$/)
        || href.match(/^\/([a-zA-Z0-9_]{1,15})$/);
      const text = link.textContent?.trim() || '';
      if (match && text && !text.startsWith('@')) {
        displayName = text;
        if (!profileUrl) {
          profileUrl = link.href;
        }
        if (!handle) {
          handle = `@${match[1]}`;
        }
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
}

export function extractTimestampFromContainer(container: Element, doc?: Document): string {
  const publishedMeta =
    container.querySelector('meta[itemprop="datePublished"]')
    ?? container.querySelector('meta[itemprop="dateCreated"]')
    ?? doc?.querySelector('meta[property="article:published_time"]')
    ?? null;
  const metaContent = publishedMeta?.getAttribute('content');
  if (metaContent) {
    return metaContent;
  }

  const timeElement = container.querySelector('time[datetime]');
  const datetime = timeElement?.getAttribute('datetime');
  if (datetime) {
    return datetime;
  }

  return '';
}

export function isAvatarOrDecorativeImage(img: HTMLImageElement): boolean {
  const src = img.src || '';
  const alt = (img.getAttribute('alt') || '').toLowerCase();
  return (
    alt === 'user avatar'
    || src.includes('profile_images')
    || src.includes('emoji')
    || img.closest('[data-testid="Tweet-User-Avatar"]') !== null
  );
}
