"use client";

/**
 * ==============================================================================
 * POPULAR MOVIE SECTION (CLIENT COMPONENT)
 * ==============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * Displays interactive shelves of trending movies on the homepage with 3 selectable
 * tabs: "Indian Cinema", "Trending in India", and "Global Cinema".
 * 
 * KEY CONCEPTS DEMONSTRATED HERE:
 * 1. Resilient Fetch Architecture:
 *    First attempts to query CineTrack's internal Next.js API route (`/api/movies/popular`).
 *    If that fails or times out, it gracefully falls back to the Express/Railway backend.
 * 
 * 2. Race-Condition Prevention (AbortController):
 *    When a user rapidly clicks between tabs (e.g. from Indian to Global then back),
 *    the previous network request is cleanly aborted so old responses never overwrite
 *    the latest tab data.
 * 
 * 3. Asynchronous UI State Machine:
 *    Manages distinct UI states: loading, error, empty, and success, ensuring the user
 *    always sees helpful feedback.
 * ==============================================================================
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import MovieShelf from "@/components/MovieShelf";

// Default local Express server URL (used as fallback when running locally)
const DEFAULT_API_URL = "http://localhost:4000";

/**
 * Tab definitions for the homepage movie shelves.
 * Notice the queryParams property:
 * - "industry=indian": instructs our API to filter by Indian production countries (IN)
 * - "region=IN": filters box office & streaming charts popular in India
 * - "": default global popular movies
 */
const CINEMA_CHANNELS = [
  {
    id: "indian",
    label: "🇮🇳 Indian Cinema",
    sublabel: "Bollywood, South & Regional",
    eyebrow: "CURATED FOR INDIA · BOLLYWOOD, SOUTH & REGIONAL",
    title: "Trending in Indian Cinema.",
    description: "Bollywood, South cinema, and celebrated regional films produced in India.",
    queryParams: "industry=indian",
  },
  {
    id: "trending-in",
    label: "🎟️ Trending in India",
    sublabel: "Theatrical & OTT charts",
    eyebrow: "BOX OFFICE & STREAMING · INDIA REGION",
    title: "Top watched in India right now.",
    description: "What audiences in theaters and OTT platforms across India are watching today.",
    queryParams: "region=IN",
  },
  {
    id: "global",
    label: "🌐 Global Cinema",
    sublabel: "International hits",
    eyebrow: "WORLD CINEMA · GLOBAL HITS",
    title: "Popular around the world.",
    description: "Leading theatrical and international releases from world cinema.",
    queryParams: "",
  },
];

/**
 * Resolves the backend Express API URL from environment variables.
 * In production on Vercel, NEXT_PUBLIC_CINETRACK_API_URL points to Railway.
 */
function getApiUrl() {
  const configured = process.env.NEXT_PUBLIC_CINETRACK_API_URL?.trim();
  if (!configured) return DEFAULT_API_URL;
  try {
    return new URL(configured).origin;
  } catch {
    return DEFAULT_API_URL;
  }
}

/**
 * Data Normalizer:
 * Takes raw movie arrays from either Next.js or Express and standardizes them
 * into a predictable object shape expected by <MovieCard />.
 */
function formatMovies(results) {
  if (!Array.isArray(results)) return [];

  return results
    .filter((movie) => movie && movie.id && movie.title)
    .map((movie) => ({
      id: `tmdb-${movie.id}`,
      tmdbId: movie.id,
      title: movie.title.trim(),
      releaseYear: movie.releaseYear || null,
      posterUrl: movie.posterUrl || null,
      format: "Film",
      source: "tmdb",
    }));
}

/**
 * Resilient multi-tier data fetcher:
 * 1. Primary: Next.js internal edge proxy (`/api/movies/popular${queryString}`)
 * 2. Secondary Fallback: Direct Express backend on Railway
 */
async function fetchPopularMovies(queryString, signal) {
  // Step 1: Query internal Next.js API route first (fast, cached via Next.js ISR)
  try {
    const res = await fetch(`/api/movies/popular${queryString}`, {
      headers: { Accept: "application/json" },
      signal, // Passed from AbortController so fast tab switching can cancel it
    });
    if (res.ok) {
      const data = await res.json();
      return formatMovies(data.results);
    }
  } catch (error) {
    // If the user switched tabs, fetch throws an "AbortError" — rethrow it immediately
    if (error.name === "AbortError") throw error;
  }

  // Step 2: Fall back to Express API (e.g. Railway or localhost:4000)
  const apiUrl = getApiUrl();
  const fallbackRes = await fetch(`${apiUrl}/api/movies/popular${queryString}`, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!fallbackRes.ok) {
    throw new Error(`Could not load popular movies (HTTP ${fallbackRes.status})`);
  }

  const fallbackData = await fallbackRes.json();
  return formatMovies(fallbackData.results);
}

