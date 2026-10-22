import Link from "next/link";
import MyCinemaCollection from "@/components/MyCinemaCollection";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  title: "My Cinema | CineTrack",
  description: "Your private collection of saved, watching, and finished movies.",
};

export default function MyCinemaPage() {
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
        <div className="py-10">
          <p className="eyebrow mb-4">
            <span aria-hidden="true" />
            YOUR PERSONAL COLLECTION
          </p>
          <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
            My Cinema.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
            One private collection for saved, watching, and finished movies.
          </p>
        </div>
        <MyCinemaCollection />
      </section>
      <SiteFooter />
    </main>
  );
}
