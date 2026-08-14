import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { extractArticleDataWithDetails } from './articleExtractor';
import { extractPostDataWithDetails } from './postExtractor';

const STATUS_URL = 'https://x.com/yyyole/status/2087019202557227329';
const REPLY_URL = 'https://x.com/prof_polaa/status/2087019277123785012';

function statusPageArticleHtml(): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>沐阳 on X: "https://t.co/0u8Uz98Tm8" / X</title>
    <meta property="og:url" content="${STATUS_URL}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="沐阳 (@yyyole) on X" />
    <meta property="og:description" content="沐阳精选！25组爆款插画提示词合集！" />
    <meta property="og:image" content="https://pbs.twimg.com/media/HPaS7uAacAA6j5f.jpg" />
    <meta property="article:published_time" content="2026-08-11T03:32:07.000Z" />
  </head>
  <body>
    <article class="flex flex-col gap-1" data-tweet-id="2087019202557227329" itemType="https://schema.org/SocialMediaPosting">
      <meta content="2026-08-11T03:32:07.000Z" itemprop="dateCreated" />
      <meta content="2026-08-11T03:32:07.000Z" itemprop="datePublished" />
      <meta content="https://pbs.twimg.com/media/HPaS7uAacAA6j5f.jpg:large" itemprop="image" />
      <a href="/yyyole">
        <img alt="user avatar" src="https://pbs.twimg.com/profile_images/1986002260447707136/lf3UN9Xp_normal.jpg" />
      </a>
      <a class="font-bold" href="https://x.com/yyyole">沐阳</a>
      <a href="https://x.com/yyyole">@yyyole</a>
      <div dir="auto"></div>
      <img alt="Article cover image" src="https://pbs.twimg.com/media/HPaS7uAacAA6j5f.jpg" />
      <h1>沐阳精选！25组爆款插画提示词合集！</h1>
      <div class="x-article-body break-words">
        <p>前段时间，我集中分享了一批原创插画风格提示词。</p>
        <p>已经开源到GitHub！</p>
        <p><a href="https://github.com/yokel1121/muyang-illustration-skills">https://github.com/yokel1121/muyang-illustration-skills</a></p>
        <p>1、精致极简插画</p>
        <p>提示词：一张极简主义现代杂志风格插画，主体为[xxx]。</p>
        <p>25、柔焦霓虹插画</p>
        <p>提示词：梦幻柔焦霓虹影像风插画。</p>
      </div>
    </article>
    <article class="flex flex-col gap-1" data-tweet-id="2087019277123785012">
      <a href="/prof_polaa">
        <img alt="user avatar" src="https://pbs.twimg.com/profile_images/2085043152478740480/MFTsYwMH_normal.jpg" />
      </a>
      <a class="font-bold" href="https://x.com/prof_polaa">最高85%Gate芝麻开门返佣补绑</a>
      <a href="https://x.com/prof_polaa">@prof_polaa</a>
      <a href="/prof_polaa/status/2087019277123785012">Aug 11</a>
      <div dir="auto"><span>这种行情下轻仓博弈或许比满仓更稳健些</span></div>
    </article>
    <script>window.__ARTICLE__={"display_url":"x.com/i/article/2087…","expanded_url":"http://x.com/i/article/2087009065910341632"}</script>
  </body>
</html>`;
}

function newStyleTweetHtml(): string {
  return `<!DOCTYPE html>
<html>
  <body>
    <article data-tweet-id="2087019277123785012">
      <a href="/prof_polaa">
        <img alt="user avatar" src="https://pbs.twimg.com/profile_images/avatar.jpg" />
      </a>
      <a class="font-bold" href="https://x.com/prof_polaa">最高85%Gate芝麻开门返佣补绑</a>
      <a href="https://x.com/prof_polaa">@prof_polaa</a>
      <a href="/prof_polaa/status/2087019277123785012">Aug 11</a>
      <div dir="auto"><span>这种行情下轻仓博弈或许比满仓更稳健些</span></div>
    </article>
    <article data-tweet-id="999">
      <a class="font-bold" href="https://x.com/other">其他人</a>
      <a href="https://x.com/other">@other</a>
      <div dir="auto"><span>这是另一条帖子，不应该被提取</span></div>
    </article>
  </body>
</html>`;
}

function legacyTweetHtml(): string {
  return `<!DOCTYPE html>
<html>
  <body>
    <article data-testid="tweet">
      <div data-testid="Tweet-User-Avatar"><img src="https://pbs.twimg.com/profile_images/a.jpg" /></div>
      <div data-testid="User-Name">
        <a role="link" href="https://x.com/dotey"><span>宝玉</span></a>
        <a role="link" tabindex="-1" href="https://x.com/dotey"><span>@dotey</span></a>
      </div>
      <div data-testid="tweetText">第一行<br>第二行</div>
      <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/photo.jpg" /></div>
      <time datetime="2024-01-02T03:04:05.000Z">Jan 2</time>
    </article>
  </body>
