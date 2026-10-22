import assert from "node:assert/strict";
import { once } from "node:events";
import { describe, it, beforeEach } from "node:test";
import { createApp } from "../src/app.js";
import {
  clearNewsCache,
  getNewsArticles,
  parseRssFeed,
  FALLBACK_ARTICLES,
  SUPPORTED_LANGUAGES,
  SUPPORTED_REGIONS,
} from "../src/news.js";

async function withServer(app, callback) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

describe("Cinema Pulse news service", () => {
  beforeEach(() => {
    clearNewsCache();
  });

  it("exports supported regions and languages", () => {
    assert.deepEqual(SUPPORTED_REGIONS, ["all", "india", "global"]);
    assert.deepEqual(SUPPORTED_LANGUAGES, ["all", "en", "hi", "ta", "te"]);
  });

  it("parses RSS 2.0 feeds with CDATA, images, and HTML entities", () => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
      <channel>
        <title>Cinema Trade</title>
        <item>
          <title><![CDATA[Dune Part Two &amp; The Future of Sci-Fi]]></title>
          <link>https://example.com/dune-2-news</link>
          <description><![CDATA[<p>Denis Villeneuve&#39;s latest film <b>breaks</b> box office records.</p>]]></description>
          <pubDate>Mon, 14 Apr 2026 12:00:00 GMT</pubDate>
          <enclosure url="https://example.com/dune.jpg" type="image/jpeg" />
        </item>
        <item>
          <title>Second Item Without Enclosure</title>
          <link>https://example.com/second-item</link>
          <description>Simple summary &quot;quotes&quot; and &mdash; dashes.</description>
          <pubDate>Sun, 13 Apr 2026 10:00:00 GMT</pubDate>
          <media:thumbnail url="https://example.com/thumb.jpg" />
        </item>
      </channel>
    </rss>`;

    const feed = {
      id: "test-feed",
      name: "Test Pub",
      region: "global",
      language: "en",
    };

    const articles = parseRssFeed(sampleXml, feed);

    assert.equal(articles.length, 2);
    assert.equal(articles[0].title, "Dune Part Two & The Future of Sci-Fi");
    assert.equal(articles[0].url, "https://example.com/dune-2-news");
    assert.equal(
      articles[0].summary,
      "Denis Villeneuve's latest film breaks box office records.",
    );
    assert.equal(articles[0].imageUrl, "https://example.com/dune.jpg");
    assert.equal(articles[0].source, "Test Pub");
    assert.equal(articles[0].sourceId, "test-feed");
    assert.equal(articles[0].region, "global");
    assert.equal(articles[0].language, "en");

    assert.equal(articles[1].title, "Second Item Without Enclosure");
    assert.equal(
      articles[1].summary,
      'Simple summary "quotes" and — dashes.',
    );
    assert.equal(articles[1].imageUrl, "https://example.com/thumb.jpg");
  });

  it("parses Atom entries with link href and updated tags", () => {
    const sampleAtom = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Atom Feed</title>
      <entry>
        <title>New Hindi Film Announcement</title>
        <link href="https://example.com/hindi-film" />
        <summary>Exciting project announced by veteran director.</summary>
        <updated>2026-04-12T15:00:00Z</updated>
      </entry>
    </feed>`;

    const feed = {
      id: "atom-feed",
      name: "Atom Source",
      region: "india",
      language: "hi",
    };

    const articles = parseRssFeed(sampleAtom, feed);
    assert.equal(articles.length, 1);
    assert.equal(articles[0].title, "New Hindi Film Announcement");
    assert.equal(articles[0].url, "https://example.com/hindi-film");
    assert.equal(
      articles[0].summary,
      "Exciting project announced by veteran director.",
    );
    assert.equal(articles[0].region, "india");
    assert.equal(articles[0].language, "hi");
  });

  it("handles malformed XML and missing fields gracefully without crashing", () => {
    const feed = {
      id: "broken",
      name: "Broken",
      region: "global",
      language: "en",
    };

    assert.deepEqual(parseRssFeed("", feed), []);
    assert.deepEqual(parseRssFeed("not xml at all", feed), []);
    assert.deepEqual(parseRssFeed("<rss><item></item></rss>", feed), []);
  });

  it("filters feeds by region and language and respects limits", async () => {
    const mockFeeds = [
      {
        id: "feed-global",
        name: "Global Feed",
        region: "global",
        language: "en",
        url: "https://test.example/global.rss",
      },
      {
        id: "feed-india-hi",
        name: "India Hindi",
        region: "india",
        language: "hi",
        url: "https://test.example/india-hi.rss",
      },
      {
        id: "feed-india-en",
        name: "India English",
        region: "india",
        language: "en",
        url: "https://test.example/india-en.rss",
      },
    ];

    const requestedUrls = [];
    const mockFetch = async (url) => {
      requestedUrls.push(String(url));
      return {
        ok: true,
        status: 200,
        text: async () => `<rss version="2.0">
          <channel>
            <item>
              <title>Article from ${url}</title>
              <link>${url}/article-1</link>
              <pubDate>2026-04-10T12:00:00Z</pubDate>
              <description>Summary</description>
            </item>
          </channel>
        </rss>`,
      };
    };

    // Filter for india + hi
    const resultHindi = await getNewsArticles({
      region: "india",
      language: "hi",
      limit: 10,
      fetchImpl: mockFetch,
      useCache: false,
      feeds: mockFeeds,
    });

    assert.equal(resultHindi.articles.length, 1);
    assert.equal(resultHindi.articles[0].language, "hi");
    assert.equal(resultHindi.articles[0].region, "india");
    assert.deepEqual(requestedUrls, ["https://test.example/india-hi.rss"]);

    // Filter for all + all
    requestedUrls.length = 0;
    const resultAll = await getNewsArticles({
      region: "all",
      language: "all",
      limit: 2,
      fetchImpl: mockFetch,
      useCache: false,
      feeds: mockFeeds,
    });

    assert.equal(resultAll.articles.length, 2);
    assert.equal(requestedUrls.length, 3);
  });

  it("uses fallback articles when all feeds fail or are unreachable", async () => {
    const failingFetch = async () => {
      throw new Error("Network unreachable");
    };

    const result = await getNewsArticles({
      region: "india",
      language: "hi",
      limit: 5,
      fetchImpl: failingFetch,
      useCache: false,
    });

    assert.ok(result.articles.length > 0);
    assert.equal(result.articles[0].region, "india");
    assert.equal(result.articles[0].language, "hi");
    assert.ok(FALLBACK_ARTICLES.some((f) => f.id === result.articles[0].id));
  });

  it("caches feed responses within TTL", async () => {
    let callCount = 0;
    const mockFeed = {
      id: "cache-feed",
      name: "Cache Feed",
      region: "global",
      language: "en",
      url: "https://cache.example/feed.rss",
    };

    const mockFetch = async () => {
      callCount += 1;
      return {
        ok: true,
        status: 200,
        text: async () => `<rss version="2.0">
          <channel>
            <item>
              <title>Cached Title</title>
              <link>https://cache.example/item-1</link>
              <pubDate>2026-04-10T12:00:00Z</pubDate>
              <description>Cached Summary</description>
            </item>
          </channel>
        </rss>`,
      };
    };

    await getNewsArticles({
      region: "global",
      language: "en",
      fetchImpl: mockFetch,
      useCache: true,
      feeds: [mockFeed],
    });

    await getNewsArticles({
      region: "global",
      language: "en",
      fetchImpl: mockFetch,
      useCache: true,
      feeds: [mockFeed],
    });

    assert.equal(callCount, 1);
  });
});

describe("Cinema Pulse API endpoint (GET /api/news)", () => {
  it("returns 200 and news articles with valid query parameters", async () => {
    const mockArticles = [
      {
        id: "news-1",
        title: "Exciting Film Festival Update",
        summary: "Festival announced lineup.",
        url: "https://example.com/news-1",
        imageUrl: null,
        publishedAt: "2026-04-14T10:00:00.000Z",
        source: "Variety",
        sourceId: "variety-film",
        region: "global",
        language: "en",
      },
    ];

    const app = createApp({
      newsArticles: async ({ region, language, limit }) => {
        assert.equal(region, "global");
        assert.equal(language, "en");
        assert.equal(limit, 10);
        return {
          articles: mockArticles,
          total: 1,
          region,
          language,
        };
      },
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/news?region=global&language=en&limit=10`,
      );
      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get("cache-control"),
        "public, max-age=300",
      );

      const data = await response.json();
      assert.deepEqual(data, {
        articles: mockArticles,
        total: 1,
        region: "global",
        language: "en",
      });
    });
  });

  it("validates region, language, and limit query parameters", async () => {
    const app = createApp();

    await withServer(app, async (baseUrl) => {
      // Invalid region
      const resRegion = await fetch(`${baseUrl}/api/news?region=mars`);
      assert.equal(resRegion.status, 400);
      assert.deepEqual(await resRegion.json(), {
        error: "Provide a valid region: all, india, or global.",
      });

      // Invalid language
      const resLang = await fetch(`${baseUrl}/api/news?language=klingon`);
      assert.equal(resLang.status, 400);
      assert.deepEqual(await resLang.json(), {
        error: "Provide a valid language: all, en, hi, ta, or te.",
      });

      // Invalid limit
      for (const limit of ["0", "51", "abc", "-5"]) {
        const resLimit = await fetch(`${baseUrl}/api/news?limit=${limit}`);
        assert.equal(resLimit.status, 400);
        assert.deepEqual(await resLimit.json(), {
          error: "Provide a limit between 1 and 50.",
        });
      }
    });
  });
});

