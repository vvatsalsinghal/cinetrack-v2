"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function MovieCard({ movie }) {
  const movieId = movie.tmdbId || movie.id;
  const movieDetailHref = movie.tmdbId ? `/movie/${movie.tmdbId}` : `/movie/${movieId}`;

  // Preview overlay state
  const [preview, setPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  // 3D holographic tilt on poster hover
  const posterCardRef = useRef(null);
  const [tiltStyle, setTiltStyle] = useState({
    transform: "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
  });
  const [glareStyle, setGlareStyle] = useState({ opacity: 0 });

  // Loads video trailer and score for the preview card
  async function loadPreview() {
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

  // Mouse hover handlers
  function handlePointerEnter(event) {
    if (event.pointerType === "mouse") {
      setShowPreview(true);
      loadPreview();
    }
  }

  function handlePointerLeave() {
    if (!isPinned) {
      setShowPreview(false);
    }
    resetTilt();
  }

  // Keyboard accessibility
  function handleFocus() {
    setShowPreview(true);
    loadPreview();
  }

  function handleBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      if (!isPinned) setShowPreview(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setShowPreview(false);
      setIsPinned(false);
    }
  }

  // Toggle "Preview" button click (pins the trailer open or closes it)
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

  // Calculates 3D card tilt angle as the mouse moves across the poster
  function handlePosterMouseMove(event) {
    if (event.pointerType === "touch" || showPreview) return;
    const rect = posterCardRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const normX = (x / rect.width) * 2 - 1;
    const normY = (y / rect.height) * 2 - 1;

    setTiltStyle({
      transform: `perspective(800px) rotateX(${-normY * 9}deg) rotateY(${normX * 9}deg) scale3d(1.025, 1.025, 1.025)`,
      transition: "transform 0.08s ease-out",
    });

    setGlareStyle({
      opacity: 1,
      background: `radial-gradient(circle 220px at ${(x / rect.width) * 100}% ${(y / rect.height) * 100}%, rgba(255, 255, 255, 0.22), transparent 70%)`,
    });
  }

  function resetTilt() {
    setTiltStyle({
      transform: "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
      transition: "transform 0.4s ease-out",
    });
    setGlareStyle({
      opacity: 0,
      transition: "opacity 0.4s ease-out",
    });
  }

  return (
    <article
      className="group min-w-0"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={posterCardRef}
        onPointerMove={handlePosterMouseMove}
        onPointerLeave={resetTilt}
        style={tiltStyle}
        className="movie-art relative aspect-[2/3] will-change-transform shadow-md transition-shadow duration-300 hover:shadow-[0_12px_32px_rgba(56,189,248,0.18)]"
      >
        {/* Holographic Specular Glare Overlay */}
        <div
          aria-hidden="true"
          style={glareStyle}
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-200 mix-blend-overlay"
        />

        {/* Poster Image Link */}
        <Link
          href={movieDetailHref}
          className="absolute inset-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          aria-label={`View details for ${movie.title}`}
        >
          {movie.posterUrl ? (
            <Image
              src={movie.posterUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-cover"
            />
          ) : (
            <span className="movie-art-label">POSTER UNAVAILABLE</span>
          )}
        </Link>

        {/* Video Trailer Preview Overlay */}
        {movie.tmdbId && (
          <>
            {showPreview && (
              <div className="absolute inset-0 z-10 bg-black/90">
                {preview?.trailerKey && (
                  <div className="absolute left-0 top-1/2 aspect-video w-full -translate-y-1/2 overflow-hidden bg-black">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${preview.trailerKey}?autoplay=1&mute=1&controls=0&playsinline=1&end=12`}
                      title={`${movie.title} trailer preview`}
                      className="pointer-events-none h-full w-full"
                      allow="autoplay; encrypted-media"
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/90 to-transparent px-3 pb-3 pt-10 text-white sm:px-4 sm:pb-4">
                  <p className="text-sm font-semibold leading-snug">{movie.title}</p>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-white/80">
                    {preview?.voteAverage !== null && preview?.voteAverage !== undefined && (
                      <span>TMDB {preview.voteAverage.toFixed(1)} / 10</span>
                    )}
                    {preview?.genres?.length > 0 && (
                      <span>{preview.genres.slice(0, 3).join(" · ")}</span>
                    )}
                  </div>

                  {isLoadingPreview && (
                    <p role="status" className="mt-2 text-xs text-white/70">
                      Loading preview…
                    </p>
                  )}
                  {preview && !preview.trailerKey && (
                    <p className="mt-2 text-xs text-white/70">
                      No official trailer available.
                    </p>
                  )}
                  {previewError && (
                    <p role="status" className="mt-2 text-xs text-white/70">
                      {previewError}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Preview Button */}
            <button
              type="button"
              onClick={togglePinnedPreview}
              aria-label={`${showPreview ? "Close" : "Preview"} ${movie.title} trailer`}
              aria-pressed={showPreview}
              className="absolute right-2 top-2 z-20 flex min-h-9 items-center gap-1.5 rounded-full border border-white/25 bg-black/75 px-3 text-xs font-medium text-white backdrop-blur transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {showPreview ? "Close" : "Preview"}
            </button>
          </>
        )}
      </div>

      {/* Movie Details (Title, Year, Source) */}
      <div className="pt-4">
        <Link
          href={movieDetailHref}
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <p className="mb-2 text-[10px] font-medium tracking-[0.16em] text-accent">
            {movie.releaseYear || "RELEASE DATE UNAVAILABLE"}
          </p>
          <h3 className="text-base font-medium leading-snug sm:text-lg">
            {movie.title}
          </h3>
          <p className="mt-2 text-xs text-muted">{movie.format || "Film"} · TMDB</p>
        </Link>
      </div>
    </article>
  );
}
