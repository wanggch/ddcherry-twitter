/**
 * Content Preview utility for X Post Saver
 * Requirements: 2.4
 */

/**
 * Maximum length for content preview
 */
const MAX_PREVIEW_LENGTH = 50;

/**
 * Truncates content to a maximum of 50 characters with ellipsis
 * Requirements: 2.4
 * 
 * @param content - The full content string to truncate
 * @returns A string of at most 50 characters, with "..." appended if truncated
 */
export function truncateContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }
  
  if (content.length <= MAX_PREVIEW_LENGTH) {
    return content;
  }
  
  return content.substring(0, MAX_PREVIEW_LENGTH) + '...';
}
