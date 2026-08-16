import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Clanio - Enterprise HR Management System | Sign In",
  description: "The Complete HR Management System for Modern Teams. Streamline your HR processes, empower employees, and grow your organization with Clanio.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e9edf9' },
    { media: '(prefers-color-scheme: dark)', color: '#1a2133' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-[#FAF7FF] text-slate-900 selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  )
}

