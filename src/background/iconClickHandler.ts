/**
 * Handles the extension toolbar icon click.
 * Copies the current page content as Markdown, and optionally saves it
 * to the local Obsidian service.
 */

import { getConfig } from '../common/storage';
import { formatContentAsMarkdown } from '../common/markdownFormatter';
import { buildObsidianPayload } from '../common/obsidianPayload';
import { extractContentDataFromTab, copyToClipboard } from './pageUtils';
import { showSuccessToast, showErrorToast } from './toastUtils';
import type { ContentData } from '../common/types';

const DEFAULT_OBSIDIAN_BASE_URL = 'http://127.0.0.1:18787';

function isSupportedUrl(url: string): boolean {
  return /^https:\/\/(x\.com|twitter\.com)\//.test(url);
}

export async function handleActionClick(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !tab.url) {
    showErrorToast(tab.id ?? 0, '无法识别当前页面');
    return;
  }

  if (!isSupportedUrl(tab.url)) {
    showErrorToast(tab.id, '请在 X/Twitter 帖子或文章页面使用');
    return;
  }

  const extractionResult = await extractContentDataFromTab(tab.id);
  if (!extractionResult.success || !extractionResult.data) {
    showErrorToast(
      tab.id,
      extractionResult.error || '未识别到页面内容，请刷新后重试'
    );
    return;
  }

  const contentData: ContentData =
    extractionResult.data.type === 'article'
      ? extractionResult.data
      : { ...extractionResult.data, type: 'post' as const };

  const markdown = formatContentAsMarkdown(contentData);
  const clipboardResult = await copyToClipboard(tab.id, markdown);
  if (!clipboardResult.success) {
    showErrorToast(
      tab.id,
      clipboardResult.error || '复制到剪贴板失败'
    );
    return;
  }

  showSuccessToast(tab.id, '已复制到剪贴板');

  const config = await getConfig();
  if (!config.enableObsidian) {
    return;
  }

  const baseUrl = (config.obsidianBaseUrl || DEFAULT_OBSIDIAN_BASE_URL).replace(/\/+$/, '');
  const payload = buildObsidianPayload(contentData);

  try {
    const response = await fetch(`${baseUrl}/api/tweets/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      showSuccessToast(tab.id, '已保存到本地 Obsidian');
      return;
    }

    let message = '保存到本地 Obsidian 失败';
    try {
      const data = await response.json();
      message = data.message || data.error?.message || message;
    } catch {
      // ignore non-JSON error response
    }
    showErrorToast(tab.id, message);
  } catch {
    showErrorToast(tab.id, '本地 Obsidian 服务无法连接');
  }
}
