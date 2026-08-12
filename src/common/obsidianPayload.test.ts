import { describe, it, expect } from 'vitest';
import { buildObsidianPayload } from './obsidianPayload';
import type { ArticleData, PostData } from './types';

const baseAuthor = {
  displayName: 'Test User',
  handle: '@testuser',
  avatarUrl: '',
  profileUrl: 'https://x.com/testuser',
};

describe('buildObsidianPayload', () => {
  it('maps post data to import request', () => {
    const post: PostData = {
      type: 'post',
      postId: '1234567890',
      url: 'https://x.com/testuser/status/1234567890',
      content: 'Hello world',
      images: [],
      author: baseAuthor,
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const result = buildObsidianPayload(post, '2026-06-17T10:00:00.000Z');

    expect(result).toEqual({
      tweetId: '1234567890',
      authorName: 'Test User',
      authorUsername: 'testuser',
      text: 'Hello world',
      url: 'https://x.com/testuser/status/1234567890',
      capturedAt: '2026-06-17T10:00:00.000Z',
    });
  });

  it('maps article data with title and content', () => {
    const article: ArticleData = {
      type: 'article',
      articleId: '9876543210',
      url: 'https://x.com/i/article/9876543210',
      title: 'Article Title',
      content: 'Article body',
      images: [],
      author: baseAuthor,
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const result = buildObsidianPayload(article);

    expect(result.tweetId).toBe('9876543210');
    expect(result.text).toBe('Article Title\n\nArticle body');
    expect(result.authorUsername).toBe('testuser');
  });

  it('strips leading @ from author handle', () => {
    const post: PostData = {
      type: 'post',
      postId: '1',
      url: 'https://x.com/testuser/status/1',
      content: 'c',
      images: [],
      author: { ...baseAuthor, handle: '@@weird' },
      createdAt: '',
    };

    expect(buildObsidianPayload(post).authorUsername).toBe('weird');
  });
});
