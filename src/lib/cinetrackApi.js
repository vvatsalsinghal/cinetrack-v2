import "server-only";
import {
  MAX_DISCOVERY_PAGE,
  normalizeDiscoveryMood,
  normalizeDiscoveryRuntime,
} from "@/lib/discoveryOptions";

const DEFAULT_API_URL = "http://localhost:4000";
const TMDB_IMAGE_URL =
  /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;

export class CineTrackApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CineTrackApiError";
    this.status = status;
  }
}

export async function getApiMovieDetails(movieId) {
  validateMovieId(movieId);
  const payload = await fetchApiJson(`/api/movies/${movieId}`);
  if (!isMovieDetails(payload, Number(movieId))) {
    throw new CineTrackApiError(
      "The CineTrack API returned invalid movie details.",
      502,
    );
  }

  return payload;
}

export async function getApiMovieWatchProviders(movieId) {
  validateMovieId(movieId);
  const payload = await fetchApiJson(
    `/api/movies/${movieId}/watch-providers`,
  );

  if (!isMovieWatchProviders(payload)) {
    throw new CineTrackApiError(
      "The CineTrack API returned invalid streaming availability.",
      502,
    );
  }

  return payload;
}

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

  if (!isMovieDiscoveryPage(payload, page)) {
    throw new CineTrackApiError(
      "The CineTrack API returned invalid discovery results.",
      502,
    );
  }

  return payload;
}

const VALID_NEWS_REGIONS = ["all", "india", "global"];
const VALID_NEWS_LANGUAGES = ["all", "en", "hi", "ta", "te"];

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

  if (!isNewsPayload(payload)) {
    throw new CineTrackApiError(
      "The CineTrack API returned invalid cinema news.",
      502,
    );
  }

  return payload;
}

export async function getApiPublicCinema(handle, { cookie } = {}) {
  if (typeof handle !== "string" || !/^[a-z0-9_]{3,30}$/i.test(handle.trim())) {
    throw new CineTrackApiError("Invalid cinema handle.", 400);
  }

  const options = cookie
    ? { headers: { Cookie: cookie }, cache: "no-store" }
    : { revalidate: 60 };

  const payload = await fetchApiJson(
    `/api/users/${encodeURIComponent(handle.trim().toLowerCase())}/cinema`,
    options,
  );

  return payload;
}

async function fetchApiJson(
  path,
  { revalidate = 3600, headers = {}, cache } = {},
) {
  const apiUrl = getApiUrl();
  let response;

  const fetchOptions = {
    headers,
  };
  if (cache) {
    fetchOptions.cache = cache;
  } else {
    fetchOptions.next = { revalidate };
  }

  try {
    response = await fetch(new URL(path, apiUrl.origin), fetchOptions);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new CineTrackApiError(
        "Could not connect to the CineTrack API. Start it in a second terminal with npm run dev:api.",
        502,
      );
    }

    throw error;
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new CineTrackApiError(
        "The CineTrack API returned an unreadable response.",
        502,
      );
    }

    throw error;
  }

  if (!response.ok) {
    throw new CineTrackApiError(
      typeof payload?.error === "string"
        ? payload.error
        : `The CineTrack API returned HTTP ${response.status}.`,
      response.status,
    );
  }

  return payload;
}

function getApiUrl() {
  let apiUrl;
  try {
    apiUrl = new URL(process.env.CINETRACK_API_URL ?? DEFAULT_API_URL);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new CineTrackApiError("The Express API URL is not valid.", 500);
    }

    throw error;
  }

  if (apiUrl.protocol !== "http:" && apiUrl.protocol !== "https:") {
    throw new CineTrackApiError(
      "The Express API URL must use HTTP or HTTPS.",
      500,
    );
  }

  return apiUrl;
}

function validateMovieId(movieId) {
  if (typeof movieId !== "string" || !/^[1-9]\d{0,9}$/.test(movieId)) {
    throw new CineTrackApiError("Movie not found.", 404);
  }
}