export default function PopularMovieSection() {
  // State 1: Which channel tab is active ("indian", "trending-in", or "global")
  const [selectedChannel, setSelectedChannel] = useState("indian");

  // State 2: Async UI state object { status: "loading" | "success" | "error" | "empty", movies?, message? }
  const [result, setResult] = useState({ status: "loading" });

  // Look up the configuration object for whichever tab is currently selected
  const activeChannelConfig =
    CINEMA_CHANNELS.find((c) => c.id === selectedChannel) || CINEMA_CHANNELS[0];

  // User tab click handler: only triggers a fetch if clicking a different tab
  function handleChannelChange(channelId) {
    if (channelId !== selectedChannel) {
      setSelectedChannel(channelId);
      setResult({ status: "loading" });
    }
  }

  /**
   * Data Fetching Effect:
   * Runs whenever activeChannelConfig.queryParams changes (i.e. user clicks a tab).
   * Notice the cleanup function `return () => controller.abort()`:
   * This cancels the pending HTTP request if the tab changes before the server responds.
   */
  useEffect(() => {
    const controller = new AbortController();
    const queryString = activeChannelConfig.queryParams
      ? `?${activeChannelConfig.queryParams}`
      : "";

    fetchPopularMovies(queryString, controller.signal)
      .then((movies) => {
        // Prevent state updates if component unmounted or another tab was clicked
        if (!controller.signal.aborted) {
          setResult({
            status: movies.length > 0 ? "success" : "empty",
            movies,
          });
        }
      })
      .catch((error) => {
        // If aborted, do nothing; otherwise display user-friendly error
        if (!controller.signal.aborted) {
          setResult({
            status: "error",
            message: error.message || "The popular movies could not be loaded.",
          });
        }
      });

    // Cleanup function: aborts this fetch if the user clicks another tab
    return () => controller.abort();
  }, [activeChannelConfig.queryParams]);

  // Tab buttons (Indian Cinema / Trending in India / Global Cinema)
  const channelNav = (
    <div className="mb-8 flex flex-wrap gap-2.5">
      {CINEMA_CHANNELS.map((channel) => {
        const isActive = channel.id === selectedChannel;
        return (
          <button
            key={channel.id}
            type="button"
            onClick={() => handleChannelChange(channel.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all ${
              isActive
                ? "bg-accent font-semibold text-ink shadow-[0_0_16px_rgba(56,189,248,0.35)]"
                : "border border-line bg-surface/60 text-muted hover:border-accent/50 hover:text-foreground"
            }`}
          >
            <span>{channel.label}</span>
          </button>
        );
      })}
    </div>
  );

  if (result.status === "loading") {
    return (
      <section aria-labelledby="popular-movies-title" className="border-t border-line">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
          <p className="eyebrow mb-4">
            <span aria-hidden="true" />
            {activeChannelConfig.eyebrow}
          </p>
          <h2
            id="popular-movies-title"
            className="text-3xl font-medium tracking-tight sm:text-4xl"
          >
            {activeChannelConfig.title}
          </h2>
          <div className="mt-6">{channelNav}</div>
          <p role="status" className="mt-4 text-sm text-muted">
            Loading {activeChannelConfig.title.toLowerCase()}…
          </p>
        </div>
      </section>
    );
  }

  if (result.status === "error") {
    return (
      <section aria-labelledby="popular-movies-title" className="border-t border-line">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
          <p className="eyebrow mb-4">
            <span aria-hidden="true" />
            {activeChannelConfig.eyebrow}
          </p>
          <h2
            id="popular-movies-title"
            className="text-3xl font-medium tracking-tight sm:text-4xl"
          >
            {activeChannelConfig.title}
          </h2>
          <div className="mt-6">{channelNav}</div>
          <p
            role="alert"
            className="mt-6 rounded-xl border border-line bg-surface px-5 py-6 text-sm leading-7 text-muted"
          >
            {result.message}
          </p>
          <Link
            href="/discover"
            className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Browse all movies →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <MovieShelf
      id="popular-movies-title"
      eyebrow={activeChannelConfig.eyebrow}
      title={activeChannelConfig.title}
      description={activeChannelConfig.description}
      movies={result.movies || []}
    >
      <div className="mt-6">{channelNav}</div>
      <Link
        href="/discover"
        className="mt-7 inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Browse full movie catalogue →
      </Link>
    </MovieShelf>
  );
}
