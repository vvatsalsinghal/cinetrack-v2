import Link from "next/link";
import {
  DISCOVERY_MOODS,
  DISCOVERY_RUNTIME_OPTIONS,
} from "@/lib/discoveryOptions";

export default function HomeDiscoveryForm() {
  return (
    <section
      aria-labelledby="home-discovery-title"
      className="border-t border-line"
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center lg:px-10 lg:py-14">
        <div>
          <p className="eyebrow mb-3">
            <span aria-hidden="true" />
            SET THE SCENE
          </p>
          <h2
            id="home-discovery-title"
            className="text-2xl font-medium tracking-tight sm:text-3xl"
          >
            What are you in the mood for?
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted">
            Pick a genre-inspired mood and your available time to find matching
            movies.
          </p>
        </div>
        <form
          action="/discover"
          method="get"
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <div>
            <label
              htmlFor="home-discovery-mood"
              className="mb-2 block text-xs font-medium text-muted"
            >
              Mood
            </label>
            <select
              id="home-discovery-mood"
              name="mood"
              defaultValue=""
              className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
              htmlFor="home-discovery-runtime"
              className="mb-2 block text-xs font-medium text-muted"
            >
              Available time
            </label>
            <select
              id="home-discovery-runtime"
              name="runtime"
              defaultValue=""
              className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
            className="min-h-11 self-end rounded-lg bg-accent px-5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Find a movie
          </button>
          <p className="text-xs leading-5 text-muted sm:col-span-3">
            Mood choices match TMDB genres; they are not personalized
            recommendations.{" "}
            <Link
              href="/discover"
              className="text-foreground underline underline-offset-4 hover:text-accent"
            >
              Browse all movies
            </Link>
          </p>
        </form>
      </div>
    </section>
  );
}
