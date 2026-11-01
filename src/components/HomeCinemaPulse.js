import Link from "next/link";
import SectionHeading from "@/components/SectionHeading";
import { CineTrackApiError, getApiNewsArticles } from "@/lib/cinetrackApi";

function formatDate(isoString) {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "";
  }
}

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
            {articles.map((article, index) => {
              const regionLabel =
                article.region === "india" ? "India" : "Global";
              const languageLabel =
                article.language === "hi"
                  ? "Hindi"
                  : article.language === "ta"
                    ? "Tamil"
                    : article.language === "te"
                      ? "Telugu"
                      : "English";

              return (
                <article
                  key={`${article.id}-${article.url || index}`}
                  className="group flex flex-col justify-between overflow-hidden rounded-xl border border-line bg-surface/70 transition-all hover:border-line/80 hover:bg-surface/90"
                >
                  <div>
                    {article.imageUrl ? (
                      <div className="relative aspect-video w-full overflow-hidden bg-background">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={article.imageUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="relative flex aspect-video w-full items-center justify-center bg-surface/80 p-6 text-center">
                        <span
                          aria-hidden="true"
                          className="text-xs uppercase tracking-widest text-muted/60"
                        >
                          Cinema Dispatch
                        </span>
                      </div>
                    )}

                    <div className="p-5 sm:p-6">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                          {article.source}
                        </span>
                        <span className="rounded-md border border-line bg-background/50 px-2 py-0.5 text-xs text-muted">
                          {regionLabel} · {languageLabel}
                        </span>
                      </div>

                      <h3 className="text-base font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-accent">
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          {article.title}
                        </a>
                      </h3>

                      <p className="mt-2 text-xs leading-relaxed text-muted line-clamp-3">
                        {article.summary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-line/50 px-5 py-3 text-xs text-muted sm:px-6">
                    <time dateTime={article.publishedAt}>
                      {formatDate(article.publishedAt)}
                    </time>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-accent"
                      aria-label={`Read story: ${article.title} (opens in new tab)`}
                    >
                      Read story <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </article>
              );
            })}
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

