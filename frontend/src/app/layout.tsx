import type { Metadata } from "next";
import "@cloudscape-design/global-styles/index.css";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { SettingsProvider } from "@/providers/SettingsProvider";

export const metadata: Metadata = {
  title: {
    default: "Route 53 Clone",
    template: "%s | Route 53 Clone",
  },
  description:
    "Demo clone of the AWS Route 53 console. Not affiliated with Amazon Web Services.",
};

// Runs before first paint: applies the persisted dark/compact body classes so
// there is no light flash. Must mirror what applyMode/applyDensity toggle.
const THEME_BOOTSTRAP = `(function(){try{var s=JSON.parse(localStorage.getItem("r53.settings")||"{}");var m=s.mode||"browser";var dark=m==="dark"||(m!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(dark)document.body.classList.add("awsui-dark-mode");if(s.density==="compact")document.body.classList.add("awsui-compact-mode");}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      {/* The bootstrap script mutates body classes pre-hydration. */}
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <SettingsProvider>
          <QueryProvider>{children}</QueryProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
