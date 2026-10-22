import MovieGrid from "@/components/MovieGrid";
import SectionHeading from "@/components/SectionHeading";

export default function MovieShelf({
  id,
  eyebrow,
  title,
  description,
  movies,
  children,
}) {
  return (
    <section aria-labelledby={id} className="border-t border-line">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
        <div className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading id={id} eyebrow={eyebrow} title={title} />
          <p className="max-w-sm text-sm leading-7 text-muted">{description}</p>
        </div>

        <MovieGrid movies={movies} />
        {children}
      </div>
    </section>
  );
}
