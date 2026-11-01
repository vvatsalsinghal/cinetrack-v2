import discoveryOptions from "./discoveryOptions.json" with {
  type: "json",
};

const TMDB_API_URL = "https://api.themoviedb.org/3";
const MAX_SEARCH_LENGTH = 100;
const MAX_RESULTS = 12;
const MAX_TMDB_PAGE = 500;
const TMDB_PAGE_SIZE = 20;
const DISCOVERY_PAGE_SIZE = 12;
const DISCOVERY_MOODS = discoveryOptions.moods;
const DISCOVERY_RUNTIME_OPTIONS = discoveryOptions.runtimeOptions;
const MAX_DISCOVERY_PAGE = Math.ceil(
  (TMDB_PAGE_SIZE * MAX_TMDB_PAGE) / DISCOVERY_PAGE_SIZE,
);

function normalizeDiscoveryMood(value) {
  return typeof value === "string" && Object.hasOwn(DISCOVERY_MOODS, value)
    ? value
    : "";
}

function normalizeDiscoveryRuntime(value) {
  return DISCOVERY_RUNTIME_OPTIONS.some((option) => option.value === value)
    ? value
    : "";
}
const POSTER_PATH =
  /^\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;

export class TmdbApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "TmdbApiError";
    this.status = status;
  }
}

export async function searchMovies(
  query,
  {
    accessToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim(),
    fetchImpl = fetch,
  } = {},
) {
  if (
    typeof query !== "string" ||
    !query.trim() ||
    query.trim().length > MAX_SEARCH_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(query)
  ) {
    throw new TmdbApiError(
      "Enter a movie title of 100 characters or fewer.",
      400,
    );
  }

  if (!accessToken) {
    throw new TmdbApiError(
      "TMDB is not configured. Add TMDB_READ_ACCESS_TOKEN to the project .env.local file.",
      503,
    );
  }

  const url = new URL(`${TMDB_API_URL}/search/movie`);
  url.searchParams.set("query", query.trim());
  url.searchParams.set("language", "en-US");
  url.searchParams.set("page", "1");
  url.searchParams.set("include_adult", "false");

  let response;
  try {
    response = await fetchImpl(url, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    if (error instanceof TypeError || error instanceof DOMException) {
      throw new TmdbApiError(
        "Could not reach TMDB. Check your connection and try again.",
        502,
      );
    }

    throw error;
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new TmdbApiError(
        "TMDB rejected the server access token. Check TMDB_READ_ACCESS_TOKEN.",
        502,
      );
    }

    throw new TmdbApiError(
      `TMDB could not load search results (HTTP ${response.status}). Try again later.`,
      502,
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new TmdbApiError("TMDB returned an unreadable response.");
    }

    throw error;
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray(payload.results)
  ) {
    throw new TmdbApiError("TMDB returned an unexpected search response.");
  }

  return {
    results: payload.results.slice(0, MAX_RESULTS).map((movie) => {
      if (
        typeof movie !== "object" ||
        movie === null ||
        !Number.isInteger(movie.id) ||
        movie.id < 1 ||
        typeof movie.title !== "string" ||
        !movie.title.trim()
      ) {
        throw new TmdbApiError(
          "TMDB returned a movie with invalid required fields.",
        );
      }

      const releaseDate =
        typeof movie.release_date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(movie.release_date)
          ? movie.release_date
          : null;

      return {
        id: movie.id,
        title: movie.title.trim(),
        releaseYear: releaseDate ? releaseDate.slice(0, 4) : null,
        posterUrl:
          typeof movie.poster_path === "string" &&
          POSTER_PATH.test(movie.poster_path)
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : null,
      };
    }),
    page:
      Number.isInteger(payload.page) && payload.page > 0
        ? payload.page
        : 1,
    totalResults:
      Number.isInteger(payload.total_results) && payload.total_results >= 0
        ? payload.total_results
        : 0,
  };
}

