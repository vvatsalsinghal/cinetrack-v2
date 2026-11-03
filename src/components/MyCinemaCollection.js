"use client";

/**
 * ==============================================================================
 * MY CINEMA COLLECTION (CLIENT COMPONENT)
 * ==============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * Displays the user's personal movie library with status filters (Saved, Watching, Finished).
 * - Signed In: Syncs with MongoDB via CineTrackProvider (`accountMovies`).
 * - Guest/Signed Out: Uses browser localStorage with `useSyncExternalStore` for multi-tab sync.
 * ==============================================================================
 */

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import MovieNotesEditor from "@/components/MovieNotesEditor";
import { useCineTrack } from "@/components/CineTrackProvider";
import {
  getMyCinemaServerSnapshot,
  getMyCinemaSnapshot,
  removeSavedMovie,
  subscribeToMyCinema,
  updateMovieStatus,
} from "@/lib/myCinema";

const STATUS_LABELS = {
  saved: "Saved for later",
  watching: "Watching",
  finished: "Finished",
};

export default function MyCinemaCollection() {
  const {
    authStatus,
    accountMovies = [],
    cinemaStatus,
    cinemaError,
    loadAccountCollection,
    updateAccountMovie,
    removeAccountMovie,
  } = useCineTrack() || {};

  // External store subscription for guest mode localStorage
  const snapshot = useSyncExternalStore(
    subscribeToMyCinema,
    getMyCinemaSnapshot,
    getMyCinemaServerSnapshot,
  );

  const [actionError, setActionError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingMovieId, setPendingMovieId] = useState(null);

  const isSignedIn = authStatus === "authenticated";
  const movies = isSignedIn ? accountMovies : snapshot.movies;

  // Removes a movie from cloud or local storage
  async function handleRemove(movieId) {
    setPendingMovieId(movieId);
    try {
      if (isSignedIn) {
        await removeAccountMovie(movieId);
      } else {
        removeSavedMovie(movieId);
      }
      setActionError("");
    } catch (error) {
      setActionError(error?.message || "This movie could not be removed from My Cinema.");
    } finally {
      setPendingMovieId(null);
    }
  }

  // Updates watch status (saved, watching, finished)
  async function handleStatusChange(movieId, status) {
    setPendingMovieId(movieId);
    try {
      if (isSignedIn) {
        await updateAccountMovie(movieId, { status });
      } else {
        updateMovieStatus(movieId, status);
      }
      setActionError("");
    } catch (error) {
      setActionError(error?.message || "This movie's status could not be updated.");
    } finally {
      setPendingMovieId(null);
    }
  }

  // 1. Loading State
  const isLoading =
    authStatus === "checking" ||
    (isSignedIn ? cinemaStatus === "loading" : snapshot.status === "loading");

  if (isLoading) {
    return <p role="status" className="py-12 text-sm text-muted">Loading your cinema collection…</p>;
  }

  // 2. Error State
  const errorMessage = isSignedIn
    ? (cinemaStatus === "error" ? cinemaError : null)
    : (snapshot.status === "error" ? snapshot.error : null);

  if (errorMessage) {
    return (
      <div className="rounded-xl border border-line bg-surface px-5 py-6">
        <p role="alert" className="text-sm leading-7 text-muted">{errorMessage}</p>
        {isSignedIn && (
          <button
            type="button"
            onClick={() => loadAccountCollection?.()}
            className="mt-4 min-h-10 rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Retry loading My Cinema
          </button>
        )}
      </div>
    );
  }

  // 3. Empty State
  if (!movies || movies.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface px-5 py-8">
        <p className="text-sm text-muted">
          Your My Cinema collection is empty. Save a movie from its detail page and it will appear here.
        </p>
        <p className="mt-3 text-xs leading-5 text-muted">
          {isSignedIn
            ? "Your saved movies sync to your private account."
            : "While signed out, movies stay in this browser. Sign in to import and sync them across devices."}
        </p>
        {!isSignedIn && authStatus === "anonymous" && (
          <Link
            href="/account"
            className="mt-5 inline-flex min-h-10 items-center rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Sign in or create an account
          </Link>
        )}
      </div>
    );
  }

  // 4. Filtered Movies by Status
  const filteredMovies =
    statusFilter === "all" ? movies : movies.filter((m) => m.status === statusFilter);

  return (
    <div>
      {/* Header controls: movie count & status filter */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            {movies.length} {movies.length === 1 ? "movie" : "movies"} in your cinema
          </p>
          <p className="mt-2 text-xs text-muted">
            {isSignedIn
              ? "Synced to your private account."
              : "Stored only in this browser. Sign in to import and sync."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="my-cinema-status-filter" className="text-sm text-muted">
            Show
          </label>
          <select
            id="my-cinema-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-10 rounded-lg border border-line bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionError && <p role="alert" className="mb-6 text-sm text-muted">{actionError}</p>}

      {/* Grid of Saved Movie Cards */}
      {filteredMovies.length === 0 ? (
        <p role="status" className="py-8 text-sm text-muted">
          No movies have the “{STATUS_LABELS[statusFilter]}” status.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
          {filteredMovies.map((savedMovie) => {
            const isBusy = pendingMovieId === savedMovie.id || authStatus === "error";
            const movie = {
              ...savedMovie,
              id: `tmdb-${savedMovie.id}`,
              tmdbId: savedMovie.id,
              format: "Film",
              source: "tmdb",
            };

            return (
              <div key={savedMovie.id}>
                <MovieCard movie={movie} />

                {/* Status selector */}
                <label
                  htmlFor={`movie-status-${savedMovie.id}`}
                  className="mt-4 block text-xs text-muted"
                >
                  Status
                </label>
                <select
                  id={`movie-status-${savedMovie.id}`}
                  value={savedMovie.status || "saved"}
                  disabled={isBusy}
                  onChange={(e) => handleStatusChange(savedMovie.id, e.target.value)}
                  className="mt-2 min-h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>

                {/* Personal Notes & Star Rating */}
                <MovieNotesEditor movie={savedMovie} isAccountMovie={isSignedIn} />

                {/* Remove button */}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleRemove(savedMovie.id)}
                  className="mt-3 min-h-10 rounded-lg border border-line px-4 text-sm text-muted transition-colors hover:border-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  aria-label={`Remove ${savedMovie.title} from My Cinema`}
                >
                  {pendingMovieId === savedMovie.id ? "Saving…" : "Remove"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
