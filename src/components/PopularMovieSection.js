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
 * CORE ARCHITECTURAL CONCEPTS:
 * 1. Resilient Fetch Architecture: Attempts Next.js `/api/movies/popular` edge route first,
 *    falling back to Express/Railway backend if internal route is unavailable.
 * 2. Race-Condition Guard (AbortController): Cancels pending fetches on rapid tab clicks.
 * 3. Unified View Layout: Renders section and tab navigation once, switching only the content.
 * ==============================================================================
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import MovieGrid from "@/components/MovieGrid";
import SectionHeading from "@/components/SectionHeading";

const DEFAULT_API_URL = "http://localhost:4000";

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

function getApiUrl() {
  const configured = process.env.NEXT_PUBLIC_CINETRACK_API_URL?.trim();
  if (!configured) return DEFAULT_API_URL;
  try {
    return new URL(configured).origin;
  } catch {
    return DEFAULT_API_URL;
  }
}

// Normalizes raw movie array into consistent card shape
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

// Fetches movies from Next.js route with Express backend fallback
async function fetchPopularMovies(queryString, signal) {
  try {
    const res = await fetch(`/api/movies/popular${queryString}`, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (res.ok) {
      const data = await res.json();
      return formatMovies(data.results);
    }
  } catch (error) {
    if (error.name === "AbortError") throw error;
  }

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
  const [selectedChannel, setSelectedChannel] = useState("indian");
  const [result, setResult] = useState({ status: "loading", movies: [] });

  const activeChannel =
    CINEMA_CHANNELS.find((c) => c.id === selectedChannel) || CINEMA_CHANNELS[0];

  function handleChannelChange(channelId) {
    if (channelId !== selectedChannel) {
      setSelectedChannel(channelId);
      setResult({ status: "loading", movies: [] });
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const query = activeChannel.queryParams ? `?${activeChannel.queryParams}` : "";

    fetchPopularMovies(query, controller.signal)
      .then((movies) => {
        if (!controller.signal.aborted) {
          setResult({
            status: movies.length > 0 ? "success" : "empty",
            movies,
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            status: "error",
            message: error.message || "The popular movies could not be loaded.",
            movies: [],
          });
        }
      });

    return () => controller.abort();
  }, [activeChannel.queryParams]);

  return (
    <section aria-labelledby="popular-movies-title" className="border-t border-line">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
        {/* Section Header */}
        <div className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            id="popular-movies-title"
            eyebrow={activeChannel.eyebrow}
            title={activeChannel.title}
          />
          <p className="max-w-sm text-sm leading-7 text-muted">
            {activeChannel.description}
          </p>
        </div>

        {/* Tab Channel Buttons */}
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

        {/* Content States: Loading, Error, or Movie Cards Grid */}
        {result.status === "loading" && (
          <p role="status" className="py-12 text-sm text-muted">
            Loading {activeChannel.title.toLowerCase()}…
          </p>
        )}

        {result.status === "error" && (
          <div className="rounded-xl border border-line bg-surface px-5 py-6">
            <p role="alert" className="text-sm leading-7 text-muted">
              {result.message}
            </p>
            <Link
              href="/discover"
              className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Browse all movies →
            </Link>
          </div>
        )}

        {result.status === "success" && (
          <>
            <MovieGrid movies={result.movies} />
            <Link
              href="/discover"
              className="mt-8 inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Browse full movie catalogue →
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