export async function getPopularMovies(
  page = 1,
  {
    region = "",
    industry = "",
    accessToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim(),
    fetchImpl = fetch,
  } = {},
) {
  if (!Number.isInteger(page) || page < 1 || page > MAX_TMDB_PAGE) {
    throw new TmdbApiError("Choose a TMDB movie page between 1 and 500.", 400);
  }

  let endpoint = `/movie/popular?language=en-US&page=${page}`;
  if (industry === "indian" || industry === "IN") {
    endpoint = `/discover/movie?include_adult=false&language=en-US&page=${page}&sort_by=popularity.desc&with_origin_country=IN`;
  } else if (region) {
    endpoint = `/movie/popular?language=en-US&page=${page}&region=${encodeURIComponent(region)}`;
  }

  const payload = await getTmdbJson(
    endpoint,
    "popular movies",
    accessToken,
    fetchImpl,
  );

  if (!Array.isArray(payload.results)) {
    throw new TmdbApiError("TMDB returned an unexpected popular movies response.");
  }

  return {
    page:
      Number.isInteger(payload.page) && payload.page > 0
        ? payload.page
        : page,
    totalPages:
      Number.isInteger(payload.total_pages) && payload.total_pages > 0
        ? Math.min(payload.total_pages, MAX_TMDB_PAGE)
        : 1,
    totalResults:
      Number.isInteger(payload.total_results) && payload.total_results >= 0
        ? Math.min(payload.total_results, MAX_TMDB_PAGE * 20)
        : 0,
    results: parseMovieResults(payload.results),
  };
}

export async function getMovieDiscoveryPage(
  { page = 1, mood = "", maxRuntime = "" } = {},
  {
    accessToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim(),
    fetchImpl = fetch,
  } = {},
) {
  if (!Number.isInteger(page) || page < 1 || page > MAX_DISCOVERY_PAGE) {
    throw new TmdbApiError(
      `Choose a page between 1 and ${MAX_DISCOVERY_PAGE}.`,
      400,
    );
  }

  if (
    normalizeDiscoveryMood(mood) !== mood ||
    normalizeDiscoveryRuntime(maxRuntime) !== maxRuntime
  ) {
    throw new TmdbApiError("Choose a valid mood and movie duration.", 400);
  }

  const startIndex = (page - 1) * DISCOVERY_PAGE_SIZE;
  const tmdbPage = Math.floor(startIndex / TMDB_PAGE_SIZE) + 1;
  const offset = startIndex % TMDB_PAGE_SIZE;
  const getPage = (requestedPage) =>
    mood || maxRuntime
      ? getFilteredMovieTmdbPage(
          requestedPage,
          mood,
          maxRuntime,
          accessToken,
          fetchImpl,
        )
      : getPopularTmdbPage(requestedPage, accessToken, fetchImpl);
  const firstPayload = await getPage(tmdbPage);
  const tmdbTotalPages = Math.min(firstPayload.totalPages, MAX_TMDB_PAGE);
  const totalResults = Math.min(
    firstPayload.totalResults,
    tmdbTotalPages * TMDB_PAGE_SIZE,
  );
  const totalPages = Math.max(
    1,
    Math.ceil(totalResults / DISCOVERY_PAGE_SIZE),
  );
  const results = [...firstPayload.results];

  if (
    offset + DISCOVERY_PAGE_SIZE > results.length &&
    tmdbPage < tmdbTotalPages
  ) {
    const nextPayload = await getPage(tmdbPage + 1);
    results.push(...nextPayload.results);
  }

  let movies = parseDiscoveryMovies(
    results.slice(offset, offset + DISCOVERY_PAGE_SIZE),
  );

  if (maxRuntime) {
    const runtimeLimit = Number(maxRuntime);
    const moviesWithRuntime = [];

    for (let index = 0; index < movies.length; index += 3) {
      const batch = await Promise.all(
        movies.slice(index, index + 3).map(async (movie) => ({
          movie,
          runtime: await getMovieRuntime(
            movie.tmdbId,
            accessToken,
            fetchImpl,
          ),
        })),
      );
      moviesWithRuntime.push(...batch);
    }

    movies = moviesWithRuntime
      .filter(
        ({ runtime }) =>
          runtime !== null && runtime > 0 && runtime <= runtimeLimit,
      )
      .map(({ movie }) => movie);
  }

  return {
    movies,
    page,
    totalPages,
    totalResults,
  };
}

export async function getMoviesByGenres(
  genreIds,
  page = 1,
  {
    accessToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim(),
    fetchImpl = fetch,
  } = {},
) {
  if (
    !Array.isArray(genreIds) ||
    genreIds.length < 1 ||
    genreIds.length > 3 ||
    !genreIds.every((id) => Number.isInteger(id) && id > 0 && id <= 9999) ||
    new Set(genreIds).size !== genreIds.length ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > MAX_TMDB_PAGE
  ) {
    throw new TmdbApiError("Choose up to three valid movie genres and a valid page.", 400);
  }

  const query = new URLSearchParams({
    include_adult: "false",
    language: "en-US",
    page: String(page),
    sort_by: "popularity.desc",
    with_genres: genreIds.join("|"),
  });
  const payload = await getTmdbJson(
    `/discover/movie?${query.toString()}`,
    "personalized movie recommendations",
    accessToken,
    fetchImpl,
  );

  if (!Array.isArray(payload.results)) {
    throw new TmdbApiError(
      "TMDB returned an unexpected recommendation response.",
    );
  }

  return {
    page:
      Number.isInteger(payload.page) && payload.page > 0
        ? payload.page
        : page,
    movies: parseDiscoveryMovies(payload.results, TMDB_PAGE_SIZE),
  };
}

