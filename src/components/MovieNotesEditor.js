"use client";

/**
 * ==============================================================================
 * MOVIE NOTES EDITOR (CLIENT COMPONENT)
 * ==============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * Allows cinephiles to record a personal 1-5 star rating and private review note
 * for any movie in their library.
 * 
 * CORE ARCHITECTURAL CONCEPTS DEMONSTRATED HERE:
 * 1. Native HTML5 Disclosure Element (<details> and <summary>):
 *    Instead of importing heavy accordion or modal libraries, this uses browser-native
 *    `<details>` / `<summary>`, providing lightweight, keyboard-accessible collapsible
 *    editing with zero JavaScript overhead.
 * 
 * 2. Controlled Form Pattern:
 *    The select dropdown and textarea bind to React state (`rating`, `review`).
 *    On typing or selecting, state updates immediately.
 * 
 * 3. Dual Storage Branching:
 *    - If `isAccountMovie` is true: saves via `updateAccountMovie()` to MongoDB.
 *    - Otherwise: saves locally in browser via `updateMovieNotes()` in localStorage.
 * ==============================================================================
 */

import { useState } from "react";
import { useCineTrack } from "@/components/CineTrackProvider";
import { MyCinemaStorageError, updateMovieNotes } from "@/lib/myCinema";

export default function MovieNotesEditor({ movie, isAccountMovie = false }) {
  // Grab account update mutation and current authentication status from context
  const { updateAccountMovie, authStatus } = useCineTrack();

  // Controlled component state initialized with existing movie properties
  const [rating, setRating] = useState(movie.rating ?? "");
  const [review, setReview] = useState(movie.review ?? "");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Disable inputs if a save is in flight or if cloud account is unreachable
  const isSyncDisabled = isSaving || (isAccountMovie && authStatus === "error");

  /**
   * Form submission handler:
   * Prevents standard browser page reload and routes update to appropriate storage layer.
   */
  async function handleSubmit(event) {
    event.preventDefault(); // Stop standard browser POST/refresh behavior
    setMessage("");
    setIsSaving(true);

    try {
      const updates = {
        rating: rating === "" ? null : Number(rating),
        review,
      };

      // Branch 1: Logged-in user -> Save to MongoDB via Express API
      if (isAccountMovie) {
        await updateAccountMovie(movie.id, updates);
        setMessage("Your private account notes have been saved.");
      } else {
        // Branch 2: Guest user -> Save to browser localStorage
        updateMovieNotes(movie.id, updates.rating, updates.review);
        setMessage("Your personal notes were saved in this browser.");
      }
    } catch (error) {
      if (
        !(error instanceof MyCinemaStorageError) &&
        !(error instanceof Error)
      ) {
        throw error;
      }

      setMessage(
        error.message || "Your personal notes could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <details className="group mt-3 rounded-lg border border-line bg-background/60">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <span>Your rating &amp; note</span>
        <span className="flex items-center gap-2 text-xs text-muted">
          <span>
            {movie.rating ? `${movie.rating}/5` : ""}
            {movie.review ? (movie.rating ? " · Note saved" : "Note saved") : ""}
            {!movie.rating && !movie.review ? "Add details" : ""}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4 transition-transform group-open:rotate-180"
          >
            <path
              d="m5 7.5 5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </summary>

      <form onSubmit={handleSubmit} className="space-y-3 border-t border-line p-3">
        <label
          htmlFor={`movie-rating-${movie.id}`}
          className="block text-xs text-muted"
        >
          Your rating
        </label>
        <select
          id={`movie-rating-${movie.id}`}
          value={rating}
          onChange={(event) => setRating(event.target.value)}
          disabled={isSyncDisabled}
          className="min-h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option value="">No rating</option>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value} / 5
            </option>
          ))}
        </select>

        <label
          htmlFor={`movie-review-${movie.id}`}
          className="block text-xs text-muted"
        >
          Private note
        </label>
        <textarea
          id={`movie-review-${movie.id}`}
          value={review}
          onChange={(event) => setReview(event.target.value)}
          disabled={isSyncDisabled}
          maxLength={500}
          rows={3}
          placeholder="What did you think?"
          className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">{review.length} / 500 characters</p>
          <button
            type="submit"
            disabled={isSyncDisabled}
            className="min-h-10 rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save notes"}
          </button>
        </div>

        {message && (
          <p role="status" className="text-xs leading-5 text-muted">
            {message}
          </p>
        )}
      </form>
    </details>
  );
}
