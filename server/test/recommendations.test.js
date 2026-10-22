import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPersonalizedRecommendations } from "../src/recommendations.js";

describe("activity-based recommendations", () => {
  it("weights real movie genres by activity and ratings, excludes collection movies, and avoids duplicate results", async () => {
    const entries = [
      { tmdbId: 1, status: "finished", rating: 5 },
      { tmdbId: 2, status: "watching", rating: null },
      { tmdbId: 3, status: "saved", rating: null },
      { tmdbId: 4, status: "saved", rating: 4 },
    ];
    const requestedIds = [];
    let genresUsed;
    const result = await getPersonalizedRecommendations(entries, {
      movieDetails: async (id) => {
        requestedIds.push(Number(id));
        const genres = {
          1: { genreIds: [18, 878], genres: ["Drama", "Science Fiction"] },
          2: { genreIds: [878, 28], genres: ["Science Fiction", "Action"] },
          4: { genreIds: [18, 28], genres: ["Drama", "Action"] },
        };
        return { id: Number(id), ...genres[id] };
      },
      discoverMovies: async (genreIds, page) => {
        genresUsed = genreIds;
        if (page > 1) {
          return { page, movies: [] };
        }
        return {
          page,
          movies: [
            { tmdbId: 1, title: "Already finished" },
            { tmdbId: 4, title: "Already rated" },
            { tmdbId: 20, title: "A new recommendation" },
            { tmdbId: 20, title: "Duplicate recommendation" },
            { tmdbId: 21, title: "Another recommendation" },
          ],
        };
      },
    });

    assert.deepEqual(requestedIds.sort(), [1, 2, 4]);
    assert.deepEqual(genresUsed, [18, 878, 28]);
    assert.equal(result.activityCount, 3);
    assert.deepEqual(result.basedOn, [
      { id: 18, name: "Drama" },
      { id: 878, name: "Science Fiction" },
      { id: 28, name: "Action" },
    ]);
    assert.deepEqual(
      result.movies.map((movie) => movie.tmdbId),
      [20, 21],
    );
  });

  it("returns an explainable empty result without TMDB calls when the user has no taste signals", async () => {
    let requestMade = false;
    const result = await getPersonalizedRecommendations(
      [{ tmdbId: 7, status: "saved", rating: null }],
      {
        movieDetails: async () => {
          requestMade = true;
        },
        discoverMovies: async () => {
          requestMade = true;
        },
      },
    );

    assert.deepEqual(result, { activityCount: 0, basedOn: [], movies: [] });
    assert.equal(requestMade, false);
  });
});
