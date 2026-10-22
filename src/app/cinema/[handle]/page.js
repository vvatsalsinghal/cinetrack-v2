import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { CineTrackApiError, getApiPublicCinema } from "@/lib/cinetrackApi";

export async function generateMetadata({ params }) {
  const { handle } = await params;
  return {
    title: `@${handle}'s Cinema | CineTrack`,
    description: `Browse @${handle}'s curated movie collection on CineTrack.`,
  };
}

const statusLabels = {
  saved: "Saved for later",
  watching: "Watching",
  finished: "Finished",
};

const statusBadgeClasses = {
  saved: "bg-surface text-muted border border-line",
  watching: "bg-accent/15 text-accent font-medium",
  finished: "bg-emerald-500/15 text-emerald-400 font-medium",
};

function StarRating({ rating }) {
  if (!rating) return null;
  return (
    <div
      className="flex items-center gap-1 text-accent"
      aria-label={`Personal rating: ${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={`text-sm ${
            index < rating ? "opacity-100" : "opacity-20"
          }`}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </div>
  );
}

function PublicCinemaLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading collection">
      <div className="h-20 animate-pulse rounded-2xl bg-surface/40" />
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col space-y-3 rounded-xl border border-line bg-surface/40 p-4"
          >
            <div className="aspect-[2/3] w-full animate-pulse rounded-lg bg-surface/60" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-surface/60" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function PublicCinemaContent({ params, searchParams }) {
  const { handle } = await params;
  const query = await searchParams;
  const statusFilter = typeof query?.status === "string" ? query.status : "all";

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("cinetrack_session")?.value;
  const cookieHeader = sessionToken
    ? `cinetrack_session=${sessionToken}`
    : undefined;

  let cinemaData = null;
  let accessError = null;

  try {
    cinemaData = await getApiPublicCinema(handle, { cookie: cookieHeader });
  } catch (error) {
    if (error instanceof CineTrackApiError) {
      accessError = error;
    } else {
      accessError = new CineTrackApiError(
        "Could not load this cinema collection.",
        500,
      );
    }
  }

  if (accessError) {
    const isPrivate = accessError.status === 403;
    const isFriendsOnly =
      isPrivate && accessError.message.toLowerCase().includes("friends");
    const isNotFound = accessError.status === 404;

    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface text-2xl text-muted">
          {isPrivate ? "🔒" : "🎬"}
        </div>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
          {isFriendsOnly
            ? `@${handle}'s cinema is for friends only.`
            : isPrivate
              ? `@${handle}'s cinema is private.`
              : isNotFound
                ? "Curator not found."
                : "Unable to load collection."}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted">
          {isFriendsOnly
            ? `This collection is only visible to accepted friends on CineTrack. Connect with @${handle} on your account to view their movies.`
            : isPrivate
              ? "The curator has set their My Cinema collection to private. Only they can view their viewing activity and ratings."
              : isNotFound
                ? `No CineTrack account found with handle @${handle}. Check the spelling or ask them for an updated link.`
                : accessError.message}
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
          >
            Back to CineTrack
          </Link>
          <Link
            href="/discover"
            className="inline-flex min-h-11 items-center rounded-lg border border-line px-5 text-sm font-medium text-foreground transition-colors hover:border-accent"
          >
            Discover movies
          </Link>
        </div>
      </div>
    );
  }

  const { user, movies } = cinemaData;
  const filteredMovies =
    statusFilter === "all"
      ? movies
      : movies.filter((movie) => movie.status === statusFilter);

  const statusCounts = {
    all: movies.length,
    saved: movies.filter((m) => m.status === "saved").length,
    watching: movies.filter((m) => m.status === "watching").length,
    finished: movies.filter((m) => m.status === "finished").length,
  };

  return (
    <>
      {/* Curator Header */}
      <div className="py-6">
        <p className="eyebrow mb-4">
          <span aria-hidden="true" />
          SHARED CINEMA COLLECTION
        </p>
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
          {user.displayName || user.handle}&rsquo;s Cinema.
        </h1>
        <p className="mt-3 text-sm text-accent">@{user.handle}</p>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
          Browsing a shared collection of {movies.length}{" "}
          {movies.length === 1 ? "film" : "films"}. Personal ratings are shown
          where rated.
        </p>
      </div>

      {/* Status Filter Tabs */}
      <div className="mb-8 flex flex-wrap gap-2 border-b border-line pb-4">
        {[
          { id: "all", label: "All titles" },
          { id: "saved", label: "Saved for later" },
          { id: "watching", label: "Watching" },
          { id: "finished", label: "Finished" },
        ].map((tab) => {
          const isActive = statusFilter === tab.id;
          const count = statusCounts[tab.id];
          const href =
            tab.id === "all"
              ? `/cinema/${user.handle}`
              : `/cinema/${user.handle}?status=${tab.id}`;

          return (
            <Link
              key={tab.id}
              href={href}
              className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-accent font-semibold text-ink"
                  : "border border-line bg-surface/50 text-muted hover:border-line/80 hover:text-foreground"
              }`}
            >
              {tab.label} <span className="opacity-70">({count})</span>
            </Link>
          );
        })}
      </div>

      {/* Movies Grid */}
      {filteredMovies.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {filteredMovies.map((movie) => (
            <article
              key={movie.id}
              className="group flex flex-col justify-between overflow-hidden rounded-xl border border-line bg-surface/60 transition-all hover:border-line/80 hover:bg-surface/90"
            >
              <div>
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-background">
                  {movie.posterUrl ? (
                    <Image
                      src={movie.posterUrl}
                      alt={`Poster for ${movie.title}`}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs text-muted">
                      No poster available
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] ${
                        statusBadgeClasses[movie.status] ||
                        "border border-line bg-surface text-muted"
                      }`}
                    >
                      {statusLabels[movie.status] || movie.status}
                    </span>
                    {movie.releaseYear && (
                      <span className="text-xs text-muted">
                        {movie.releaseYear}
                      </span>
                    )}
                  </div>

                  <h2 className="text-base font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-accent">
                    <Link href={`/movie/${movie.id}`}>{movie.title}</Link>
                  </h2>

                  {movie.rating && (
                    <div className="mt-2.5">
                      <StarRating rating={movie.rating} />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-line/40 px-4 py-2.5 text-right sm:px-5">
                <Link
                  href={`/movie/${movie.id}`}
                  className="text-xs font-medium text-muted transition-colors hover:text-accent"
                >
                  View film details →
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface/50 p-12 text-center text-sm text-muted">
          <p>No films found in this status category.</p>
          {statusFilter !== "all" && (
            <Link
              href={`/cinema/${user.handle}`}
              className="mt-4 inline-block font-semibold text-accent underline"
            >
              View all films in collection
            </Link>
          )}
        </div>
      )}
    </>
  );
}

export default function PublicCinemaPage({ params, searchParams }) {
  return (
    <main id="main-content" className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-10">
        <Link
          href="/"
          className="text-sm text-muted transition-colors hover:text-foreground"
        >
          ← Back to CineTrack
        </Link>
        <div className="mt-6">
          <Suspense fallback={<PublicCinemaLoading />}>
            <PublicCinemaContent
              params={params}
              searchParams={searchParams}
            />
          </Suspense>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

