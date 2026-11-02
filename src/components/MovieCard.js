"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * ==============================================================================
 * MOVIE CARD COMPONENT (INTERACTIVE 3D TILT & TRAILER PREVIEW)
 * ==============================================================================
 * Features:
 * 1. 3D Holographic Tilt: Calculates cursor position relative to the poster card
 *    to rotate the card in 3D space with an optical glare reflection.
 * 2. On-Demand Preview: Instead of loading trailers for 20+ movies at once
 *    (which would slow down the page), the trailer and score are fetched
 *    only when the user hovers over or clicks "Preview".
 * 3. Accessibility: Supports keyboard navigation (Tab to focus, Escape to close).
 * ==============================================================================
 */
export default function MovieCard({ movie }) {
  // Normalize movie ID whether it comes from TMDB or local library
  const movieId = movie.tmdbId || movie.id;
  const movieDetailHref = movie.tmdbId ? `/movie/${movie.tmdbId}` : `/movie/${movieId}`;

  // State for lazy trailer & ratings preview overlay
  const [preview, setPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  // Ref to measure poster dimensions on screen for 3D physics
  const posterCardRef = useRef(null);

  // Dynamic CSS transforms applied to the poster card
  const [tiltStyle, setTiltStyle] = useState({
    transform: "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
  });
  const [glareStyle, setGlareStyle] = useState({ opacity: 0 });

  /**
   * Fetches lightweight preview details (rating, trailer key, genre) from Next.js API route.
   * Only called once per movie to conserve network bandwidth.
   */
  async function loadPreview() {
    // If preview is already loaded or already in-flight, skip
    if (preview || isLoadingPreview || !movie.tmdbId) return;

    setIsLoadingPreview(true);
    setPreviewError("");

    try {
      const response = await fetch(`/api/movies/${movie.tmdbId}/preview`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setPreview(data);
    } catch {
      setPreviewError("Preview details are temporarily unavailable.");
    } finally {
      setIsLoadingPreview(false);
    }
  }

  // --- MOUSE HOVER HANDLERS ---

  function handlePointerEnter(event) {
    // Only auto-open on mouse hover (touch devices tap explicitly)
    if (event.pointerType === "mouse") {
      setShowPreview(true);
      loadPreview();
    }
  }

  function handlePointerLeave() {
    // If the user pinned the card open via the button, keep it open; otherwise hide
    if (!isPinned) {
      setShowPreview(false);
    }
    resetTilt();
  }

  // --- KEYBOARD ACCESSIBILITY HANDLERS ---

  function handleFocus() {
    setShowPreview(true);
    loadPreview();
  }

  function handleBlur(event) {
    // Close preview when keyboard focus moves outside the card
    if (!event.currentTarget.contains(event.relatedTarget)) {
      if (!isPinned) setShowPreview(false);
    }
  }

  function handleKeyDown(event) {
    // Allow users to press "Escape" to dismiss the trailer preview immediately
    if (event.key === "Escape") {
      setShowPreview(false);
      setIsPinned(false);
    }
  }

  /**
   * Toggles pinned mode when user clicks the "Preview" button.
   * Useful on tablets and mobile phones where there is no mouse hover.
   */
  function togglePinnedPreview() {
    if (showPreview) {
      setShowPreview(false);
      setIsPinned(false);
    } else {
      setShowPreview(true);
      setIsPinned(true);
      loadPreview();
    }
  }

  /**
   * Calculates 3D card tilt angle as the mouse moves across the poster.
   * Math Concept:
   * 1. Get card bounding box: { left, top, width, height }
   * 2. Normalize mouse position from -1.0 (left/top) to +1.0 (right/bottom)
   * 3. Multiply by max degrees (e.g. 12deg) to get rotateX and rotateY
   */
  function handlePosterMouseMove(event) {
    if (event.pointerType === "touch" || showPreview) return;
    const rect = posterCardRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert pixel coordinates to normalized range [-1, +1]
    const normX = (x / rect.width) * 2 - 1;
    const normY = (y / rect.height) * 2 - 1;

    // Invert Y rotation so moving up tilts forward, moving down tilts back
    const rotateX = -normY * 12;
    const rotateY = normX * 12;

    setTiltStyle({
      transform: `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.025, 1.025, 1.025)`,
      transition: "transform 0.08s ease-out",
    });

    // Optical glare reflection follows the angle of virtual light
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    setGlareStyle({
      opacity: 0.18,
      background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.8) 0%, transparent 65%)`,
    });
  }

  // Smoothly resets the card back to flat position when cursor leaves
  function resetTilt() {
    setTiltStyle({
      transform: "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
      transition: "transform 0.35s ease-out",
    });
    setGlareStyle({ opacity: 0 });
  }

  return (
    <article
      tabIndex={0}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="group relative flex flex-col justify-between rounded-xl border border-line bg-surface/70 p-3 transition-colors hover:border-accent/60"
    >
      {/* 3D Tilt Poster Section */}
      <div
        ref={posterCardRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePosterMouseMove}
        style={tiltStyle}
        className="movie-art relative aspect-[2/3] w-full overflow-hidden rounded-lg will-change-transform"
      >
        <Link
          href={movieDetailHref}
          tabIndex={-1}
          aria-label={`View movie details for ${movie.title}`}
          className="absolute inset-0 z-10 block"
        >
          {movie.posterUrl ? (
            <Image
              src={movie.posterUrl}
              alt={movie.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-4 text-center">
              <span className="movie-art-label text-xs font-semibold text-muted">
                {movie.title}
              </span>
            </div>
          )}
        </Link>

        {/* Dynamic Holographic Glare Overlay */}
        <div
          aria-hidden="true"
          style={glareStyle}
          className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-200"
        />

        {/* Floating Quick Preview Overlay (Trailers & Ratings) */}
        {showPreview && (
          <div className="absolute inset-0 z-30 flex flex-col justify-between bg-black/92 p-3 text-xs backdrop-blur-xs animate-in fade-in duration-200">
            {isLoadingPreview ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span>Loading preview…</span>
              </div>
            ) : previewError ? (
              <div className="flex h-full items-center justify-center text-center text-muted">
                <p>{previewError}</p>
              </div>
            ) : (
              <>
                {/* Embedded YouTube Trailer Video Player */}
                {preview?.trailerKey ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded border border-line bg-black">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${preview.trailerKey}?autoplay=1&mute=1&playsinline=1`}
                      title={`${movie.title} Trailer`}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                      className="h-full w-full border-0"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center rounded border border-line bg-surface/50 text-[11px] text-muted">
                    No video trailer available
                  </div>
                )}

                {/* Score & Genres */}
                <div className="mt-2 space-y-1">
                  {typeof preview?.voteAverage === "number" && (
                    <p className="font-semibold text-accent">
                      ★ {preview.voteAverage.toFixed(1)} / 10
                    </p>
                  )}
                  {preview?.genres?.length > 0 && (
                    <p className="truncate text-[11px] text-muted">
                      {preview.genres.slice(0, 3).join(" · ")}
                    </p>
                  )}
                </div>

                {/* Link to Full Movie Page */}
                <Link
                  href={movieDetailHref}
                  className="mt-2 block w-full rounded bg-accent py-1.5 text-center text-[11px] font-semibold text-ink transition-opacity hover:opacity-90"
                >
                  View Details &amp; Stream →
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Movie Title & Release Year Metadata */}
      <div className="mt-3 flex flex-1 flex-col justify-between">
        <div>
          <h3 className="line-clamp-1 text-sm font-medium text-foreground">
            <Link href={movieDetailHref} className="hover:text-accent">
              {movie.title}
            </Link>
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {movie.releaseYear || "Movie"}
          </p>
        </div>

        {/* Pin Preview Button */}
        <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5">
          <button
            type="button"
            onClick={togglePinnedPreview}
            className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              isPinned
                ? "bg-accent/20 text-accent font-semibold"
                : "text-muted hover:text-foreground"
            }`}
          >
            {isPinned ? "Close preview ✕" : "Quick preview"}
          </button>

          <Link
            href={movieDetailHref}
            className="text-[11px] font-medium text-accent hover:underline"
          >
            Details →
          </Link>
        </div>
      </div>
    </article>
  );
}
