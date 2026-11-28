import Link from "next/link";
import { getNavData } from "@/lib/news-queries";
import { AdSlot } from "./AdSlot";

export async function SiteFooter({ siteName }: { siteName?: string }) {
  const nav = siteName ? null : await getNavData();
  const displayName = siteName || nav?.siteName || "धमाका 24*7";

  return (
    <>
      <footer className="bg-slate-900 text-slate-300 mt-12 border-t-4 border-red-700 pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="text-xl font-extrabold text-white mb-2">{displayName}</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              मध्य प्रदेश, देश और दुनिया की विश्वसनीय, तेज और निष्पक्ष खबरें। भोपाल, इंदौर, ग्वालियर, जबलपुर, उज्जैन सहित हर शहर की ताजा अपडेट।
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-3 text-xs uppercase tracking-wider">प्रमुख श्रेणियां</h4>
            <ul className="space-y-1.5 text-xs">
              <li><Link href="/category/madhya-pradesh" className="hover:text-white">मध्य प्रदेश</Link></li>
              <li><Link href="/category/india" className="hover:text-white">देश</Link></li>
              <li><Link href="/category/world" className="hover:text-white">विदेश</Link></li>
              <li><Link href="/category/sports" className="hover:text-white">खेल</Link></li>
              <li><Link href="/category/business" className="hover:text-white">बिजनेस</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-3 text-xs uppercase tracking-wider">अन्य लिंक</h4>
            <ul className="space-y-1.5 text-xs">
              <li><Link href="/sitemap.xml" className="hover:text-white">Sitemap</Link></li>
              <li><Link href="/news-sitemap.xml" className="hover:text-white">Google News Sitemap</Link></li>
              <li><Link href="/rss.xml" className="hover:text-white">RSS Feed</Link></li>
              <li><Link href="/ads.txt" className="hover:text-white">ads.txt</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {displayName}. All rights reserved.
        </div>
      </footer>

      {/* Sticky Mobile Footer Ad */}
      <div className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-white border-t border-slate-200 flex justify-center py-1 shadow-lg">
        <AdSlot placement="footer-mobile" />
      </div>
    </>
  );
}
