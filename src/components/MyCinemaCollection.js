"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import MovieNotesEditor from "@/components/MovieNotesEditor";
import { useCineTrack } from "@/components/CineTrackProvider";
import {
  getMyCinemaServerSnapshot,
  getMyCinemaSnapshot,
  MyCinemaStorageError,
  removeSavedMovie,
  subscribeToMyCinema,
  updateMovieStatus,
} from "@/lib/myCinema";

const statusLabels = {
  saved: "Saved for later",
  watching: "Watching",
  finished: "Finished",
};

export default function MyCinemaCollection() {
  const {
    authStatus,
    accountMovies,
    cinemaStatus,
    cinemaError,
    loadAccountCollection,
    updateAccountMovie,
    removeAccountMovie,
  } = useCineTrack();
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
      if (
        !(error instanceof MyCinemaStorageError) &&
        !(error instanceof Error)
      ) {
        throw error;
      }

      setActionError(
        error.message || "This movie could not be removed from My Cinema.",
      );
    } finally {
      setPendingMovieId(null);
    }
  }

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
      if (
        !(error instanceof MyCinemaStorageError) &&
        !(error instanceof Error)
      ) {
        throw error;
      }

      setActionError(
        error.message || "This movie's status could not be updated.",
      );
    } finally {
      setPendingMovieId(null);
    }
  }

  if (authStatus === "checking") {
    return (
      <p role="status" className="text-sm text-muted">
        Checking your account and loading My Cinema…
      </p>
    );
  }

  if (isSignedIn && cinemaStatus === "loading") {
    return (
      <p role="status" className="text-sm text-muted">
        Loading your account collection…
      </p>
    );
  }

  if (isSignedIn && cinemaStatus === "error") {
    return (
      <div className="rounded-xl border border-line bg-surface px-5 py-6">
        <p role="alert" className="text-sm leading-7 text-muted">
          {cinemaError}
        </p>
        <button
          type="button"
          onClick={() => loadAccountCollection()}
          className="mt-4 min-h-10 rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Retry loading My Cinema
        </button>
      </div>
    );
  }

  if (!isSignedIn && snapshot.status === "loading") {
    return (
      <p role="status" className="text-sm text-muted">
        Loading your browser collection…
      </p>
    );
  }

  if (!isSignedIn && snapshot.status === "error") {
    return (
      <p
        role="alert"
        className="rounded-xl border border-line bg-surface px-5 py-6 text-sm leading-7 text-muted"
      >
        {snapshot.error}
      </p>
    );
  }

  if (movies.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface px-5 py-8">
        <p className="text-sm text-muted">
          Your My Cinema collection is empty. Save a movie from its detail page
          and it will appear here.
        </p>
        <p className="mt-3 text-xs leading-5 text-muted">
          {isSignedIn
            ? "Your saved movies will sync to your private account."
            : "While signed out, movies stay in this browser. Sign in to import them and sync across sessions."}
        </p>
        {!isSignedIn && authStatus === "anonymous" && (
          <Link
            href="/account"
            className="mt-5 inline-flex min-h-10 items-center rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Sign in or create an account
          </Link>
        )}
        {!isSignedIn && authStatus === "error" && (
          <p role="alert" className="mt-4 text-sm text-muted">
            Your account could not be checked. Reload before switching accounts.
          </p>
        )}
      </div>
    );
  }

  const filteredMovies =
    statusFilter === "all"
      ? movies
      : movies.filter((movie) => movie.status === statusFilter);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            {movies.length} {movies.length === 1 ? "movie" : "movies"} in your
            cinema
          </p>
          <p className="mt-2 text-xs text-muted">
            {isSignedIn
              ? "Synced to your private account."
              : "Stored only in this browser. Sign in to import and sync it."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label
            htmlFor="my-cinema-status-filter"
            className="text-sm text-muted"
          >
            Show
          </label>
          <select
            id="my-cinema-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="min-h-10 rounded-lg border border-line bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="all">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {actionError && (
        <p role="alert" className="mb-6 text-sm text-muted">
          {actionError}
        </p>
      )}
      {isSignedIn && cinemaError && (
        <p role="alert" className="mb-6 text-sm text-muted">
          {cinemaError}
        </p>
      )}
      {!isSignedIn && authStatus === "error" && (
        <p role="alert" className="mb-6 text-sm text-muted">
          Your local collection is available, but CineTrack could not verify
          whether you are signed in. Reload the page before switching accounts.
        </p>
      )}
      {filteredMovies.length === 0 ? (
        <p role="status" className="text-sm text-muted">
          No movies have the “{statusLabels[statusFilter]}” status.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
          {filteredMovies.map((savedMovie) => {
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
                <label
                  htmlFor={`movie-status-${savedMovie.id}`}
                  className="mt-4 block text-xs text-muted"
                >
                  Status
                </label>
                <select
                  id={`movie-status-${savedMovie.id}`}
                  value={savedMovie.status}
                  disabled={
                    pendingMovieId === savedMovie.id || authStatus === "error"
                  }
                  onChange={(event) =>
                    handleStatusChange(savedMovie.id, event.target.value)
                  }
                  className="mt-2 min-h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <MovieNotesEditor
                  movie={savedMovie}
                  isAccountMovie={isSignedIn}
                />
                <button
                  type="button"
                  disabled={
                    pendingMovieId === savedMovie.id || authStatus === "error"
                  }
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
