import MovieCard from "@/components/MovieCard";

export default function MovieGrid({ movies }) {
  if (movies.length === 0) {
    return (
      <p
        role="status"
        className="rounded-xl border border-line bg-surface px-5 py-8 text-sm text-muted"
      >
        No movies are available in this shelf right now.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} />
      ))}
    </div>
  );
}
