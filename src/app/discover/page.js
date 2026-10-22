import { Suspense } from "react";
import Link from "next/link";
import PopularMovieDiscovery from "@/components/PopularMovieDiscovery";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  title: "Discover Movies | CineTrack",
  description:
    "Browse popular movies from TMDB, with up to 12 unique films on each page.",
};

function DiscoveryLoading() {
  return (
    <p role="status" className="text-sm text-muted">
      Loading movie discovery…
    </p>
  );
}

export default function DiscoverPage({ searchParams }) {
  return (
    <main id="main-content" className="relative isolate min-h-screen overflow-hidden">
      <div aria-hidden="true" className="cinema-grid pointer-events-none" />
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-8 lg:px-10 lg:pb-20">
        <Link
          href="/"
          className="text-sm text-muted transition-colors hover:text-foreground"
        >
          ← Back to CineTrack
        </Link>
        <div className="py-10">
          <p className="eyebrow mb-4">
            <span aria-hidden="true" />
            EXPRESS API · TMDB DISCOVERY
          </p>
          <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
            Find your next film.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
            Browse popular movies or narrow the list by a simple mood shortcut
            and how much time you have.
          </p>
        </div>
        <Suspense fallback={<DiscoveryLoading />}>
          <PopularMovieDiscovery searchParams={searchParams} />
        </Suspense>
      </section>
      <SiteFooter />
    </main>
  );
}
