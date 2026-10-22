import Link from "next/link";
import { CineTrackApiError, getApiNewsArticles } from "@/lib/cinetrackApi";

const REGION_OPTIONS = [
  { value: "all", label: "All Regions" },
  { value: "india", label: "India" },
  { value: "global", label: "Global / Hollywood" },
];

const LANGUAGE_OPTIONS = [
  { value: "all", label: "All Languages" },
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi (हिन्दी)" },
  { value: "ta", label: "Tamil (தமிழ்)" },
  { value: "te", label: "Telugu (తెలుగు)" },
];

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

function NewsCard({ article }) {
  const formattedDate = formatDate(article.publishedAt);
  const regionLabel = article.region === "india" ? "India" : "Global";
  const languageLabel =
    article.language === "hi"
      ? "Hindi"
      : article.language === "ta"
        ? "Tamil"
        : article.language === "te"
          ? "Telugu"
          : "English";

  return (
    <article className="group flex flex-col justify-between overflow-hidden rounded-xl border border-line bg-surface/60 transition-all hover:border-line/80 hover:bg-surface/90">
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

          <h2 className="text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {article.title}
            </a>
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-muted line-clamp-3">
            {article.summary}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line/50 px-5 py-3.5 text-xs text-muted sm:px-6">
        <time dateTime={article.publishedAt}>{formattedDate}</time>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-accent"
          aria-label={`Read full story: ${article.title} (opens in new tab)`}
        >
          Read story <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}

export default async function CinemaPulse({ searchParams }) {
  const query = await searchParams;
  const region = typeof query?.region === "string" ? query.region : "all";
  const language = typeof query?.language === "string" ? query.language : "all";

  let result;
  let loadError = null;

  try {
    result = await getApiNewsArticles({
      region,
      language,
      limit: 24,
    });
  } catch (error) {
    if (error instanceof CineTrackApiError) {
      loadError = error.message;
    } else {
      loadError = "Could not load cinema news. Try again later.";
    }
  }

  const buildFilterHref = (newRegion, newLanguage) => {
    const params = new URLSearchParams();
    if (newRegion && newRegion !== "all") {
      params.set("region", newRegion);
    }
    if (newLanguage && newLanguage !== "all") {
      params.set("language", newLanguage);
    }
    const queryString = params.toString();
    return queryString ? `/news?${queryString}` : "/news";
  };

  return (
    <div>
      {/* Filter Section */}
      <section
        aria-label="Filter cinema news by region and language"
        className="mb-10 space-y-5 rounded-2xl border border-line bg-surface/50 p-5 sm:p-6"
      >
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Region
          </p>
          <div className="flex flex-wrap gap-2">
            {REGION_OPTIONS.map((opt) => {
              const isActive = region === opt.value;
              return (
                <Link
                  key={opt.value}
                  href={buildFilterHref(opt.value, language)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-ink font-semibold"
                      : "border border-line bg-background/50 text-muted hover:border-line/80 hover:text-foreground"
                  }`}
                  aria-pressed={isActive}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Language
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((opt) => {
              const isActive = language === opt.value;
              return (
                <Link
                  key={opt.value}
                  href={buildFilterHref(region, opt.value)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-ink font-semibold"
                      : "border border-line bg-background/50 text-muted hover:border-line/80 hover:text-foreground"
                  }`}
                  aria-pressed={isActive}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Error state */}
      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-line bg-surface/80 p-6 text-center text-sm leading-7 text-muted"
        >
          <p className="font-medium text-foreground">{loadError}</p>
          <p className="mt-2 text-xs">
            Start the CineTrack API with{" "}
            <code className="rounded bg-background px-1.5 py-0.5 font-mono text-accent">
              npm run dev:api
            </code>{" "}
            in a second terminal.
          </p>
        </div>
      )}

      {/* Content state */}
      {!loadError && result && (
        <>
          {result.articles.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {result.articles.map((article, index) => (
                <NewsCard
                  key={`${article.id}-${article.url || index}`}
                  article={article}
                />
              ))}
            </div>
          ) : (
            <div
              role="status"
              className="rounded-xl border border-line bg-surface/50 px-6 py-12 text-center"
            >
              <p className="text-base font-medium text-foreground">
                No cinema news found matching these filters.
              </p>
              <p className="mt-2 text-sm text-muted">
                Try selecting &ldquo;All Regions&rdquo; or &ldquo;All
                Languages&rdquo; to browse other stories.
              </p>
              <Link
                href="/news"
                className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-accent px-4 text-xs font-semibold text-ink transition-opacity hover:opacity-90"
              >
                Reset filters
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

