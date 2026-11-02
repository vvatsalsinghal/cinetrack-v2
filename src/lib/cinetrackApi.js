import "server-only";
import {
  MAX_DISCOVERY_PAGE,
  normalizeDiscoveryMood,
  normalizeDiscoveryRuntime,
} from "@/lib/discoveryOptions";

const DEFAULT_API_URL = "http://localhost:4000";

// Custom error class to easily identify API errors and their HTTP status codes
export class CineTrackApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CineTrackApiError";
    this.status = status;
  }
}

/**
 * Validates that an ID is a non-empty numeric string.
 */
function validateMovieId(movieId) {
  if (!movieId || !/^[1-9]\d{0,9}$/.test(String(movieId).trim())) {
    throw new CineTrackApiError("Movie not found.", 404);
  }
}

/**
 * Gets the base URL for the backend API, ensuring valid protocol.
 */
function getApiUrl() {
  const urlString = process.env.CINETRACK_API_URL || DEFAULT_API_URL;
  try {
    const url = new URL(urlString);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new CineTrackApiError("API URL must use HTTP or HTTPS.", 500);
    }
    return url;
  } catch (error) {
    if (error instanceof CineTrackApiError) throw error;
    throw new CineTrackApiError("Invalid API URL configuration.", 500);
  }
}

/**
 * Core helper that performs HTTP requests to the CineTrack API server.
 */
async function fetchApiJson(
  path,
  { revalidate = 3600, headers = {}, cache } = {},
) {
  const apiUrl = getApiUrl();
  const fetchOptions = { headers };

  if (cache) {
    fetchOptions.cache = cache;
  } else {
    fetchOptions.next = { revalidate };
  }

  let response;
  try {
    response = await fetch(new URL(path, apiUrl.origin), fetchOptions);
  } catch {
    throw new CineTrackApiError(
      "Could not connect to the CineTrack API. Start it in a second terminal with npm run dev:api.",
      502,
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new CineTrackApiError(
      "The CineTrack API returned an unreadable response.",
      502,
    );
  }

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `The CineTrack API returned HTTP ${response.status}.`;
    throw new CineTrackApiError(message, response.status);
  }

  return payload;
}

/**
 * Fetches movie details (synopsis, runtime, genre, rating, trailer).
 */
export async function getApiMovieDetails(movieId) {
  validateMovieId(movieId);
  const payload = await fetchApiJson(`/api/movies/${movieId}`);
  if (!payload || typeof payload !== "object") {
    throw new CineTrackApiError(
      "The CineTrack API returned invalid movie details.",
      502,
    );
  }
  return payload;
}

/**
 * Fetches streaming availability (Netflix, Prime, Hotstar, etc.) for a movie.
 */
export async function getApiMovieWatchProviders(movieId) {
  validateMovieId(movieId);
  const payload = await fetchApiJson(`/api/movies/${movieId}/watch-providers`);
  if (!payload || typeof payload !== "object") {
    throw new CineTrackApiError(
      "The CineTrack API returned invalid streaming availability.",
      502,
    );
  }
  return payload;
}

/**
 * Fetches curated movie discovery pages filtered by mood and runtime.
 */
export async function getApiMovieDiscoveryPage({
  page,
  mood,
  maxRuntime,
}) {
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > MAX_DISCOVERY_PAGE ||
    normalizeDiscoveryMood(mood) !== mood ||
    normalizeDiscoveryRuntime(maxRuntime) !== maxRuntime
  ) {
    throw new CineTrackApiError(
      "Choose a valid discovery page, mood, and movie duration.",
      400,
    );
  }

  const query = new URLSearchParams({
    page: String(page),
    mood,
    runtime: maxRuntime,
  });

  const payload = await fetchApiJson(`/api/movies/discover?${query}`);
  if (!payload || !Array.isArray(payload.movies)) {
    throw new CineTrackApiError(
      "The CineTrack API returned invalid discovery results.",
      502,
    );
  }
  return payload;
}

const VALID_NEWS_REGIONS = ["all", "india", "global"];
const VALID_NEWS_LANGUAGES = ["all", "en", "hi", "ta", "te"];

/**
 * Fetches cinema news articles filtered by region and language.
 */
export async function getApiNewsArticles({
  region = "all",
  language = "all",
  limit = 24,
} = {}) {
  const normalizedRegion = VALID_NEWS_REGIONS.includes(region)
    ? region
    : "all";
  const normalizedLanguage = VALID_NEWS_LANGUAGES.includes(language)
    ? language
    : "all";
  const parsedLimit =
    Number.isInteger(limit) && limit >= 1 && limit <= 50 ? limit : 24;

  const query = new URLSearchParams({
    region: normalizedRegion,
    language: normalizedLanguage,
    limit: String(parsedLimit),
  });

  const payload = await fetchApiJson(`/api/news?${query}`, { revalidate: 300 });
  if (!payload || !Array.isArray(payload.articles)) {
    throw new CineTrackApiError(
      "The CineTrack API returned invalid cinema news.",
      502,
    );
  }
  return payload;
}

/**
 * Fetches a user's public cinema collection by their handle.
 */
export async function getApiPublicCinema(handle, { cookie } = {}) {
  if (typeof handle !== "string" || !/^[a-z0-9_]{3,30}$/i.test(handle.trim())) {
    throw new CineTrackApiError("Invalid cinema handle.", 400);
  }

  const options = cookie
    ? { headers: { Cookie: cookie }, cache: "no-store" }
    : { revalidate: 60 };

  return fetchApiJson(
    `/api/users/${encodeURIComponent(handle.trim().toLowerCase())}/cinema`,
    options,
  );
}
