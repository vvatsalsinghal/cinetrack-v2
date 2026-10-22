import { createHash } from "node:crypto";

export const SUPPORTED_REGIONS = ["all", "india", "global"];
export const SUPPORTED_LANGUAGES = ["all", "en", "hi", "ta", "te"];

export const CINEMA_NEWS_FEEDS = [
  {
    id: "variety-film",
    name: "Variety",
    region: "global",
    language: "en",
    url: "https://variety.com/v/film/feed/",
  },
  {
    id: "deadline-film",
    name: "Deadline",
    region: "global",
    language: "en",
    url: "https://deadline.com/v/film/feed/",
  },
  {
    id: "the-hindu-cinema",
    name: "The Hindu",
    region: "india",
    language: "en",
    url: "https://www.thehindu.com/entertainment/movies/feeder/default.rss",
  },
  {
    id: "indian-express-entertainment",
    name: "The Indian Express",
    region: "india",
    language: "en",
    url: "https://indianexpress.com/section/entertainment/feed/",
  },
  {
    id: "bbc-hindi-entertainment",
    name: "BBC News Hindi",
    region: "india",
    language: "hi",
    url: "https://feeds.bbci.co.uk/hindi/entertainment/rss.xml",
  },
  {
    id: "cinema-express-tamil",
    name: "Cinema Express",
    region: "india",
    language: "ta",
    url: "https://www.cinemaexpress.com/tamil/rss",
  },
  {
    id: "cinema-express-telugu",
    name: "Cinema Express",
    region: "india",
    language: "te",
    url: "https://www.cinemaexpress.com/telugu/rss",
  },
];

export const FALLBACK_ARTICLES = [
  {
    id: "fallback-global-1",
    title: "Cannes Film Festival Unveils Anticipated Competition Lineup",
    summary:
      "A prestigious slate of auteur visions and international masterworks prepares to take the spotlight on the Croisette.",
    url: "https://variety.com/v/film/",
    imageUrl: null,
    publishedAt: "2026-04-14T10:00:00.000Z",
    source: "Variety",
    sourceId: "variety-film",
    region: "global",
    language: "en",
  },
  {
    id: "fallback-global-2",
    title: "Box Office Milestone: Sci-Fi Epics Lead Theatrical Surge",
    summary:
      "Moviegoers return in record numbers to large-format theaters, underscoring enduring appetite for cinematic spectacles.",
    url: "https://deadline.com/v/film/",
    imageUrl: null,
    publishedAt: "2026-04-12T14:30:00.000Z",
    source: "Deadline",
    sourceId: "deadline-film",
    region: "global",
    language: "en",
  },
  {
    id: "fallback-india-en-1",
    title: "Indian Cinema Celebrates International Festival Triumphs",
    summary:
      "Independent and regional filmmakers from across India earn accolades at major international film festivals.",
    url: "https://www.thehindu.com/entertainment/movies/",
    imageUrl: null,
    publishedAt: "2026-04-13T09:00:00.000Z",
    source: "The Hindu",
    sourceId: "the-hindu-cinema",
    region: "india",
    language: "en",
  },
  {
    id: "fallback-india-hi-1",
    title: "भारतीय सिनेमा में नई पटकथाओं और निर्देशकों का दौर",
    summary:
      "हिंदी फिल्म उद्योग में मौलिक कहानियों और यथार्थवादी सिनेमा को दर्शकों का भरपूर प्यार मिल रहा है।",
    url: "https://www.bbc.com/hindi/entertainment",
    imageUrl: null,
    publishedAt: "2026-04-11T08:00:00.000Z",
    source: "BBC News Hindi",
    sourceId: "bbc-hindi-entertainment",
    region: "india",
    language: "hi",
  },
  {
    id: "fallback-india-ta-1",
    title: "தமிழ் சினிமாவில் புதிய கதைக்களங்கள் மற்றும் உலகளாவிய வரவேற்பு",
    summary:
      "புதுமையான கதை சொல்லலும் சிறந்த தொழில்நுட்பமும் தமிழ் திரைப்படங்களை உலகத் தரத்திற்கு உயர்த்துகின்றன.",
    url: "https://www.cinemaexpress.com/tamil",
    imageUrl: null,
    publishedAt: "2026-04-10T07:30:00.000Z",
    source: "Cinema Express",
    sourceId: "cinema-express-tamil",
    region: "india",
    language: "ta",
  },
  {
    id: "fallback-india-te-1",
    title: "తెలుగు సినిమా ప్రస్థానం: ప్రపంచ వేదికలపై సరికొత్త రికార్డులు",
    summary:
      "భారీ కథాంశాలు, విజువల్ ఎఫెక్ట్స్‌తో తెలుగు చలనచిత్ర పరిశ్రమ అంతర్జాతీయ ప్రేక్షకులను ఆకట్టుకుంటోంది.",
    url: "https://www.cinemaexpress.com/telugu",
    imageUrl: null,
    publishedAt: "2026-04-09T06:00:00.000Z",
    source: "Cinema Express",
    sourceId: "cinema-express-telugu",
    region: "india",
    language: "te",
  },
];

