"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MovieShelf from "@/components/MovieShelf";

const DEFAULT_API_URL = "http://localhost:4000";
const TMDB_IMAGE_URL =
  /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;

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

    async function loadPopularMovies() {
      try {
        const apiUrl = getApiUrl();
        const queryString = activeChannelConfig.queryParams
          ? `?${activeChannelConfig.queryParams}`
          : "";

        const response = await fetch(`${apiUrl}/api/movies/popular${queryString}`, {
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
  }, [activeChannelConfig.queryParams]);

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
      <section
        aria-labelledby="popular-movies-title"
        className="border-t border-line"
      >
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
      <section
        aria-labelledby="popular-movies-title"
        className="border-t border-line"
      >
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
