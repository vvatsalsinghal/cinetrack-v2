import { getMoviesByGenres, getMovieDetails } from "./tmdb.js";

const MAX_ACTIVITY_ENTRIES = 15;
const MAX_COMMON_GENRES = 3;
const MATCH_RECOMMENDATION_COUNT = 8;
const DISCOVERY_PAGE_LIMIT = 2;

export async function getMovieNightMatch(
  userEntries,
  friendEntries,
  {
    movieDetails = getMovieDetails,
    discoverMovies = getMoviesByGenres,
  } = {},
) {
  if (!Array.isArray(userEntries) || !Array.isArray(friendEntries)) {
    throw new TypeError("Movie collections must be arrays.");
  }

  // 1. Shared Watchlist (titles both users have saved/watching without finishing)
  const friendEntryMap = new Map(friendEntries.map((entry) => [entry.tmdbId, entry]));
  const sharedWatchlist = userEntries
    .filter((userEntry) => {
      const friendEntry = friendEntryMap.get(userEntry.tmdbId);
      if (!friendEntry) return false;
      return userEntry.status !== "finished" && friendEntry.status !== "finished";
    })
    .map((userEntry) => ({
      tmdbId: userEntry.tmdbId,
      title: userEntry.title,
      posterUrl: userEntry.posterUrl,
      releaseYear: userEntry.releaseYear,
      userStatus: userEntry.status,
      friendStatus: friendEntryMap.get(userEntry.tmdbId).status,
    }));

  // 2. Score genres for both users based on taste activity
  async function computeUserGenreScores(entries) {
    const activity = entries
      .filter((e) => e.status === "watching" || e.status === "finished" || (e.rating !== null && e.rating >= 4))
      .slice(0, MAX_ACTIVITY_ENTRIES);

    const scores = new Map();
    for (const entry of activity) {
      try {
        const details = await movieDetails(String(entry.tmdbId));
        const weight =
          (entry.status === "finished" ? 2 : entry.status === "watching" ? 1 : 0) +
          (entry.rating >= 4 ? entry.rating - 3 : 0);

        if (Array.isArray(details.genreIds) && Array.isArray(details.genres)) {
          details.genreIds.forEach((genreId, idx) => {
            const name = details.genres[idx];
            if (genreId && typeof name === "string" && name.trim()) {
              const prev = scores.get(genreId) ?? { id: genreId, name: name.trim(), score: 0 };
              prev.score += weight;
              scores.set(genreId, prev);
            }
          });
        }
      } catch {
        // Skip unresolvable details
      }
    }
    return scores;
  }

  const [userScores, friendScores] = await Promise.all([
    computeUserGenreScores(userEntries),
    computeUserGenreScores(friendEntries),
  ]);

  // Find common genres scored by both users
  const commonGenres = [];
  for (const [genreId, userItem] of userScores.entries()) {
    const friendItem = friendScores.get(genreId);
    if (friendItem) {
      const overlapScore =
        Math.min(userItem.score, friendItem.score) * 2 +
        (userItem.score + friendItem.score);
      commonGenres.push({
        id: genreId,
        name: userItem.name,
        score: overlapScore,
      });
    }
  }

  // If no directly overlapping genres, blend top genres from combined pool
  if (commonGenres.length === 0) {
    const combined = new Map();
    for (const [id, item] of [...userScores.entries(), ...friendScores.entries()]) {
      const prev = combined.get(id) ?? { id, name: item.name, score: 0 };
      prev.score += item.score;
      combined.set(id, prev);
    }
    commonGenres.push(...combined.values());
  }

  commonGenres.sort((a, b) => b.score - a.score);
  const selectedGenres = commonGenres.slice(0, MAX_COMMON_GENRES).map(({ id, name }) => ({ id, name }));

  // 3. Shared fresh recommendations (excluding anything already in either collection)
  const excludedIds = new Set([
    ...userEntries.map((e) => e.tmdbId),
    ...friendEntries.map((e) => e.tmdbId),
  ]);

  const recommendations = [];
  if (selectedGenres.length > 0) {
    for (let page = 1; page <= DISCOVERY_PAGE_LIMIT && recommendations.length < MATCH_RECOMMENDATION_COUNT; page++) {
      try {
        const result = await discoverMovies(selectedGenres.map((g) => g.id), page);
        for (const movie of result.movies || []) {
          if (!excludedIds.has(movie.tmdbId) && !recommendations.some((m) => m.tmdbId === movie.tmdbId)) {
            recommendations.push(movie);
            if (recommendations.length >= MATCH_RECOMMENDATION_COUNT) break;
          }
        }
      } catch {
        break;
      }
    }
  }

  return {
    sharedWatchlist,
    commonGenres: selectedGenres,
    recommendations,
  };
}

