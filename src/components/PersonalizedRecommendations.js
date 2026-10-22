"use client";

import Link from "next/link";
import MovieShelf from "@/components/MovieShelf";
import { useCineTrack } from "@/components/CineTrackProvider";

function RecommendationMessage({ children, action }) {
  return (
    <section
      aria-labelledby="personalized-recommendations-title"
      className="border-t border-line"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
        <p className="eyebrow mb-4">
          <span aria-hidden="true" />
          FOR YOUR NEXT MOVIE NIGHT
        </p>
        <h2
          id="personalized-recommendations-title"
          className="text-3xl font-medium tracking-tight sm:text-4xl"
        >
          Picked for your cinema.
        </h2>
        <div className="mt-5 max-w-2xl text-sm leading-7 text-muted">
          {children}
        </div>
        {action}
      </div>
    </section>
  );
}

export default function PersonalizedRecommendations() {
  const {
    authStatus,
    cinemaStatus,
    recommendationActivityCount,
    recommendationError,
    recommendationGenres,
    recommendationStatus,
    recommendations,
    loadRecommendations,
  } = useCineTrack();

  if (authStatus === "checking") {
    return (
      <RecommendationMessage>
        <p role="status">Checking your account before loading private picks…</p>
      </RecommendationMessage>
    );
  }

  if (authStatus === "anonymous") {
    return (
      <RecommendationMessage
        action={
          <Link
            href="/account"
            className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Sign in for personal picks
          </Link>
        }
      >
        <p>
          Sign in to get movie ideas based on your private My Cinema activity.
          No viewing history is used while you are signed out.
        </p>
      </RecommendationMessage>
    );
  }

  if (authStatus === "error") {
    return (
      <RecommendationMessage>
        <p role="alert">
          Your account could not be verified, so private recommendations are
          unavailable. Check that the API and MongoDB are running, then reload.
        </p>
      </RecommendationMessage>
    );
  }

  if (cinemaStatus === "loading" || recommendationStatus === "loading") {
    return (
      <RecommendationMessage>
        <p role="status">Finding real TMDB titles that fit your cinema…</p>
      </RecommendationMessage>
    );
  }

  if (cinemaStatus === "error" || recommendationStatus === "error") {
    return (
      <RecommendationMessage
        action={
          <button
            type="button"
            onClick={() => loadRecommendations()}
            className="mt-6 min-h-10 rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Try again
          </button>
        }
      >
        <p role="alert">
          {cinemaStatus === "error"
            ? "Your account collection could not be loaded, so CineTrack cannot build recommendations from it."
            : recommendationError}
        </p>
      </RecommendationMessage>
    );
  }

  if (recommendationActivityCount === 0) {
    return (
      <RecommendationMessage>
        <p>
          Your activity is private and there is not enough viewing activity yet.
          Mark films as Watching or Finished, or give a film a 4- or 5-star
          rating in My Cinema to build your first recommendations.
        </p>
      </RecommendationMessage>
    );
  }

  if (recommendationGenres.length === 0) {
    return (
      <RecommendationMessage>
        <p>
          TMDB has not provided genre metadata for the films in your recent
          activity, so CineTrack cannot make a reliable match yet.
        </p>
      </RecommendationMessage>
    );
  }

  const movies = recommendations.map((movie) => ({
    id: `tmdb-${movie.tmdbId}`,
    tmdbId: movie.tmdbId,
    title: movie.title,
    releaseYear: movie.releaseYear,
    posterUrl: movie.posterUrl,
    format: "Film",
    source: "tmdb",
  }));
  const genreNames = recommendationGenres.map((genre) => genre.name);

  if (movies.length === 0) {
    return (
      <RecommendationMessage>
        <p>
          There are no fresh TMDB titles for your top genres right now. Your
          current My Cinema titles are excluded from these picks.
        </p>
        <p className="mt-3">
          Your strongest genre signals: {genreNames.join(", ")}.
        </p>
      </RecommendationMessage>
    );
  }

  return (
    <MovieShelf
      id="personalized-recommendations-title"
      eyebrow="BASED ON YOUR PRIVATE CINEMA"
      title="Picked for your next movie night."
      description="A simple, explainable match from your real viewing activity and TMDB movie genres."
      movies={movies}
    >
      <p className="mt-8 text-sm leading-6 text-muted">
        Because your recent Watching, Finished, or 4–5-star films lean toward{" "}
        <span className="text-foreground">{genreNames.join(", ")}</span>. Picks
        use TMDB popularity within those genres and leave out every movie
        already in your collection. This is a genre-based rule, not an AI
        prediction.
      </p>
    </MovieShelf>
  );
}
