import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { CinemaEntry } from "../src/models/CinemaEntry.js";
import { User } from "../src/models/User.js";
import {
  getMovieDetails,
  getMovieDiscoveryPage,
  getMoviesByGenres,
  getMovieWatchProviders,
  getPopularMovies,
  searchMovies,
  TmdbApiError,
} from "../src/tmdb.js";

describe("MongoDB model schemas", () => {
  it("normalizes and validates account emails without selecting password hashes", async () => {
    const user = new User({
      email: "  NEERAJ@EXAMPLE.COM ",
      passwordHash: "hashed-password-placeholder",
    });

    await user.validate();

    assert.equal(user.email, "neeraj@example.com");
    assert.equal(User.schema.path("passwordHash").options.select, false);
  });

  it("rejects invalid email addresses", async () => {
    const user = new User({
      email: "not-an-email",
      passwordHash: "hashed-password-placeholder",
    });

    await assert.rejects(
      user.validate(),
      (error) => error.name === "ValidationError" && Boolean(error.errors.email),
    );
  });

  it("validates unified My Cinema entries and enforces one entry per movie per user", async () => {
    const entry = new CinemaEntry({
      userId: new mongoose.Types.ObjectId(),
      tmdbId: 329865,
      title: " Arrival ",
      posterUrl: "https://image.tmdb.org/t/p/w500/arrival.jpg",
      releaseYear: "2016",
      rating: 5,
      review: "A thoughtful science-fiction film.",
    });

    await entry.validate();

    assert.equal(entry.title, "Arrival");
    assert.equal(entry.status, "saved");
    assert.ok(
      CinemaEntry.schema.indexes().some(
        ([keys, options]) =>
          keys.userId === 1 && keys.tmdbId === 1 && options.unique === true,
      ),
    );
  });

  it("rejects invalid movie status, ratings, and oversized notes", async () => {
    const entry = new CinemaEntry({
      userId: new mongoose.Types.ObjectId(),
      tmdbId: 329865,
      title: "Arrival",
      status: "favorite",
      rating: 6,
      review: "x".repeat(501),
    });

    await assert.rejects(
      entry.validate(),
      (error) =>
        error.name === "ValidationError" &&
        Boolean(error.errors.status) &&
        Boolean(error.errors.rating) &&
        Boolean(error.errors.review),
    );
  });
});

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

