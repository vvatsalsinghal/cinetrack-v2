import Link from "next/link";
import MovieGrid from "@/components/MovieGrid";
import {
  CineTrackApiError,
  getApiMovieDiscoveryPage,
} from "@/lib/cinetrackApi";
import {
  DISCOVERY_MOODS,
  DISCOVERY_RUNTIME_OPTIONS,
  MAX_DISCOVERY_PAGE,
  normalizeDiscoveryMood,
  normalizeDiscoveryRuntime,
} from "@/lib/discoveryOptions";

function getPageNumber(searchParam) {
  const value = Array.isArray(searchParam) ? searchParam[0] : searchParam;

  if (typeof value !== "string" || !/^[1-9]\d{0,2}$/.test(value)) {
    return 1;
  }

  const page = Number(value);
  return page <= MAX_DISCOVERY_PAGE ? page : 1;
}

export default async function PopularMovieDiscovery({ searchParams }) {
  const query = await searchParams;
  const requestedPage = getPageNumber(query.page);
  const mood = normalizeDiscoveryMood(
    Array.isArray(query.mood) ? query.mood[0] : query.mood,
  );
  const maxRuntime = normalizeDiscoveryRuntime(
    Array.isArray(query.runtime) ? query.runtime[0] : query.runtime,
  );
  let result;

  try {
    result = await getApiMovieDiscoveryPage({
      page: requestedPage,
      mood,
      maxRuntime,
    });
  } catch (error) {
    if (!(error instanceof CineTrackApiError)) {
      throw error;
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

  const previousPage = result.page > 1 ? result.page - 1 : null;
  const nextPage =
    result.page < result.totalPages ? result.page + 1 : null;
  const pageHref = (page) => {
    const params = new URLSearchParams();
    if (mood) {
      params.set("mood", mood);
    }
    if (maxRuntime) {
      params.set("runtime", maxRuntime);
    }
    params.set("page", String(page));
    return `/discover?${params.toString()}`;
  };
  const selectedMood = mood ? DISCOVERY_MOODS[mood].label : null;
  const selectedRuntime = DISCOVERY_RUNTIME_OPTIONS.find(
    (option) => option.value === maxRuntime,
  )?.label;

  return (
    <div>
      <form
        action="/discover"
        method="get"
        className="mb-10 rounded-xl border border-line bg-surface/70 p-4 sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <div>
            <label
              htmlFor="discovery-mood"
              className="mb-2 block text-xs font-medium text-muted"
            >
              Mood shortcut
            </label>
            <select
              id="discovery-mood"
              name="mood"
              defaultValue={mood}
              className="min-h-11 w-full rounded-lg border border-line bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <option value="">Any mood</option>
              {Object.entries(DISCOVERY_MOODS).map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="discovery-runtime"
              className="mb-2 block text-xs font-medium text-muted"
            >
              Available time
            </label>
            <select
              id="discovery-runtime"
              name="runtime"
              defaultValue={maxRuntime}
              className="min-h-11 w-full rounded-lg border border-line bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <option value="">Any length</option>
              {DISCOVERY_RUNTIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-accent px-5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Find movies
          </button>
          {(mood || maxRuntime) && (
            <Link
              href="/discover"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Clear
            </Link>
          )}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          Mood shortcuts match TMDB genres; they are not personalized
          recommendations. Runtime limits use TMDB movie runtimes.
        </p>
      </form>
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-muted">
          {mood || maxRuntime
            ? "Movies matching these filters from TMDB"
            : `${result.totalResults.toLocaleString()} popular movies from TMDB`}
        </p>
        <p className="text-xs text-muted">
          {mood || maxRuntime
            ? `Page ${result.page}`
            : `Page ${result.page} of ${result.totalPages}`}
        </p>
      </div>
      {(selectedMood || selectedRuntime) && (
        <p className="mb-5 text-sm text-muted">
          Filters: {[selectedMood, selectedRuntime].filter(Boolean).join(" · ")}
        </p>
      )}
      {result.movies.length > 0 ? (
        <MovieGrid movies={result.movies} />
      ) : (
        <p
          role="status"
          className="rounded-xl border border-line bg-surface px-5 py-8 text-sm text-muted"
        >
          {mood || maxRuntime
            ? "No movies matched these filters on this page. Try another combination or go to the previous page."
            : "No popular movies were returned for this page."}
        </p>
      )}
      <nav
        aria-label="Popular movies pages"
        className="mt-10 flex items-center justify-between border-t border-line pt-6"
      >
        {previousPage ? (
          <Link
            href={pageHref(previousPage)}
            rel="prev"
            className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {nextPage ? (
          <Link
            href={pageHref(nextPage)}
            rel="next"
            className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Next page →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
