"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

function parsePopularMovies(payload) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray(payload.results)
  ) {
    throw new Error("The Express API returned an unexpected movie response.");
  }

  return payload.results.map((movie) => {
    if (
      typeof movie !== "object" ||
      movie === null ||
      !Number.isInteger(movie.id) ||
      movie.id < 1 ||
      typeof movie.title !== "string" ||
      !movie.title.trim() ||
      (movie.releaseYear !== null &&
        (typeof movie.releaseYear !== "string" ||
          !/^\d{4}$/.test(movie.releaseYear))) ||
      (movie.posterUrl !== null &&
        (typeof movie.posterUrl !== "string" ||
          !TMDB_IMAGE_URL.test(movie.posterUrl)))
    ) {
      throw new Error("The Express API returned an invalid movie.");
    }

    return {
      id: `tmdb-${movie.id}`,
      tmdbId: movie.id,
      title: movie.title.trim(),
      releaseYear: movie.releaseYear,
      posterUrl: movie.posterUrl,
      format: "Film",
      source: "tmdb",
    };
  });
}

export default function PopularMovieSection() {
  const [result, setResult] = useState({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadPopularMovies() {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/movies/popular`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        let payload;
        try {
          payload = await response.json();
        } catch (error) {
          if (error instanceof SyntaxError) {
            throw new Error("The Express API returned an unreadable response.");
          }

          throw error;
        }

        if (!response.ok) {
          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : `The Express API returned HTTP ${response.status}.`,
          );
        }

        const movies = parsePopularMovies(payload);
        if (!controller.signal.aborted) {
          setResult({ status: movies.length > 0 ? "success" : "empty", movies });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const message =
          error instanceof TypeError
            ? "Could not connect to the Express API. Start it in a second terminal with npm run dev:api."
            : error instanceof Error
              ? error.message
              : "The popular movies could not be loaded.";
        setResult({ status: "error", message });
      }
    }

    loadPopularMovies();
    return () => controller.abort();
  }, []);

  if (result.status === "loading") {
    return (
      <section
        aria-labelledby="popular-movies-title"
        className="border-t border-line"
      >
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
          <p className="eyebrow mb-4">
            <span aria-hidden="true" />
            EXPRESS API · TMDB
          </p>
          <h2
            id="popular-movies-title"
            className="text-3xl font-medium tracking-tight sm:text-4xl"
          >
            Popular right now.
          </h2>
          <p role="status" className="mt-7 text-sm text-muted">
            Loading popular movies through the CineTrack API…
          </p>
        </div>
      </section>
    );
  }

  if (result.status === "error") {
    return (
      <section
        aria-labelledby="popular-movies-title"
        className="border-t border-line"
      >
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
          <p className="eyebrow mb-4">
            <span aria-hidden="true" />
            EXPRESS API · TMDB
          </p>
          <h2
            id="popular-movies-title"
            className="text-3xl font-medium tracking-tight sm:text-4xl"
          >
            Popular right now.
          </h2>
          <p
            role="alert"
            className="mt-7 rounded-xl border border-line bg-surface px-5 py-6 text-sm leading-7 text-muted"
          >
            {result.message}
          </p>
          <Link
            href="/discover"
            className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Browse all popular movies →
          </Link>
        </div>
      </section>
    );
  }

  if (result.status === "empty") {
    return (
      <section
        aria-labelledby="popular-movies-title"
        className="border-t border-line"
      >
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
          <p className="eyebrow mb-4">
            <span aria-hidden="true" />
            EXPRESS API · TMDB
          </p>
          <h2
            id="popular-movies-title"
            className="text-3xl font-medium tracking-tight sm:text-4xl"
          >
            Popular right now.
          </h2>
          <p
            role="status"
            className="mt-7 rounded-xl border border-line bg-surface px-5 py-8 text-sm text-muted"
          >
            TMDB has no popular movies to show right now.
          </p>
        </div>
      </section>
    );
  }

  return (
    <MovieShelf
      id="popular-movies-title"
      eyebrow="EXPRESS API · TMDB"
      title="Popular right now."
      description="Popular films returned by the CineTrack API from TMDB. This list can change over time."
      movies={result.movies}
    >
      <Link
        href="/discover"
        className="mt-7 inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Browse all popular movies →
      </Link>
    </MovieShelf>
  );
}
