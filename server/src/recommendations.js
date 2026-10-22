import { getMoviesByGenres, getMovieDetails } from "./tmdb.js";

const MAX_ACTIVITY_ENTRIES = 20;
const MAX_PREFERRED_GENRES = 3;
const RECOMMENDATION_COUNT = 12;
const DISCOVERY_PAGE_LIMIT = 3;

export async function getPersonalizedRecommendations(
  entries,
  {
    movieDetails = getMovieDetails,
    discoverMovies = getMoviesByGenres,
  } = {},
) {
  if (!Array.isArray(entries)) {
    throw new TypeError("My Cinema entries must be an array.");
  }
  if (typeof movieDetails !== "function" || typeof discoverMovies !== "function") {
    throw new TypeError("Recommendation metadata services must be functions.");
  }

  const activityEntries = entries
    .filter(
      (entry) =>
        entry.status === "watching" ||
        entry.status === "finished" ||
        entry.rating >= 4,
    )
    .slice(0, MAX_ACTIVITY_ENTRIES);

  if (activityEntries.length === 0) {
    return { activityCount: 0, basedOn: [], movies: [] };
  }

  const genreScores = new Map();
  let nextEntryIndex = 0;
  const workers = Array.from(
    { length: Math.min(4, activityEntries.length) },
    async () => {
      while (nextEntryIndex < activityEntries.length) {
        const entry = activityEntries[nextEntryIndex];
        nextEntryIndex += 1;
        const details = await movieDetails(String(entry.tmdbId));
        if (!Array.isArray(details.genreIds) || !Array.isArray(details.genres)) {
          throw new Error("TMDB returned incomplete genre data for a movie.");
        }

        const activityWeight =
          (entry.status === "finished" ? 2 : entry.status === "watching" ? 1 : 0) +
          (entry.rating >= 4 ? entry.rating - 3 : 0);
        const seenGenres = new Set();

        for (const [index, genreId] of details.genreIds.entries()) {
          const name = details.genres[index];
          if (
            !Number.isInteger(genreId) ||
            genreId < 1 ||
            typeof name !== "string" ||
            !name.trim()
          ) {
            throw new Error("TMDB returned invalid movie genre metadata.");
          }
          if (seenGenres.has(genreId)) {
            continue;
          }
          seenGenres.add(genreId);

          const current = genreScores.get(genreId) ?? {
            id: genreId,
            name: name.trim(),
            score: 0,
            appearances: 0,
          };
          current.score += activityWeight;
          current.appearances += 1;
          genreScores.set(genreId, current);
        }
      }
    },
  );
  await Promise.all(workers);

  const basedOn = [...genreScores.values()]
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.appearances - left.appearances ||
        left.name.localeCompare(right.name),
    )
    .slice(0, MAX_PREFERRED_GENRES)
    .map(({ id, name }) => ({ id, name }));

  if (basedOn.length === 0) {
    return { activityCount: activityEntries.length, basedOn, movies: [] };
  }

  const excludedIds = new Set(entries.map((entry) => entry.tmdbId));
  const recommendations = [];
  for (
    let page = 1;
    page <= DISCOVERY_PAGE_LIMIT &&
    recommendations.length < RECOMMENDATION_COUNT;
    page += 1
  ) {
    const result = await discoverMovies(
      basedOn.map((genre) => genre.id),
      page,
    );
    if (
      !Array.isArray(result?.movies) ||
      result.movies.length > 20
    ) {
      throw new Error("TMDB returned invalid personalized movie results.");
    }

    for (const movie of result.movies) {
      if (
        !Number.isInteger(movie.tmdbId) ||
        movie.tmdbId < 1 ||
        typeof movie.title !== "string" ||
        !movie.title.trim()
      ) {
        throw new Error("TMDB returned an invalid recommended movie.");
      }
      if (
        !excludedIds.has(movie.tmdbId) &&
        !recommendations.some((item) => item.tmdbId === movie.tmdbId)
      ) {
        recommendations.push(movie);
        if (recommendations.length === RECOMMENDATION_COUNT) {
          break;
        }
      }
    }

    if (result.movies.length === 0) {
      break;
    }
  }

  return {
    activityCount: activityEntries.length,
    basedOn,
    movies: recommendations,
  };
}
