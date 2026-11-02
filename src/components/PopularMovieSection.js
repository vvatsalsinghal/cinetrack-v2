"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MovieShelf from "@/components/MovieShelf";

const DEFAULT_API_URL = "http://localhost:4000";

// Three tabs for exploring cinema
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

// Resolves the backend URL (Express on Railway / localhost)
function getApiUrl() {
  const configured = process.env.NEXT_PUBLIC_CINETRACK_API_URL?.trim();
  if (!configured) return DEFAULT_API_URL;
  try {
    return new URL(configured).origin;
  } catch {
    return DEFAULT_API_URL;
  }
}

// Converts raw movie results from the API into clean, consistent card objects
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

// Fetches popular movies from the local Next.js route, falling back to Express if needed
async function fetchPopularMovies(queryString, signal) {
  // 1. Attempt Next.js native API route (/api/movies/popular)
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

  // 2. Fallback to Express backend if the internal route is unavailable
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
  const [result, setResult] = useState({ status: "loading" });

  const activeChannelConfig =
    CINEMA_CHANNELS.find((c) => c.id === selectedChannel) || CINEMA_CHANNELS[0];

  function handleChannelChange(channelId) {
    if (channelId !== selectedChannel) {
      setSelectedChannel(channelId);
      setResult({ status: "loading" });
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const queryString = activeChannelConfig.queryParams
      ? `?${activeChannelConfig.queryParams}`
      : "";

    fetchPopularMovies(queryString, controller.signal)
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
          });
        }
      });

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
