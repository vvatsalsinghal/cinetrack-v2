"use client";

import { useEffect, useState } from "react";
import MovieShelf from "@/components/MovieShelf";

const DEFAULT_API_URL = "http://localhost:4000";
const TMDB_IMAGE_URL =
  /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;

function getApiUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_CINETRACK_API_URL?.trim() || DEFAULT_API_URL;

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("The Express API URL must use HTTP or HTTPS.");
    }

    return url.origin;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("The Express API URL is not valid.");
    }

    throw error;
  }
}

function parseSearchResults(payload) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray(payload.results)
  ) {
    throw new Error("The Express API returned an unexpected search response.");
  }

  return payload.results.map((result) => {
    if (
      typeof result !== "object" ||
      result === null ||
      !Number.isInteger(result.id) ||
      result.id < 1 ||
      typeof result.title !== "string" ||
      !result.title.trim() ||
      (result.releaseYear !== null &&
        (typeof result.releaseYear !== "string" ||
          !/^\d{4}$/.test(result.releaseYear))) ||
      (result.posterUrl !== null &&
        (typeof result.posterUrl !== "string" ||
          !TMDB_IMAGE_URL.test(result.posterUrl)))
    ) {
      throw new Error("The Express API returned an invalid movie result.");
    }

    return {
      id: `tmdb-${result.id}`,
      tmdbId: result.id,
      title: result.title.trim(),
      releaseYear: result.releaseYear,
      posterUrl: result.posterUrl,
      format: "Film",
      source: "tmdb",
    };
  });
}

export default function MovieSearchResults({ query }) {
  const [searchResult, setSearchResult] = useState(null);
  const currentResult =
    searchResult?.query === query ? searchResult : null;
  const status = !query
    ? "idle"
    : currentResult?.status ?? "loading";

  useEffect(() => {
    if (!query) {
      return undefined;
    }

    const controller = new AbortController();

    async function loadSearchResults() {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(
          `${apiUrl}/api/movies/search?q=${encodeURIComponent(query)}`,
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );

        let payload;
        try {
          payload = await response.json();
        } catch (parseError) {
          if (parseError instanceof SyntaxError) {
            throw new Error("The Express API returned an unreadable response.");
          }

          throw parseError;
        }

        if (!response.ok) {
          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : `The Express API returned HTTP ${response.status}.`,
          );
        }

        const results = parseSearchResults(payload);
        if (controller.signal.aborted) {
          return;
        }

        setSearchResult({
          query,
          status: results.length > 0 ? "success" : "empty",
          movies: results,
          errorMessage: "",
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof TypeError) {
          setSearchResult({
            query,
            status: "error",
            movies: [],
            errorMessage:
              "Could not connect to the Express API. Start it in a second terminal with npm run dev:api, then search again.",
          });
        } else if (error instanceof Error) {
          setSearchResult({
            query,
            status: "error",
            movies: [],
            errorMessage: error.message,
          });
        } else {
          throw error;
        }
      }
    }

    loadSearchResults();
    return () => controller.abort();
  }, [query]);

  if (status === "idle") {
    return (
      <p
        role="status"
        className="rounded-xl border border-line bg-surface px-5 py-8 text-sm text-muted"
      >
        Enter a movie title above to see matching results.
      </p>
    );
  }

  if (status === "loading") {
    return (
      <p role="status" className="text-sm text-muted">
        Searching through the Express API…
      </p>
    );
  }

  if (status === "error") {
    return (
      <p
        role="alert"
        className="rounded-xl border border-line bg-surface px-5 py-6 text-sm leading-7 text-muted"
      >
        {currentResult?.errorMessage}
      </p>
    );
  }

  if (status === "empty") {
    return (
      <p
        role="status"
        className="rounded-xl border border-line bg-surface px-5 py-8 text-sm text-muted"
      >
        No movies found for “{query}”. Try another title.
      </p>
    );
  }

  return (
    <MovieShelf
      id="search-results-title"
      eyebrow="EXPRESS API SEARCH"
      title={`Results for “${query}”`}
      description={`Showing ${currentResult.movies.length} ${currentResult.movies.length === 1 ? "match" : "matches"} returned by the CineTrack API.`}
      movies={currentResult.movies}
    />
  );
}
