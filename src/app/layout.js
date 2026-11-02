import "./globals.css";
import { CineTrackProvider } from "@/components/CineTrackProvider";
import CinemaChatbot from "@/components/CinemaChatbot";
import CinemaAmbientBackground from "@/components/CinemaAmbientBackground";
import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  title: "CineTrack — Your personal cinema companion",
  description:
    "Discover stories for the moment and make every movie night feel more personal with CineTrack.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>
        <CineTrackProvider>
          <CinemaAmbientBackground />
          <SiteHeader />
          {children}
          <CinemaChatbot />
        </CineTrackProvider>
      </body>
    </html>
  );
}