// In-memory feed cache with timestamp: url -> { timestamp, articles }
const feedCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function clearNewsCache() {
  feedCache.clear();
}

function decodeHtmlEntities(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8216;|&#8217;|&lsquo;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, code) => {
      const num = Number.parseInt(code, 10);
      return Number.isFinite(num) ? String.fromCharCode(num) : "";
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const num = Number.parseInt(hex, 16);
      return Number.isFinite(num) ? String.fromCharCode(num) : "";
    });
}

function stripHtml(html) {
  if (typeof html !== "string") {
    return "";
  }
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractCdataOrText(xml, tagName) {
  const regex = new RegExp(
    `<${tagName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
    "i",
  );
  const match = xml.match(regex);
  if (!match) {
    return "";
  }
  let content = match[1].trim();
  const cdataMatch = content.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i);
  if (cdataMatch) {
    content = cdataMatch[1].trim();
  }
  return content;
}

function extractLink(itemXml) {
  const linkText = extractCdataOrText(itemXml, "link");
  if (linkText && /^https?:\/\//i.test(linkText.trim())) {
    return linkText.trim();
  }
  const hrefMatch = itemXml.match(
    /<link\s+[^>]*href=["'](https?:\/\/[^"']+)["']/i,
  );
  if (hrefMatch) {
    return hrefMatch[1].trim();
  }
  const guid = extractCdataOrText(itemXml, "guid");
  if (guid && /^https?:\/\//i.test(guid.trim())) {
    return guid.trim();
  }
  return null;
}

function extractImage(itemXml) {
  const enclosureMatch = itemXml.match(
    /<enclosure\s+[^>]*url=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"']*)?)["'][^>]*>/i,
  );
  if (enclosureMatch) {
    return enclosureMatch[1];
  }
  const mediaMatch = itemXml.match(
    /<media:(?:content|thumbnail)\s+[^>]*url=["'](https?:\/\/[^"']+)["'][^>]*>/i,
  );
  if (mediaMatch) {
    return mediaMatch[1];
  }
  const imgMatch = itemXml.match(
    /<img\s+[^>]*src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i,
  );
  if (imgMatch) {
    return imgMatch[1];
  }
  return null;
}

function parsePublishedDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") {
    return new Date().toISOString();
  }
  const parsed = Date.parse(dateStr);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

export function parseRssFeed(xmlText, feed) {
  if (typeof xmlText !== "string" || !xmlText.trim()) {
    return [];
  }

  const items = [];
  // Match either <item>...</item> (RSS) or <entry>...</entry> (Atom)
  const itemRegex = /<(?:item|entry)(?:[\s>][\s\S]*?)<\/(?:item|entry)>/gi;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[0];
    const rawTitle = extractCdataOrText(itemXml, "title");
    const title = stripHtml(rawTitle);
    if (!title) {
      continue;
    }

    const link = extractLink(itemXml);
    if (!link) {
      continue;
    }

    const rawDescription =
      extractCdataOrText(itemXml, "description") ||
      extractCdataOrText(itemXml, "summary") ||
      extractCdataOrText(itemXml, "content");
    const summary = stripHtml(rawDescription).slice(0, 300);

    const rawDate =
      extractCdataOrText(itemXml, "pubDate") ||
      extractCdataOrText(itemXml, "dc:date") ||
      extractCdataOrText(itemXml, "published") ||
      extractCdataOrText(itemXml, "updated");
    const publishedAt = parsePublishedDate(rawDate);

    const imageUrl = extractImage(itemXml);

    const hash = createHash("sha256")
      .update(`${feed.id}:${link}:${title}`)
      .digest("hex")
      .slice(0, 16);

    items.push({
      id: `${feed.id}-${hash}`,
      title: title.slice(0, 200),
      summary: summary || "Read the latest story on cinema and film releases.",
      url: link,
      imageUrl: imageUrl ?? null,
      publishedAt,
      source: feed.name,
      sourceId: feed.id,
      region: feed.region,
      language: feed.language,
    });
  }

  return items;
}

export async function fetchFeedArticles(feed, { fetchImpl = fetch, useCache = true } = {}) {
  const now = Date.now();
  if (useCache) {
    const cached = feedCache.get(feed.url);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.articles;
    }
  }

  try {
    const response = await fetchImpl(feed.url, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "CineTrack-CinemaPulse/1.0",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Feed request returned HTTP ${response.status}`);
    }

    const xml = await response.text();
    const articles = parseRssFeed(xml, feed);
    feedCache.set(feed.url, { timestamp: now, articles });
    return articles;
  } catch (error) {
    // If cache exists even if expired, return it rather than failing
    const existing = feedCache.get(feed.url);
    if (existing && existing.articles.length > 0) {
      return existing.articles;
    }
    return [];
  }
}