describe("CineTrack API", () => {
  let baseUrl;
  let server;

  before(async () => {
    server = createApp().listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server?.listening) {
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
  });

  it("returns the API health status", async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      service: "cinetrack-api",
    });
    assert.equal(response.headers.get("x-powered-by"), null);
  });

  it("returns a JSON not-found response for unknown API routes", async () => {
    const response = await fetch(`${baseUrl}/api/not-a-route`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "API route not found.",
    });
  });

  it("validates search query parameters", async () => {
    for (const url of [
      `${baseUrl}/api/movies/search`,
      `${baseUrl}/api/movies/search?q=Arrival&q=Alien`,
    ]) {
      const response = await fetch(url);

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        error: "Provide a movie title in the q query parameter.",
      });
    }
  });

  it("returns movie search results through the API", async () => {
    const movieSearch = async (query) => {
      assert.equal(query, "Arrival");
      return {
        page: 1,
        totalResults: 1,
        results: [
          {
            id: 329865,
            title: "Arrival",
            releaseYear: "2016",
            posterUrl: null,
          },
        ],
      };
    };

    await withServer(createApp({ movieSearch }), async (url) => {
      const response = await fetch(`${url}/api/movies/search?q=%20Arrival%20`);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        page: 1,
        totalResults: 1,
        results: [
          {
            id: 329865,
            title: "Arrival",
            releaseYear: "2016",
            posterUrl: null,
          },
        ],
      });
    });
  });

  it("validates popular movie page parameters", async () => {
    for (const query of ["page=0", "page=501", "page=nope", "page=1&page=2"]) {
      const response = await fetch(`${baseUrl}/api/movies/popular?${query}`);

      assert.equal(response.status, 400, query);
      assert.deepEqual(await response.json(), {
        error: "Provide a page number between 1 and 500.",
      });
    }
  });

  it("returns popular movies through the API", async () => {
    await withServer(
      createApp({
        popularMovies: async (page) => ({
          page,
          totalPages: 20,
          totalResults: 400,
          results: [
            {
              id: 550,
              title: "Fight Club",
              releaseYear: "1999",
              posterUrl: null,
            },
          ],
        }),
      }),
      async (url) => {
        const response = await fetch(`${url}/api/movies/popular?page=2`);

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
          page: 2,
          totalPages: 20,
          totalResults: 400,
          results: [
            {
              id: 550,
              title: "Fight Club",
              releaseYear: "1999",
              posterUrl: null,
            },
          ],
        });
      },
    );
  });

  it("returns filtered discovery results through the API", async () => {
    const expectedResult = {
      movies: [],
      page: 2,
      totalPages: 834,
      totalResults: 10000,
    };

    await withServer(
      createApp({
        movieDiscovery: async (options) => {
          assert.deepEqual(options, {
            page: 2,
            mood: "thrilling",
            maxRuntime: "120",
          });
          return expectedResult;
        },
      }),
      async (url) => {
        const response = await fetch(
          `${url}/api/movies/discover?page=2&mood=thrilling&runtime=120`,
        );

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), expectedResult);
      },
    );
  });

  it("rejects invalid movie discovery parameters", async () => {
    for (const query of [
      "page=0",
      "page=835",
      "mood=unknown",
      "runtime=100",
      "mood=feel-good&mood=thrilling",
    ]) {
      const response = await fetch(
        `${baseUrl}/api/movies/discover?${query}`,
      );

      assert.equal(response.status, 400, query);
    }
  });

  it("returns movie details through the API", async () => {
    const expectedMovie = {
      id: 329865,
      title: "Arrival",
      overview: "A linguist works with an alien language.",
      releaseDate: "2016-11-11",
      runtime: 116,
      genres: ["Drama", "Science Fiction"],
      genreIds: [18, 878],
      voteAverage: 7.6,
      posterUrl: "https://image.tmdb.org/t/p/w500/arrival.jpg",
      trailerKey: "abcdefghijk",
    };

    await withServer(
      createApp({
        movieDetails: async (id) => {
          assert.equal(id, "329865");
          return expectedMovie;
        },
      }),
      async (url) => {
        const response = await fetch(`${url}/api/movies/329865`);

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), expectedMovie);
      },
    );
  });

  it("returns India streaming providers through the API", async () => {
    const expectedAvailability = {
      region: "IN",
      link: "https://www.themoviedb.org/movie/329865/watch?locale=IN",
      providersByCategory: {
        flatrate: [
          {
            id: 123,
            name: "Example Stream",
            logoUrl: "https://image.tmdb.org/t/p/w92/provider.jpg",
          },
        ],
      },
    };

    await withServer(
      createApp({
        movieWatchProviders: async (id) => {
          assert.equal(id, "329865");
          return expectedAvailability;
        },
      }),
      async (url) => {
        const response = await fetch(
          `${url}/api/movies/329865/watch-providers`,
        );

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), expectedAvailability);
      },
    );
  });

  it("returns not found for invalid movie IDs", async () => {
    const response = await fetch(`${baseUrl}/api/movies/not-a-movie`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "Movie not found.",
    });
  });

  it("preserves TMDB's not-found status for a valid but unknown movie ID", async () => {
    await withServer(
      createApp({
        movieDetails: async () => {
          throw new TmdbApiError("Movie not found.", 404);
        },
      }),
      async (url) => {
        const response = await fetch(`${url}/api/movies/329865`);

        assert.equal(response.status, 404);
        assert.deepEqual(await response.json(), {
          error: "Movie not found.",
        });
      },
    );
  });

  it("allows the local CineTrack website to read API responses", async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "http://localhost:3000" },
    });

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://localhost:3000",
    );
    assert.equal(response.headers.get("vary"), "Origin");
  });

  it("answers browser preflight requests", async () => {
    const response = await fetch(`${baseUrl}/api/movies/search`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "GET",
      },
    });

    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get("access-control-allow-methods"),
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
  });

  it("rejects browser requests from unapproved origins", async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "https://unapproved.example" },
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: "This website is not allowed to access the CineTrack API.",
    });
  });
});

