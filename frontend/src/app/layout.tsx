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
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}