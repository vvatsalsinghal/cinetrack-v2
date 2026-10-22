"use client";

import { useState } from "react";

export default function MovieTrailer({ movieTitle, trailerKey }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!trailerKey) {
    return (
      <p className="mt-6 text-sm text-muted">
        No official YouTube trailer is listed for this movie.
      </p>
    );
  }

  return (
    <section className="mt-8" aria-label={`Trailer for ${movieTitle}`}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="min-h-11 rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {isOpen ? "Close trailer" : "Watch official trailer"}
      </button>
      {isOpen && (
        <div className="mt-4 aspect-video overflow-hidden rounded-xl border border-line bg-surface">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1`}
            title={`${movieTitle} official trailer`}
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      )}
    </section>
  );
}