async function getMovieRuntime(movieId, accessToken, fetchImpl) {
  const payload = await getTmdbJson(
    `/movie/${movieId}?language=en-US`,
    "movie runtime",
    accessToken,
    fetchImpl,
  );

  if (
    payload.id !== movieId ||
    !Number.isInteger(payload.runtime) ||
    payload.runtime < 1
  ) {
    return null;
  }

  return payload.runtime;
}

async function getFilteredMovieTmdbPage(
  page,
  mood,
  maxRuntime,
  accessToken,
  fetchImpl,
) {
  const query = new URLSearchParams({
    include_adult: "false",
    language: "en-US",
    page: String(page),
    sort_by: "popularity.desc",
  });
  const moodConfig = mood ? DISCOVERY_MOODS[mood] : null;

  if (moodConfig) {
    query.set("with_genres", moodConfig.genres.join("|"));
  }

  if (maxRuntime) {
    query.set("with_runtime.lte", maxRuntime);
  }

  return getDiscoveryTmdbPage(
    `/discover/movie?${query.toString()}`,
    "filtered movies",
    page,
    accessToken,
    fetchImpl,
  );
}

async function getPopularTmdbPage(page, accessToken, fetchImpl) {
  return getDiscoveryTmdbPage(
    `/movie/popular?language=en-US&page=${page}`,
    "popular movies",
    page,
    accessToken,
    fetchImpl,
  );
}

async function getDiscoveryTmdbPage(
  path,
  description,
  requestedPage,
  accessToken,
  fetchImpl,
) {
  const payload = await getTmdbJson(
    path,
    description,
    accessToken,
    fetchImpl,
  );

  if (!Array.isArray(payload.results)) {
    throw new TmdbApiError(`TMDB returned an unexpected ${description} response.`);
  }

  return {
    results: payload.results,
    totalPages:
      Number.isInteger(payload.total_pages) && payload.total_pages >= 1
        ? payload.total_pages
        : 1,
    totalResults:
      Number.isInteger(payload.total_results) && payload.total_results >= 0
        ? payload.total_results
        : payload.results.length,
    page:
      Number.isInteger(payload.page) && payload.page > 0
        ? payload.page
        : requestedPage,
  };
}

export async function getMovieDetails(
  id,
  {
    accessToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim(),
    fetchImpl = fetch,
  } = {},
) {
  if (typeof id !== "string" || !/^[1-9]\d{0,9}$/.test(id)) {
    throw new TmdbApiError("Movie not found.", 404);
  }

  const payload = await getTmdbJson(
    `/movie/${id}?language=en-US&append_to_response=videos`,
    "movie details",
    accessToken,
    fetchImpl,
  );

  if (
    payload.id !== Number(id) ||
    typeof payload.title !== "string" ||
    !payload.title.trim()
  ) {
    throw new TmdbApiError("TMDB returned unexpected movie details.");
  }

  const releaseDate =
    typeof payload.release_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(payload.release_date)
      ? payload.release_date
      : null;
  const genres = Array.isArray(payload.genres)
    ? payload.genres
        .filter(
          (genre) =>
            typeof genre === "object" &&
            genre !== null &&
            Number.isInteger(genre.id) &&
            typeof genre.name === "string" &&
            genre.name.trim(),
        )
        .map((genre) => genre.name.trim())
    : [];
  const genreIds = Array.isArray(payload.genres)
    ? payload.genres
        .filter(
          (genre) =>
            typeof genre === "object" &&
            genre !== null &&
            Number.isInteger(genre.id) &&
            genre.id > 0 &&
            typeof genre.name === "string" &&
            genre.name.trim(),
        )
        .map((genre) => genre.id)
    : [];
  const trailers = Array.isArray(payload.videos?.results)
    ? payload.videos.results.filter(
        (video) =>
          typeof video === "object" &&
          video !== null &&
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
    runtime:
      Number.isInteger(payload.runtime) && payload.runtime > 0
        ? payload.runtime
        : null,
    genres,
    genreIds,
    voteAverage:
      typeof payload.vote_average === "number" &&
      Number.isFinite(payload.vote_average) &&
      payload.vote_average >= 0 &&
      payload.vote_average <= 10
        ? payload.vote_average
        : null,
    posterUrl:
      typeof payload.poster_path === "string" &&
      POSTER_PATH.test(payload.poster_path)
        ? `https://image.tmdb.org/t/p/w500${payload.poster_path}`
        : null,
    trailerKey: trailer?.key ?? null,
  };
}