export async function getNewsArticles({
  region = "all",
  language = "all",
  limit = 20,
  fetchImpl = fetch,
  useCache = true,
  feeds = CINEMA_NEWS_FEEDS,
} = {}) {
  const normalizedRegion = SUPPORTED_REGIONS.includes(region) ? region : "all";
  const normalizedLanguage = SUPPORTED_LANGUAGES.includes(language)
    ? language
    : "all";
  const parsedLimit =
    Number.isInteger(limit) && limit >= 1 && limit <= 50 ? limit : 20;

  // Filter feeds by requested region and language
  const targetFeeds = feeds.filter((feed) => {
    const regionMatches =
      normalizedRegion === "all" || feed.region === normalizedRegion;
    const languageMatches =
      normalizedLanguage === "all" || feed.language === normalizedLanguage;
    return regionMatches && languageMatches;
  });

  const feedPromises = targetFeeds.map((feed) =>
    fetchFeedArticles(feed, { fetchImpl, useCache }),
  );

  const results = await Promise.allSettled(feedPromises);
  const allArticles = [];
  const seenUrls = new Set();
  const seenIds = new Set();

  for (const result of results) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      for (const article of result.value) {
        if (!seenUrls.has(article.url) && !seenIds.has(article.id)) {
          seenUrls.add(article.url);
          seenIds.add(article.id);
          allArticles.push(article);
        }
      }
    }
  }

  // If no articles fetched (e.g., offline or network error), use curated fallbacks
  if (allArticles.length === 0) {
    const matchingFallbacks = FALLBACK_ARTICLES.filter((article) => {
      const regionMatches =
        normalizedRegion === "all" || article.region === normalizedRegion;
      const languageMatches =
        normalizedLanguage === "all" || article.language === normalizedLanguage;
      return regionMatches && languageMatches;
    });
    for (const article of matchingFallbacks) {
      allArticles.push(article);
    }
  }

  // Sort descending by publishedAt
  allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const paginated = allArticles.slice(0, parsedLimit);

  return {
    articles: paginated,
    total: paginated.length,
    region: normalizedRegion,
    language: normalizedLanguage,
  };
}

