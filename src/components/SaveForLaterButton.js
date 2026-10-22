"use client";

import { useState, useSyncExternalStore } from "react";
import { useCineTrack } from "@/components/CineTrackProvider";
import {
  getMyCinemaServerSnapshot,
  getMyCinemaSnapshot,
  MyCinemaStorageError,
  removeSavedMovie,
  saveMovieForLater,
  subscribeToMyCinema,
} from "@/lib/myCinema";

export default function SaveForLaterButton({ movie }) {
  const {
    authStatus,
    accountMovies,
    cinemaStatus,
    saveAccountMovie,
    removeAccountMovie,
  } = useCineTrack();
  const snapshot = useSyncExternalStore(
    subscribeToMyCinema,
    getMyCinemaSnapshot,
    getMyCinemaServerSnapshot,
  );
  const [actionError, setActionError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isSignedIn = authStatus === "authenticated";
  const savedMovies = isSignedIn ? accountMovies : snapshot.movies;
  const savedMovie = savedMovies.find(
    (item) => item.id === movie.id,
  );
  const error =
    actionError ||
    (isSignedIn && cinemaStatus === "error"
      ? "Your account collection is unavailable. Try again from My Cinema."
      : authStatus === "error"
        ? "Your account could not be checked. Reload the page before changing your collection."
        : !isSignedIn && snapshot.status === "error"
          ? snapshot.error
          : "");
  const isLoading =
    authStatus === "checking" ||
    (isSignedIn && cinemaStatus === "loading") ||
    (!isSignedIn && snapshot.status === "loading") ||
    isSaving;

  async function toggleSavedState() {
    setIsSaving(true);
    try {
      if (savedMovie) {
        if (isSignedIn) {
          await removeAccountMovie(movie.id);
        } else {
          removeSavedMovie(movie.id);
        }
      } else {
        if (isSignedIn) {
          await saveAccountMovie(movie);
        } else {
          saveMovieForLater(movie);
        }
      }

      setActionError("");
    } catch (saveError) {
      if (
        !(saveError instanceof MyCinemaStorageError) &&
        !(saveError instanceof Error)
      ) {
        throw saveError;
      }

      setActionError(
        saveError.message || "This movie could not be changed in My Cinema.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        disabled={isLoading || Boolean(error)}
        onClick={toggleSavedState}
        aria-label={
          savedMovie
            ? `Remove ${movie.title} from My Cinema`
            : `Save ${movie.title} for later`
        }
        className="min-h-12 rounded-lg bg-accent px-6 text-sm font-semibold text-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading
          ? "Checking My Cinema…"
          : savedMovie
            ? savedMovie.status === "saved"
              ? "Saved for later · Remove"
              : `In My Cinema · ${savedMovie.status === "watching" ? "Watching" : "Finished"} · Remove`
            : "Save for later"}
      </button>
      <p className="mt-3 text-xs leading-5 text-muted">
        {isSignedIn
          ? "Saved to your private CineTrack account."
          : "Saved only in this browser. Sign in to import and sync this collection."}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-muted">
          {error}
        </p>
      )}
    </div>
  );
}
