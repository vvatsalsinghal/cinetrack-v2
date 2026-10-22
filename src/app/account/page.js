import AccountPanel from "@/components/AccountPanel";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  title: "Your Account | CineTrack",
  description: "Sign in to keep your private My Cinema collection in sync.",
};

export default function AccountPage() {
  return (
    <main id="main-content" className="relative isolate min-h-screen overflow-hidden">
      <div aria-hidden="true" className="cinema-grid pointer-events-none" />
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-12 lg:px-10 lg:pb-20">
        <p className="eyebrow mb-4">
          <span aria-hidden="true" />
          YOUR PRIVATE CINEMA
        </p>
        <h1 className="mb-4 text-4xl font-medium tracking-tight sm:text-5xl">
          Your account.
        </h1>
        <p className="mb-10 max-w-xl text-sm leading-7 text-muted">
          Create an account to keep your viewing activity and personal notes
          together across sessions.
        </p>
        <AccountPanel />
      </section>
      <SiteFooter />
    </main>
  );
}