describe("TMDB search service", () => {
  it("keeps the access token in the server request and returns validated results", async () => {
    let requestedUrl;
    let authorization;
    const result = await searchMovies("  Arrival  ", {
      accessToken: "test-token",
      fetchImpl: async (url, options) => {
        requestedUrl = String(url);
        authorization = options.headers.Authorization;
        return Response.json({
          page: 1,
          total_results: 1,
          results: [
            {
              id: 329865,
              title: " Arrival ",
              release_date: "2016-11-11",
              poster_path: "/abc123.jpg",
            },
          ],
        });
      },
    });

    assert.equal(new URL(requestedUrl).searchParams.get("query"), "Arrival");
    assert.equal(authorization, "Bearer test-token");
    assert.equal(JSON.stringify(result).includes("test-token"), false);
    assert.deepEqual(result, {
      page: 1,
      totalResults: 1,
      results: [
        {
          id: 329865,
          title: "Arrival",
          releaseYear: "2016",
          posterUrl: "https://image.tmdb.org/t/p/w500/abc123.jpg",
        },
      ],
    });
  });

  it("rejects invalid search input before calling TMDB", async () => {
    let requestMade = false;

    await assert.rejects(
      searchMovies("  ", {
        accessToken: "test-token",
        fetchImpl: async () => {
          requestMade = true;
        },
      }),
      (error) => error instanceof TmdbApiError && error.status === 400,
    );
    assert.equal(requestMade, false);
  });

  it("reports missing TMDB configuration without making a request", async () => {
    await assert.rejects(
      searchMovies("Arrival", {
        accessToken: "",
        fetchImpl: async () => {
          throw new Error("TMDB should not be called.");
        },
      }),
      (error) => error instanceof TmdbApiError && error.status === 503,
    );
  });
});

describe("TMDB popular movies service", () => {
  it("validates the page, sends the server token, and normalizes movies", async () => {
    let requestedUrl;
    let authorization;
    const result = await getPopularMovies(3, {
      accessToken: "test-token",
      fetchImpl: async (url, options) => {
        requestedUrl = String(url);
        authorization = options.headers.Authorization;
        return Response.json({
          page: 3,
          total_pages: 1200,
          total_results: 24000,
          results: [
            {
              id: 550,
              title: " Fight Club ",
              release_date: "1999-10-15",
              poster_path: "/fight-club.jpg",
            },
          ],
        });
      },
    });

    assert.match(requestedUrl, /\/movie\/popular\?language=en-US&page=3$/);
    assert.equal(authorization, "Bearer test-token");
    assert.deepEqual(result, {
      page: 3,
      totalPages: 500,
      totalResults: 10000,
      results: [
        {
          id: 550,
          title: "Fight Club",
          releaseYear: "1999",
          posterUrl: "https://image.tmdb.org/t/p/w500/fight-club.jpg",
        },
      ],
    });
  });

  it("rejects an out-of-range page before calling TMDB", async () => {
    let requestMade = false;

    await assert.rejects(
      getPopularMovies(501, {
        accessToken: "test-token",
        fetchImpl: async () => {
          requestMade = true;
        },
      }),
      (error) => error instanceof TmdbApiError && error.status === 400,
    );
    assert.equal(requestMade, false);
  });
});

