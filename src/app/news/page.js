import { Suspense } from "react";
import Link from "next/link";
import CinemaPulse from "@/components/CinemaPulse";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  title: "Cinema Pulse — Regional & Global Cinema News | CineTrack",
  description:
    "Follow breaking film updates, festival dispatches, and industry headlines tailored by region and language.",
};

function NewsLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading cinema news">
      <div className="h-28 animate-pulse rounded-2xl bg-surface/40" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col space-y-4 rounded-xl border border-line bg-surface/40 p-5"
          >
            <div className="aspect-video w-full animate-pulse rounded-lg bg-surface/60" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-surface/60" />
            <div className="h-3 w-full animate-pulse rounded bg-surface/50" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-surface/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NewsPage({ searchParams }) {
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
            CURATED RSS FEEDS · REGIONAL &amp; GLOBAL
          </p>
          <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
            Cinema Pulse.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
            Stay plugged into movie journalism, festival buzz, and industry
            stories tailored by region and language.
          </p>
        </div>
        <Suspense fallback={<NewsLoading />}>
          <CinemaPulse searchParams={searchParams} />
        </Suspense>
      </section>
      <SiteFooter />
    </main>
  );
}

