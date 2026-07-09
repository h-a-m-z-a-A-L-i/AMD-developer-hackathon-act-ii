import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "GlycoSwarm AI - Diabetic Complication Swarm",
  description: "Multi-agent clinical dashboard for diabetic complication risk triage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${GeistMono.variable}`}>
      <head>
        {/* Runs before paint so the theme is correct on first frame — no flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = localStorage.getItem('glycoswarm-theme');
                  // Dark mode is the default for new visitors. Once someone
                  // explicitly toggles the theme, that stored choice wins.
                  var isDark = stored ? stored === 'dark' : true;
                  if (isDark) document.documentElement.classList.add('dark');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-[#0b1120] dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}