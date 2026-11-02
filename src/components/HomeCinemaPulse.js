import Link from "next/link";
import SectionHeading from "@/components/SectionHeading";
import { NewsCard } from "@/components/CinemaPulse";
import { CineTrackApiError, getApiNewsArticles } from "@/lib/cinetrackApi";

export default async function HomeCinemaPulse() {
  let articles = [];

  try {
    const data = await getApiNewsArticles({
      region: "india",
      language: "all",
      limit: 3,
    });
    articles = data.articles.slice(0, 3);
  } catch (error) {
    if (!(error instanceof CineTrackApiError)) {
      console.error("Unexpected error loading homepage Cinema Pulse:", error);
    }
  }

  return (
    <section
      aria-labelledby="home-cinema-pulse-title"
      className="border-t border-line bg-surface/40"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
        <div className="mb-10 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            id="home-cinema-pulse-title"
            eyebrow="INDIAN CINEMA DISPATCHES & HEADLINES"
            title="Cinema Pulse."
          />
          <Link
            href="/news"
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-accent/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Explore all cinema news <span aria-hidden="true">→</span>
          </Link>
        </div>

        {articles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {articles.map((article, index) => (
              <NewsCard
                key={`${article.id}-${article.url || index}`}
                article={article}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface/60 p-6 text-center text-sm text-muted">
            <p>
              Cinema news is loading from the API. Visit{" "}
              <Link href="/news" className="font-semibold text-accent underline">
                Cinema Pulse
              </Link>{" "}
              to filter stories by region and language.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