describe("TMDB movie discovery service", () => {
  it("joins TMDB pages into 12-movie pages without losing boundary results", async () => {
    const requestedUrls = [];
    const result = await getMovieDiscoveryPage(
      { page: 2 },
      {
        accessToken: "test-token",
        fetchImpl: async (url) => {
          requestedUrls.push(String(url));
          const page = Number(new URL(url).searchParams.get("page"));
          const start = page === 1 ? 1 : 21;
          return Response.json({
            page,
            total_pages: 500,
            total_results: 10000,
            results: Array.from({ length: 20 }, (_, index) => ({
              id: start + index,
              title: `Movie ${start + index}`,
              release_date: "2020-01-01",
              poster_path: `/poster-${start + index}.jpg`,
            })),
          });
        },
      },
    );

    assert.equal(requestedUrls.length, 2);
    assert.ok(requestedUrls.some((url) => url.endsWith("page=1")));
    assert.ok(requestedUrls.some((url) => url.endsWith("page=2")));
    assert.equal(result.page, 2);
    assert.equal(result.totalPages, 834);
    assert.equal(result.totalResults, 10000);
    assert.equal(result.movies.length, 12);
    assert.deepEqual(
      result.movies.map((movie) => movie.tmdbId),
      Array.from({ length: 12 }, (_, index) => index + 13),
    );
  });

  it("applies mood filters and verifies the selected runtime against details", async () => {
    const requestedUrls = [];
    const result = await getMovieDiscoveryPage(
      { page: 1, mood: "feel-good", maxRuntime: "90" },
      {
        accessToken: "test-token",
        fetchImpl: async (url) => {
          const parsedUrl = new URL(url);
          requestedUrls.push(parsedUrl);

          if (parsedUrl.pathname === "/3/discover/movie") {
            return Response.json({
              page: 1,
              total_pages: 1,
              total_results: 3,
              results: [1, 2, 3].map((id) => ({
                id,
                title: `Movie ${id}`,
                release_date: "2020-01-01",
                poster_path: `/poster-${id}.jpg`,
              })),
            });
          }

          const id = Number(parsedUrl.pathname.split("/").at(-1));
          return Response.json({
            id,
            runtime: id === 1 ? 90 : 91,
          });
        },
      },
    );

    const discoveryRequest = requestedUrls.find(
      (url) => url.pathname === "/3/discover/movie",
    );
    assert.equal(discoveryRequest.searchParams.get("with_genres"), "35|10751|16");
    assert.equal(discoveryRequest.searchParams.get("with_runtime.lte"), "90");
    assert.deepEqual(
      result.movies.map((movie) => movie.tmdbId),
      [1],
    );
    assert.equal(result.totalResults, 3);
  });

  it("rejects unsupported discovery options before calling TMDB", async () => {
    let requestMade = false;

    await assert.rejects(
      getMovieDiscoveryPage(
        { page: 1, mood: "not-a-mood" },
        {
          accessToken: "test-token",
          fetchImpl: async () => {
            requestMade = true;
          },
        },
      ),
      (error) => error instanceof TmdbApiError && error.status === 400,
    );
    assert.equal(requestMade, false);
  });
});

describe("TMDB genre discovery service", () => {
  it("requests real TMDB movies matching the selected profile genres", async () => {
    let requestedUrl;
    const result = await getMoviesByGenres([18, 878], 2, {
      accessToken: "test-token",
      fetchImpl: async (url) => {
        requestedUrl = new URL(url);
        return Response.json({
          page: 2,
          results: [
            {
              id: 329865,
              title: "Arrival",
              release_date: "2016-11-11",
              poster_path: "/arrival.jpg",
            },
          ],
        });
      },
    });

    assert.equal(requestedUrl.pathname, "/3/discover/movie");
    assert.equal(requestedUrl.searchParams.get("with_genres"), "18|878");
    assert.equal(requestedUrl.searchParams.get("sort_by"), "popularity.desc");
    assert.equal(requestedUrl.searchParams.get("include_adult"), "false");
    assert.deepEqual(result, {
      page: 2,
      movies: [
        {
          id: "tmdb-329865",
          tmdbId: 329865,
          title: "Arrival",
          format: "Film",
          source: "tmdb",
          posterUrl: "https://image.tmdb.org/t/p/w500/arrival.jpg",
          releaseYear: "2016",
        },
      ],
    });
  });

  it("rejects invalid genre profiles before contacting TMDB", async () => {
    let requestMade = false;
    await assert.rejects(
      getMoviesByGenres([18, 18], 1, {
        accessToken: "test-token",
        fetchImpl: async () => {
          requestMade = true;
        },
      }),
      (error) => error instanceof TmdbApiError && error.status === 400,
    );
    assert.equal(requestMade, false);
  });
});