</html>`;
}

function legacyArticleHtml(): string {
  return `<!DOCTYPE html>
<html>
  <body>
    <div data-testid="twitterArticleReadView">
      <div data-testid="Tweet-User-Avatar"><img src="https://pbs.twimg.com/profile_images/a.jpg" /></div>
      <div data-testid="User-Name">
        <a role="link" href="https://x.com/writer"><span>作者</span></a>
        <a role="link" tabindex="-1" href="https://x.com/writer"><span>@writer</span></a>
      </div>
      <h1 data-testid="article-title">旧版长文章标题</h1>
      <div data-testid="longformRichTextComponent">
        <div data-block="true">第一段</div>
        <div data-block="true">第二段</div>
      </div>
      <time datetime="2024-05-01T00:00:00.000Z"></time>
    </div>
  </body>
</html>`;
}

function makeDom(html: string, url: string): Document {
  return new JSDOM(html, { url }).window.document;
}

describe('status-page X article (2026 redesign)', () => {
  it('extracts title, cover, author and full body from /status/ article', () => {
    const result = extractArticleDataWithDetails({
      document: makeDom(statusPageArticleHtml(), STATUS_URL),
      url: STATUS_URL,
    });

    expect(result.success, JSON.stringify(result.error)).toBe(true);
    expect(result.contentType).toBe('article');
    expect(result.data?.title).toBe('沐阳精选！25组爆款插画提示词合集！');
    expect(result.data?.author.handle).toBe('@yyyole');
    expect(result.data?.author.displayName).toBe('沐阳');
    expect(result.data?.coverImage).toContain('HPaS7uAacAA6j5f.jpg');
    expect(result.data?.content).toContain('1、精致极简插画');
    expect(result.data?.content).toContain('25、柔焦霓虹插画');
    expect(result.data?.content).toContain('github.com/yokel1121/muyang-illustration-skills');
    expect(result.data?.createdAt).toBe('2026-08-11T03:32:07.000Z');
    expect(result.data?.url).toBe(STATUS_URL);
    expect(result.data?.articleId).toBe('2087009065910341632');
  });

  it('does not treat a regular new-style tweet as an article', () => {
    const result = extractArticleDataWithDetails({
      document: makeDom(newStyleTweetHtml(), REPLY_URL),
      url: REPLY_URL,
    });

    expect(result.success).toBe(false);
  });
});

describe('post extractor', () => {
  it('extracts the tweet matching the status id, not a sibling tweet', () => {
    const result = extractPostDataWithDetails({
      document: makeDom(newStyleTweetHtml(), REPLY_URL),
      url: REPLY_URL,
    });

    expect(result.success, JSON.stringify(result.error)).toBe(true);
    expect(result.data?.postId).toBe('2087019277123785012');
    expect(result.data?.author.handle).toBe('@prof_polaa');
    expect(result.data?.content).toBe('这种行情下轻仓博弈或许比满仓更稳健些');
    expect(result.data?.content).not.toContain('另一条帖子');
  });

  it('preserves line breaks in legacy tweetText', () => {
    const result = extractPostDataWithDetails({
      document: makeDom(legacyTweetHtml(), 'https://x.com/dotey/status/1234567890'),
      url: 'https://x.com/dotey/status/1234567890',
    });

    expect(result.success, JSON.stringify(result.error)).toBe(true);
    expect(result.data?.author.handle).toBe('@dotey');
    expect(result.data?.author.displayName).toBe('宝玉');
    expect(result.data?.content).toBe('第一行\n第二行');
    expect(result.data?.images).toEqual(['https://pbs.twimg.com/media/photo.jpg']);
    expect(result.data?.createdAt).toBe('2024-01-02T03:04:05.000Z');
  });
});

describe('legacy article extractor', () => {
  it('still extracts /i/article pages that use data-testid markup', () => {
    const url = 'https://x.com/i/article/9876543210';
    const result = extractArticleDataWithDetails({
      document: makeDom(legacyArticleHtml(), url),
      url,
    });

    expect(result.success, JSON.stringify(result.error)).toBe(true);
    expect(result.data?.articleId).toBe('9876543210');
    expect(result.data?.title).toBe('旧版长文章标题');
    expect(result.data?.content).toContain('第一段');
    expect(result.data?.content).toContain('第二段');
    expect(result.data?.author.handle).toBe('@writer');
  });
});
