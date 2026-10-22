export default function MovieSearchForm({ initialQuery = "" }) {
  return (
    <form action="/search" method="get" className="mx-auto max-w-2xl">
      <label
        htmlFor="movie-search"
        className="mb-3 block text-sm font-medium text-foreground"
      >
        Find a movie
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="movie-search"
          type="search"
          name="q"
          defaultValue={initialQuery}
          minLength={2}
          maxLength={100}
          required
          placeholder="Search movie titles"
          className="min-h-12 min-w-0 flex-1 rounded-lg border border-line bg-background px-4 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          className="min-h-12 rounded-lg bg-accent px-6 text-sm font-semibold text-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Search movies
        </button>
      </div>
    </form>
  );
}
