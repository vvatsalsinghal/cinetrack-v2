import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import MovieTrailer from "@/components/MovieTrailer";
import SaveForLaterButton from "@/components/SaveForLaterButton";
import MovieWatchProviders from "@/components/MovieWatchProviders";
import { CineTrackApiError, getApiMovieDetails } from "@/lib/cinetrackApi";

function MovieDetailsLoading() {
  return (
    <p role="status" className="text-sm text-muted">
      Loading movie details…
    </p>
  );
}

async function MovieDetails({ params }) {
  const { id } = await params;
  let movie;

  try {
    movie = await getApiMovieDetails(id);
  } catch (error) {
    if (!(error instanceof CineTrackApiError)) {
      throw error;
    }

    if (error.status === 404) {
      notFound();
    }

    return (
      <p
        role="alert"
        className="rounded-xl border border-line bg-surface px-5 py-6 text-sm leading-7 text-muted"
      >
        {error.message}
      </p>
    );
  }

  const releaseYear = movie.releaseDate?.slice(0, 4);
  const runtimeLabel = movie.runtime
    ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`
    : null;

  return (
    <article className="grid gap-8 md:grid-cols-[minmax(220px,320px)_1fr] md:gap-12">
      <div className="movie-art relative aspect-[2/3] overflow-hidden rounded-xl">
        {movie.posterUrl ? (
          <Image
            src={movie.posterUrl}
            alt={`Poster for ${movie.title}`}
            fill
            sizes="(max-width: 768px) 70vw, 320px"
            className="object-cover"
          />
        ) : (
          <span className="movie-art-label">POSTER UNAVAILABLE</span>
        )}
      </div>
      <div className="self-center">
        <p className="eyebrow mb-4">
          <span aria-hidden="true" />
          EXPRESS API · TMDB MOVIE DETAILS
        </p>
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
          {movie.title}
        </h1>
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
          {releaseYear && <span>{releaseYear}</span>}
          {runtimeLabel && <span>{runtimeLabel}</span>}
          {movie.voteAverage !== null && (
            <span>TMDB rating {movie.voteAverage.toFixed(1)} / 10</span>
          )}
        </div>
        {movie.genres.length > 0 && (
          <p className="mt-4 text-sm text-muted">{movie.genres.join(" · ")}</p>
        )}
        <h2 className="mt-10 text-lg font-medium">Overview</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
          {movie.overview || "TMDB has not provided an overview for this movie."}
        </p>
        <Suspense
          fallback={
            <p role="status" className="mt-10 text-sm text-muted">
              Loading streaming availability for India…
            </p>
          }
        >
          <MovieWatchProviders movieId={id} />
        </Suspense>
        <MovieTrailer
          movieTitle={movie.title}
          trailerKey={movie.trailerKey}
        />
        <SaveForLaterButton
          movie={{
            id: movie.id,
            title: movie.title,
            posterUrl: movie.posterUrl,
            releaseYear,
          }}
        />
      </div>
    </article>
  );
}

export default function MovieDetailsPage({ params }) {
  return (
    <main id="main-content" className="min-h-screen">
      <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-10">
        <Link
          href="/"
          className="text-sm text-muted transition-colors hover:text-foreground"
        >
          ← Back to CineTrack
        </Link>
        <div className="mt-10">
          <Suspense fallback={<MovieDetailsLoading />}>
            <MovieDetails params={params} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
