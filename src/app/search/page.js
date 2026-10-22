import { Suspense } from "react";
import Link from "next/link";
import SearchContent from "@/components/SearchContent";

function SearchContentLoading() {
  return (
    <div>
      <p role="status" className="text-sm text-muted">
        Loading search…
      </p>
      <div className="mt-6">
        <p className="mb-3 block text-sm font-medium text-foreground">
          Find a movie
        </p>
        <div className="h-12 animate-pulse rounded-lg border border-line bg-surface" />
      </div>
    </div>
  );
}

export default function SearchPage({ searchParams }) {
  return (
    <main id="main-content" className="min-h-screen">
      <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-10">
        <Link
          href="/"
          className="text-sm text-muted transition-colors hover:text-foreground"
        >
          ← Back to CineTrack
        </Link>
        <div className="py-10">
          <p className="eyebrow mb-4">
            <span aria-hidden="true" />
            TMDB DISCOVERY
          </p>
          <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
            Search movies.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
            Search flow: this page sends your title to the Express API, which
            contacts TMDB and returns movie data. The TMDB token stays on the
            API server.
          </p>
        </div>
        <Suspense fallback={<SearchContentLoading />}>
          <SearchContent searchParams={searchParams} />
        </Suspense>
      </section>
    </main>
  );
}