describe("TMDB movie details service", () => {
  it("returns normalized movie details and only an official YouTube trailer", async () => {
    let requestedUrl;
    let authorization;
    const result = await getMovieDetails("329865", {
      accessToken: "test-token",
      fetchImpl: async (url, options) => {
        requestedUrl = String(url);
        authorization = options.headers.Authorization;
        return Response.json({
          id: 329865,
          title: " Arrival ",
          overview: "  First contact. ",
          release_date: "2016-11-11",
          runtime: 116,
          genres: [
            { id: 18, name: " Drama " },
            { id: 878, name: "Science Fiction" },
          ],
          vote_average: 7.6,
          poster_path: "/arrival.jpg",
          videos: {
            results: [
              {
                site: "YouTube",
                type: "Trailer",
                official: false,
                key: "unofficial01",
              },
              {
                site: "YouTube",
                type: "Trailer",
                official: true,
                key: "abcdefghijk",
              },
              {
                site: "Vimeo",
                type: "Trailer",
                official: true,
                key: "invalidsite1",
              },
            ],
          },
        });
      },
    });

    assert.match(
      requestedUrl,
      /\/movie\/329865\?language=en-US&append_to_response=videos$/,
    );
    assert.equal(authorization, "Bearer test-token");
    assert.deepEqual(result, {
      id: 329865,
      title: "Arrival",
      overview: "First contact.",
      releaseDate: "2016-11-11",
      runtime: 116,
      genres: ["Drama", "Science Fiction"],
      genreIds: [18, 878],
      voteAverage: 7.6,
      posterUrl: "https://image.tmdb.org/t/p/w500/arrival.jpg",
      trailerKey: "abcdefghijk",
    });
  });

  describe("TMDB watch providers service", () => {
    it("returns only India providers and validates the availability link", async () => {
      let requestedUrl;
      let authorization;
      const result = await getMovieWatchProviders("329865", {
        accessToken: "test-token",
        fetchImpl: async (url, options) => {
          requestedUrl = String(url);
          authorization = options.headers.Authorization;
          return Response.json({
            id: 329865,
            results: {
              IN: {
                link: "https://www.themoviedb.org/movie/329865/watch?locale=IN",
                flatrate: [
                  {
                    provider_id: 123,
                    provider_name: " Example Stream ",
                    logo_path: "/provider.jpg",
                  },
                  { provider_id: 456, provider_name: "No logo" },
                ],
                rent: [
                  {
                    provider_id: 789,
                    provider_name: "Example Store",
                    logo_path: "/store.png",
                  },
                ],
              },
              US: {
                flatrate: [
                  {
                    provider_id: 1,
                    provider_name: "US-only service",
                    logo_path: "/us.jpg",
                  },
                ],
              },
            },
          });
        },
      });

      assert.match(requestedUrl, /\/movie\/329865\/watch\/providers$/);
      assert.equal(authorization, "Bearer test-token");
      assert.deepEqual(result, {
        region: "IN",
        link: "https://www.themoviedb.org/movie/329865/watch?locale=IN",
        providersByCategory: {
          flatrate: [
            {
              id: 123,
              name: "Example Stream",
              logoUrl: "https://image.tmdb.org/t/p/w92/provider.jpg",
            },
            { id: 456, name: "No logo", logoUrl: null },
          ],
          rent: [
            {
              id: 789,
              name: "Example Store",
              logoUrl: "https://image.tmdb.org/t/p/w92/store.png",
            },
          ],
        },
      });
    });

    it("returns empty provider categories when TMDB has no India listing", async () => {
      const result = await getMovieWatchProviders("329865", {
        accessToken: "test-token",
        fetchImpl: async () => Response.json({ id: 329865, results: {} }),
      });

      assert.deepEqual(result, {
        region: "IN",
        link: null,
        providersByCategory: {},
      });
    });
  });

  it("returns 404 for missing TMDB movies", async () => {
    await assert.rejects(
      getMovieDetails("329865", {
        accessToken: "test-token",
        fetchImpl: async () => new Response(null, { status: 404 }),
      }),
      (error) => error instanceof TmdbApiError && error.status === 404,
    );
  });
});