export async function getMovieWatchProviders(
  id,
  {
    accessToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim(),
    fetchImpl = fetch,
  } = {},
) {
  if (typeof id !== "string" || !/^[1-9]\d{0,9}$/.test(id)) {
    throw new TmdbApiError("Movie not found.", 404);
  }

  const payload = await getTmdbJson(
    `/movie/${id}/watch/providers`,
    "India streaming availability",
    accessToken,
    fetchImpl,
  );

  if (typeof payload.results !== "object" || payload.results === null) {
    throw new TmdbApiError(
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
              typeof provider === "object" &&
              provider !== null &&
              Number.isInteger(provider.provider_id) &&
              typeof provider.provider_name === "string" &&
              provider.provider_name.trim(),
          )
          .map((provider) => ({
            id: provider.provider_id,
            name: provider.provider_name.trim(),
            logoUrl:
              typeof provider.logo_path === "string" &&
              POSTER_PATH.test(provider.logo_path)
                ? `https://image.tmdb.org/t/p/w92${provider.logo_path}`
                : null,
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

async function getTmdbJson(path, description, accessToken, fetchImpl) {
  if (!accessToken) {
    throw new TmdbApiError(
      "TMDB is not configured. Add TMDB_READ_ACCESS_TOKEN to the project .env.local file.",
      503,
    );
  }

  let response;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      response = await fetchImpl(`${TMDB_API_URL}${path}`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(10000),
      });
      break;
    } catch (error) {
      const causeCode =
        error instanceof TypeError &&
        typeof error.cause === "object" &&
        error.cause !== null &&
        typeof error.cause.code === "string"
          ? error.cause.code
          : null;

      if (causeCode === "ECONNRESET" && attempt < 2) {
        continue;
      }

      if (error instanceof TypeError || error instanceof DOMException) {
        throw new TmdbApiError(
          "Could not reach TMDB. Check your connection and try again.",
          502,
        );
      }

      throw error;
    }
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new TmdbApiError(
        "TMDB rejected the server access token. Check TMDB_READ_ACCESS_TOKEN.",
        502,
      );
    }

    throw new TmdbApiError(
      `TMDB could not load ${description} (HTTP ${response.status}). Try again later.`,
      response.status === 404 ? 404 : 502,
    );
  }

  try {
    const payload = await response.json();
    if (typeof payload !== "object" || payload === null) {
      throw new TmdbApiError(`TMDB returned an unexpected ${description} response.`);
    }
    return payload;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new TmdbApiError("TMDB returned an unreadable response.");
    }

    throw error;
  }
}

function parseMovieResults(results) {
  return results.slice(0, MAX_RESULTS).map((movie) => {
    if (
      typeof movie !== "object" ||
      movie === null ||
      !Number.isInteger(movie.id) ||
      movie.id < 1 ||
      typeof movie.title !== "string" ||
      !movie.title.trim()
    ) {
      throw new TmdbApiError(
        "TMDB returned a movie with invalid required fields.",
      );
    }

    const releaseDate =
      typeof movie.release_date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(movie.release_date)
        ? movie.release_date
        : null;

    return {
      id: movie.id,
      title: movie.title.trim(),
      releaseYear: releaseDate ? releaseDate.slice(0, 4) : null,
      posterUrl:
        typeof movie.poster_path === "string" &&
        POSTER_PATH.test(movie.poster_path)
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : null,
    };
  });
}

function parseDiscoveryMovies(results, limit = DISCOVERY_PAGE_SIZE) {
  const movies = [];
  const seenIds = new Set();

  for (const movie of results) {
    if (movies.length === limit) {
      break;
    }

    if (
      typeof movie !== "object" ||
      movie === null ||
      !Number.isInteger(movie.id) ||
      movie.id < 1 ||
      typeof movie.title !== "string" ||
      !movie.title.trim()
    ) {
      throw new TmdbApiError(
        "TMDB returned a movie with invalid required fields.",
      );
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
      posterUrl:
        typeof movie.poster_path === "string" &&
        POSTER_PATH.test(movie.poster_path)
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : null,
      releaseYear: releaseDate ? releaseDate.slice(0, 4) : null,
    });
    seenIds.add(movie.id);
  }

  return movies;
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
