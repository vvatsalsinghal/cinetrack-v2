"use client";

import { useState } from "react";
import { useCineTrack } from "@/components/CineTrackProvider";
import { MyCinemaStorageError, updateMovieNotes } from "@/lib/myCinema";

export default function MovieNotesEditor({ movie, isAccountMovie = false }) {
  const { updateAccountMovie } = useCineTrack();
  const [sourceMovie, setSourceMovie] = useState({
    id: movie.id,
    rating: movie.rating ?? "",
    review: movie.review ?? "",
  });
  const [rating, setRating] = useState(sourceMovie.rating);
  const [review, setReview] = useState(sourceMovie.review);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (
    sourceMovie.id !== movie.id ||
    sourceMovie.rating !== (movie.rating ?? "") ||
    sourceMovie.review !== (movie.review ?? "")
  ) {
    const nextSourceMovie = {
      id: movie.id,
      rating: movie.rating ?? "",
      review: movie.review ?? "",
    };
    setSourceMovie(nextSourceMovie);
    setRating(nextSourceMovie.rating);
    setReview(nextSourceMovie.review);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setIsSaving(true);

    try {
      const updates = {
        rating: rating === "" ? null : Number(rating),
        review,
      };
      if (isAccountMovie) {
        await updateAccountMovie(movie.id, updates);
        setMessage("Your private account notes have been saved.");
      } else {
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
          disabled={isSaving || authStatus === "error"}
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
          disabled={isSaving || authStatus === "error"}
          maxLength={500}
          rows={3}
          placeholder="What did you think?"
          className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">{review.length} / 500 characters</p>
          <button
            type="submit"
            disabled={isSaving || authStatus === "error"}
            className="min-h-10 rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