function isMovieDetails(movie, expectedId) {
  return (
    typeof movie === "object" &&
    movie !== null &&
    movie.id === expectedId &&
    typeof movie.title === "string" &&
    movie.title.trim().length > 0 &&
    typeof movie.overview === "string" &&
    (movie.releaseDate === null ||
      (typeof movie.releaseDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(movie.releaseDate))) &&
    (movie.runtime === null ||
      (Number.isInteger(movie.runtime) && movie.runtime > 0)) &&
    Array.isArray(movie.genres) &&
    movie.genres.every((genre) => typeof genre === "string") &&
    (movie.voteAverage === null ||
      (typeof movie.voteAverage === "number" &&
        Number.isFinite(movie.voteAverage) &&
        movie.voteAverage >= 0 &&
        movie.voteAverage <= 10)) &&
    (movie.posterUrl === null ||
      (typeof movie.posterUrl === "string" &&
        TMDB_IMAGE_URL.test(movie.posterUrl))) &&
    (movie.trailerKey === null ||
      (typeof movie.trailerKey === "string" &&
        /^[A-Za-z0-9_-]{11}$/.test(movie.trailerKey)))
  );
}

function isMovieWatchProviders(availability) {
  if (
    typeof availability !== "object" ||
    availability === null ||
    availability.region !== "IN" ||
    typeof availability.providersByCategory !== "object" ||
    availability.providersByCategory === null
  ) {
    return false;
  }

  const categories = ["flatrate", "free", "ads", "rent", "buy"];
  const entries = Object.entries(availability.providersByCategory);

  return (
    entries.every(
      ([category, providers]) =>
        categories.includes(category) &&
        Array.isArray(providers) &&
        providers.every(
          (provider) =>
            typeof provider === "object" &&
            provider !== null &&
            Number.isInteger(provider.id) &&
            typeof provider.name === "string" &&
            provider.name.trim().length > 0 &&
            (provider.logoUrl === null ||
              (typeof provider.logoUrl === "string" &&
                /^https:\/\/image\.tmdb\.org\/t\/p\/w92\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(
                  provider.logoUrl,
                ))),
        ),
    ) &&
    (availability.link === null ||
      (typeof availability.link === "string" && isTrustedProviderLink(availability.link)))
  );
}

function isMovieDiscoveryPage(result, expectedPage) {
  return (
    typeof result === "object" &&
    result !== null &&
    result.page === expectedPage &&
    Number.isInteger(result.totalPages) &&
    result.totalPages >= 1 &&
    Number.isInteger(result.totalResults) &&
    result.totalResults >= 0 &&
    Array.isArray(result.movies) &&
    result.movies.length <= 12 &&
    result.movies.every(
      (movie) =>
        typeof movie === "object" &&
        movie !== null &&
        Number.isInteger(movie.tmdbId) &&
        movie.tmdbId > 0 &&
        movie.id === `tmdb-${movie.tmdbId}` &&
        typeof movie.title === "string" &&
        movie.title.trim().length > 0 &&
        movie.format === "Film" &&
        movie.source === "tmdb" &&
        (movie.posterUrl === null ||
          (typeof movie.posterUrl === "string" &&
            TMDB_IMAGE_URL.test(movie.posterUrl))) &&
        (movie.releaseYear === null ||
          (typeof movie.releaseYear === "string" &&
            /^\d{4}$/.test(movie.releaseYear))),
    )
  );
}

function isTrustedProviderLink(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["justwatch.com", "themoviedb.org"].some(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      )
    );
  } catch (error) {
    if (error instanceof TypeError) {
      return false;
    }

    throw error;
  }
}

function isNewsPayload(payload) {
  return (
    typeof payload === "object" &&
    payload !== null &&
    Array.isArray(payload.articles) &&
    typeof payload.total === "number" &&
    typeof payload.region === "string" &&
    typeof payload.language === "string" &&
    payload.articles.every(
      (article) =>
        typeof article === "object" &&
        article !== null &&
        typeof article.id === "string" &&
        typeof article.title === "string" &&
        typeof article.summary === "string" &&
        typeof article.url === "string" &&
        (article.imageUrl === null || typeof article.imageUrl === "string") &&
        typeof article.publishedAt === "string" &&
        typeof article.source === "string" &&
        typeof article.region === "string" &&
        typeof article.language === "string",
    )
  );
}
