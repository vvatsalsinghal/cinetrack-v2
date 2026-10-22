import MovieSearchForm from "@/components/MovieSearchForm";
import MovieSearchResults from "@/components/MovieSearchResults";

export default async function SearchContent({ searchParams }) {
  const { q } = await searchParams;
  const queryValue = Array.isArray(q) ? q[0] : q;
  const query = typeof queryValue === "string" ? queryValue.trim() : "";

  return (
    <>
      <MovieSearchForm initialQuery={query} />
      <div className="mt-12">
        <MovieSearchResults query={query} />
      </div>
    </>
  );
}
