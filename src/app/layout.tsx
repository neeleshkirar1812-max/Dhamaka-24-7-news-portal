import type { Metadata } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "धमाका 24*7 | मध्य प्रदेश, देश और दुनिया की ताजा खबरें",
    template: "%s | धमाका 24*7",
  },
  description:
    "धमाका 24*7 — मध्य प्रदेश के सभी शहरों (भोपाल, इंदौर, ग्वालियर, जबलपुर, उज्जैन) और देश-दुनिया की ताजा खबरें, विश्लेषण और ब्रेकिंग न्यूज़।",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="hi"
      suppressHydrationWarning
      className={`${inter.variable} ${notoDevanagari.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans"
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
