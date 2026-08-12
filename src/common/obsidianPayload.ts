import type { ArticleData, ContentData, PostData } from './types';

export interface ObsidianImportRequest {
  tweetId: string;
  authorName?: string;
  authorUsername?: string;
  text: string;
  url: string;
  capturedAt: string;
}

function stripAtPrefix(handle: string): string | undefined {
  const withoutAt = handle.replace(/^@+/, '');
  return withoutAt || undefined;
}

export function buildObsidianPayload(
  contentData: ContentData,
  capturedAt = new Date().toISOString()
): ObsidianImportRequest {
  const authorName = contentData.author.displayName || undefined;
  const authorUsername = stripAtPrefix(contentData.author.handle);
  const url = contentData.url;

  if (contentData.type === 'article') {
    const article: ArticleData = contentData;
    const text = [article.title, article.content].filter(Boolean).join('\n\n');
    return {
      tweetId: article.articleId,
      authorName,
      authorUsername,
      text,
      url,
      capturedAt,
    };
  }

  const post: PostData = { ...contentData, type: 'post' };
  return {
    tweetId: post.postId,
    authorName,
    authorUsername,
    text: post.content,
    url,
    capturedAt,
  };
}
