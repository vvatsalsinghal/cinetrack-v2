import "server-only";

const TMDB_API_URL = "https://api.themoviedb.org/3";
const MAX_SEARCH_LENGTH = 100;

export class TmdbError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "TmdbError";
    this.status = status;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getMovieDetails(id) {
  if (typeof id !== "string" || !/^[1-9]\d{0,9}$/.test(id)) {
    throw new TmdbError("Movie not found.", 404);
  }

  const payload = await getTmdbPayload(
    `/movie/${id}?language=en-US&append_to_response=videos`,
    "movie details",
  );

  if (
    !isRecord(payload) ||
    payload.id !== Number(id) ||
    typeof payload.title !== "string" ||
    !payload.title.trim()
  ) {
    throw new TmdbError("TMDB returned unexpected movie details.");
  }

  const releaseDate =
    typeof payload.release_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(payload.release_date)
      ? payload.release_date
      : null;
  const runtime =
    Number.isInteger(payload.runtime) && payload.runtime > 0
      ? payload.runtime
      : null;
  const genres = Array.isArray(payload.genres)
    ? payload.genres
        .filter(
          (genre) =>
            isRecord(genre) &&
            Number.isInteger(genre.id) &&
            typeof genre.name === "string" &&
            genre.name.trim(),
        )
        .map((genre) => genre.name.trim())
    : [];
  const trailers = Array.isArray(payload.videos?.results)
    ? payload.videos.results.filter(
        (video) =>
          isRecord(video) &&
          video.site === "YouTube" &&
          video.type === "Trailer" &&
          video.official === true &&
          typeof video.key === "string" &&
          /^[A-Za-z0-9_-]{11}$/.test(video.key),
      )
    : [];
  const trailer = trailers[0] ?? null;

  return {
    id: payload.id,
    title: payload.title.trim(),
    overview:
      typeof payload.overview === "string" ? payload.overview.trim() : "",
    releaseDate,
    runtime,
    genres,
    voteAverage:
      typeof payload.vote_average === "number" &&
      Number.isFinite(payload.vote_average) &&
      payload.vote_average >= 0 &&
      payload.vote_average <= 10
        ? payload.vote_average
        : null,
    posterUrl: getImageUrl(payload.poster_path, "w500"),
    trailerKey: trailer?.key ?? null,
  };
}

export async function getMovieWatchProviders(id) {
  if (typeof id !== "string" || !/^[1-9]\d{0,9}$/.test(id)) {
    throw new TmdbError("Movie not found.", 404);
  }

  const payload = await getTmdbPayload(
    `/movie/${id}/watch/providers`,
    "India streaming availability",
  );

  if (!isRecord(payload) || !isRecord(payload.results)) {
    throw new TmdbError(
      "TMDB returned unexpected streaming availability data.",
    );
  }

  const region = payload.results.IN;
  const categories = ["flatrate", "free", "ads", "rent", "buy"];
  const providersByCategory = {};

  for (const category of categories) {
    const providers = Array.isArray(region?.[category])
      ? region[category]
          .filter(
            (provider) =>
              isRecord(provider) &&
              Number.isInteger(provider.provider_id) &&
              typeof provider.provider_name === "string" &&
              provider.provider_name.trim(),
          )
          .map((provider) => ({
            id: provider.provider_id,
            name: provider.provider_name.trim(),
            logoUrl: getImageUrl(provider.logo_path, "w92"),
          }))
      : [];

    if (providers.length > 0) {
      providersByCategory[category] = providers;
    }
  }

  return {
    region: "IN",
    link: getTrustedAvailabilityUrl(region?.link),
    providersByCategory,
  };
}

export async function searchMovies(query) {
  if (typeof query !== "string") {
    throw new TmdbError("Enter a movie title to search.");
  }

  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  if (
    normalizedQuery.length > MAX_SEARCH_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(normalizedQuery)
  ) {
    throw new TmdbError("Search must be 100 characters or fewer.");
  }

  return getMovies(
    `/search/movie?query=${encodeURIComponent(normalizedQuery)}&language=en-US&page=1&include_adult=false`,
    "search results",
  );
}

async function getMovies(path, resultDescription) {
  const payload = await getTmdbPayload(path, resultDescription);

  if (!Array.isArray(payload.results)) {
    throw new TmdbError(
      `TMDB returned an unexpected ${resultDescription} response.`,
    );
  }

  return parseMovieResults(payload.results);
}

function parseMovieResults(results) {
  const movies = [];
  const seenIds = new Set();

  for (const movie of results) {
    if (movies.length === DISCOVERY_PAGE_SIZE) {
      break;
    }

    if (
      !isRecord(movie) ||
      !Number.isInteger(movie.id) ||
      movie.id < 1 ||
      typeof movie.title !== "string" ||
      movie.title.trim().length === 0
    ) {
      throw new TmdbError("TMDB returned a movie with invalid required fields.");
    }

    if (seenIds.has(movie.id)) {
      continue;
    }

    const releaseDate =
      typeof movie.release_date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(movie.release_date)
        ? movie.release_date
        : null;

    movies.push({
      id: `tmdb-${movie.id}`,
      tmdbId: movie.id,
      title: movie.title.trim(),
      format: "Film",
      source: "tmdb",
      posterUrl: getImageUrl(movie.poster_path, "w500"),
      releaseYear: releaseDate ? releaseDate.slice(0, 4) : null,
    });
    seenIds.add(movie.id);
  }

  return movies;
}

async function getTmdbPayload(path, resultDescription) {
  const accessToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    throw new TmdbError(
      "TMDB is not configured. Add TMDB_READ_ACCESS_TOKEN to .env.local and restart the server.",
    );
  }

  let response;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      response = await fetch(
        `${TMDB_API_URL}${path}`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          next: { revalidate: 3600 },
        },
      );
      break;
    } catch (error) {
      if (!(error instanceof TypeError)) {
        throw error;
      }

      const causeCode =
        isRecord(error.cause) && typeof error.cause.code === "string"
          ? error.cause.code
          : "unknown";

      if (causeCode === "ECONNRESET" && attempt < 2) {
        continue;
      }

      console.error(`TMDB request failed with network error ${causeCode}.`);
      throw new TmdbError(
        "Could not reach TMDB. Check your connection and try again.",
      );
    }
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new TmdbError(
        "TMDB rejected the access token. Check TMDB_READ_ACCESS_TOKEN in .env.local.",
      );
    }

    throw new TmdbError(
      `TMDB could not load ${resultDescription} (HTTP ${response.status}). Try again later.`,
      response.status,
    );
  }

  let payload;

  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new TmdbError("TMDB returned an unreadable response.");
    }

    throw error;
  }

  if (!isRecord(payload)) {
    throw new TmdbError(`TMDB returned an unexpected ${resultDescription} response.`);
  }

  return payload;
}

function getImageUrl(path, size) {
  if (
    typeof path !== "string" ||
    !/^\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(path)
  ) {
    return null;
  }

  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function getTrustedAvailabilityUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      ["justwatch.com", "themoviedb.org"].some(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      )
    ) {
      return url.toString();
    }
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error;
    }
  }

  return null;
}
