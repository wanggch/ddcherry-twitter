/**
 * Serialization utilities for X Post Saver
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import type { PostData, AuthorData, ArticleData, ContentData } from './types';

function serializeAuthor(author: AuthorData): AuthorData {
  return {
    displayName: author.displayName,
    handle: author.handle,
    avatarUrl: author.avatarUrl,
    profileUrl: author.profileUrl,
  };
}

/**
 * Serializes content data to a JSON string
 * Requirements: 6.1, 6.2, 6.3
 * 
 * @param contentData - The content data to serialize
 * @returns JSON string representation of the post or article data
 */
export function serializeContentData(contentData: ContentData): string {
  if (contentData.type === 'article') {
    const article: ArticleData = contentData;
    return JSON.stringify({
      type: 'article',
      articleId: article.articleId,
      url: article.url,
      title: article.title,
      content: article.content,
      coverImage: article.coverImage,
      images: article.images,
      author: serializeAuthor(article.author),
      createdAt: article.createdAt,
    });
  }

  const post: PostData = { ...contentData, type: 'post' };
  return JSON.stringify({
    type: 'post',
    postId: post.postId,
    url: post.url,
    content: post.content,
    images: post.images,
    author: serializeAuthor(post.author),
    createdAt: post.createdAt,
  });
}

/**
 * Parses a JSON string back to content data
 * Requirements: 6.4
 * 
 * @param json - The JSON string to parse
 * @returns The parsed content data object
 * @throws Error if the JSON is invalid or missing required fields
 */
export function parseContentData(json: string): ContentData {
  const parsed = JSON.parse(json);
  
  // Validate required fields
  if (typeof parsed.url !== 'string') {
    throw new Error('Invalid url: expected string');
  }
  if (typeof parsed.content !== 'string') {
    throw new Error('Invalid content: expected string');
  }
  if (!Array.isArray(parsed.images) || !parsed.images.every((img: unknown) => typeof img === 'string')) {
    throw new Error('Invalid images: expected array of strings');
  }
  if (typeof parsed.createdAt !== 'string') {
    throw new Error('Invalid createdAt: expected string');
  }
  
  // Validate author object
  if (!parsed.author || typeof parsed.author !== 'object') {
    throw new Error('Invalid author: expected object');
  }
  if (typeof parsed.author.displayName !== 'string') {
    throw new Error('Invalid author.displayName: expected string');
  }
  if (typeof parsed.author.handle !== 'string') {
    throw new Error('Invalid author.handle: expected string');
  }
  if (typeof parsed.author.avatarUrl !== 'string') {
    throw new Error('Invalid author.avatarUrl: expected string');
  }
  if (typeof parsed.author.profileUrl !== 'string') {
    throw new Error('Invalid author.profileUrl: expected string');
  }

  const author: AuthorData = serializeAuthor(parsed.author);

  if (parsed.type === 'article') {
    if (typeof parsed.articleId !== 'string') {
      throw new Error('Invalid articleId: expected string');
    }
    if (typeof parsed.title !== 'string') {
      throw new Error('Invalid title: expected string');
    }

    const article: ArticleData = {
      type: 'article',
      articleId: parsed.articleId,
      url: parsed.url,
      title: parsed.title,
      content: parsed.content,
      coverImage: typeof parsed.coverImage === 'string' ? parsed.coverImage : undefined,
      images: parsed.images,
      author,
      createdAt: parsed.createdAt,
    };
    return article;
  }

  if (typeof parsed.postId !== 'string') {
    throw new Error('Invalid postId: expected string');
  }

  const post: PostData = {
    type: 'post',
    postId: parsed.postId,
    url: parsed.url,
    content: parsed.content,
    images: parsed.images,
    author,
    createdAt: parsed.createdAt,
  };
  return post;
}

/**
 * Legacy helper to parse post-only payloads
 * @deprecated Use parseContentData instead
 */
export function parsePostData(json: string): PostData {
  const parsed = parseContentData(json);
  if ('postId' in parsed) {
    return parsed;
  }
  throw new Error('Parsed data is not a post');
}
