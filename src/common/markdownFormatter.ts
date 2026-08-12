/**
 * Markdown formatter for X Post Saver
 * Converts PostData to Markdown format for clipboard fallback mode
 * Requirements: 8.2, 8.3, 8.4, 8.5, 8.6
 */

import type { ArticleData, ContentData, PostData } from './types';

/**
 * Formats a date string to yyyy-MM-dd HH:mm:ss format
 * @param dateStr - ISO 8601 date string or other parseable date format
 * @returns Formatted date string
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr; // Return original if parsing fails
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return dateStr; // Return original on error
  }
}

/**
 * Formats a PostData object as a Markdown string
 * Requirements: 8.2, 8.3, 8.4, 8.5, 8.6
 * 
 * Output format:
 * ## {displayName} ({handle})
 * 
 * {content}
 * 
 * {images as ![image](url) for each}
 * 
 * 🔗 [Original Post]({url})
 * 
 * 📅 {createdAt in yyyy-MM-dd HH:mm:ss format}
 * 
 * @param postData - The post data to format
 * @returns Markdown formatted string
 */
export function formatContentAsMarkdown(contentData: ContentData): string {
  const lines: string[] = [];

  if (contentData.type === 'article') {
    const article: ArticleData = contentData;
    lines.push(`# ${article.title}`);
    lines.push('');
    lines.push(`by ${article.author.displayName} (${article.author.handle})`);
    lines.push('');

    if (article.coverImage) {
      lines.push(`![cover](${article.coverImage})`);
      lines.push('');
    }

    if (article.content) {
      lines.push(article.content);
      lines.push('');
    }

    if (article.images && article.images.length > 0) {
      for (const imageUrl of article.images) {
        lines.push(`![image](${imageUrl})`);
      }
      lines.push('');
    }

    lines.push(`🔗 [Original Article](${article.url})`);
    lines.push('');
    lines.push(`📅 ${formatDate(article.createdAt)}`);
    return lines.join('\n');
  }

  const postData: PostData = { ...contentData, type: 'post' };

  // Title with author name and handle (Requirements: 8.2)
  lines.push(`## ${postData.author.displayName} (${postData.author.handle})`);
  lines.push('');

  // Post content as body text (Requirements: 8.3)
  if (postData.content) {
    lines.push(postData.content);
    lines.push('');
  }

  // Images as Markdown image links (Requirements: 8.4)
  if (postData.images && postData.images.length > 0) {
    for (const imageUrl of postData.images) {
      lines.push(`![image](${imageUrl})`);
    }
    lines.push('');
  }

  // Original post URL as a link (Requirements: 8.5)
  lines.push(`🔗 [Original Post](${postData.url})`);
  lines.push('');

  // Creation timestamp in yyyy-MM-dd HH:mm:ss format (Requirements: 8.6)
  lines.push(`📅 ${formatDate(postData.createdAt)}`);

  return lines.join('\n');
}

/**
 * Backward compatible wrapper for post-only formatting
 */
export function formatPostAsMarkdown(postData: PostData): string {
  return formatContentAsMarkdown({ ...postData, type: 'post' });
}
