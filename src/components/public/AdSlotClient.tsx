"use client";

import { useEffect, useRef, useState } from "react";

interface AdItem {
  id: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
}

interface AdSlotClientProps {
  placementId: string;
  placementKey: string;
  type: "ADSENSE" | "CUSTOM";
  adCode?: string | null;
  ads: AdItem[];
}

const SLOT_CONTAINER_CLASS: Record<string, string> = {
  "header-leaderboard": "min-h-[80px] w-full",
  "sidebar-top": "min-h-[80px] w-full",
  "sidebar-sticky": "min-h-[80px] w-full",
  "in-article-2": "min-h-[85px] w-full",
  "in-article-5": "min-h-[85px] w-full",
  "list-between": "min-h-[85px] w-full",
  "footer-mobile": "min-h-[50px] w-full max-w-[440px] px-2",
};

const SLOT_IMG_CLASS: Record<string, string> = {
  "header-leaderboard": "w-full h-[80px] sm:h-[140px] md:h-[180px] lg:h-[220px] object-cover object-center",
  "sidebar-top": "w-full h-auto max-h-[260px] object-contain",
  "sidebar-sticky": "w-full h-auto max-h-[560px] object-contain",
  "in-article-2": "w-full h-[85px] sm:h-[125px] md:h-[150px] object-cover object-center",
  "in-article-5": "w-full h-[85px] sm:h-[125px] md:h-[150px] object-cover object-center",
  "list-between": "w-full h-[85px] sm:h-[125px] md:h-[155px] object-cover object-center",
  "footer-mobile": "w-full h-[56px] sm:h-[64px] object-cover object-center",
};

const ROTATION_INTERVAL_MS = 6000;

export function AdSlotClient({
  placementId,
  placementKey,
  type,
  adCode,
  ads,
}: AdSlotClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const trackedIdsRef = useRef<Set<string>>(new Set());

  const currentAd = ads.length > 0 ? ads[activeIndex % ads.length] : null;

  // Observe container entering viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "150px", threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Track impression once per ad ID when visible
  useEffect(() => {
    if (!visible) return;
    const trackKey = type === "CUSTOM" ? currentAd?.id ?? "none" : "adsense";
    if (trackKey === "none" || trackedIdsRef.current.has(trackKey)) return;

    trackedIdsRef.current.add(trackKey);
    fetch("/api/public/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placementId,
        adId: type === "CUSTOM" ? currentAd?.id ?? null : null,
        event: "impression",
      }),
    }).catch(() => {});
  }, [visible, type, placementId, currentAd?.id]);

  // Auto-rotate multiple active ads on the same placement
  useEffect(() => {
    if (!visible || type !== "CUSTOM" || ads.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % ads.length);
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [visible, type, ads.length, paused]);

  function handleClick() {
    fetch("/api/public/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placementId,
        adId: currentAd?.id ?? null,
        event: "click",
      }),
      keepalive: true,
    }).catch(() => {});
  }

  const sizeClass = SLOT_CONTAINER_CLASS[placementKey] ?? "min-h-[90px] w-full";
  const imgSizeClass = SLOT_IMG_CLASS[placementKey] ?? "max-h-[140px] w-auto max-w-full object-contain";

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`flex flex-col items-center justify-center overflow-hidden ${sizeClass}`}
    >
      {visible && type === "CUSTOM" && currentAd && (
        <div className="w-full text-center">
          <a
            href={currentAd.targetUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={handleClick}
            className="block w-full text-center group"
          >
            <span className="block text-[9px] uppercase tracking-wider text-slate-400 mb-0.5">
              Advertisement
            </span>
            <img
              src={currentAd.imageUrl}
              alt={currentAd.title}
              loading="lazy"
              className={`mx-auto rounded border border-slate-200 ${imgSizeClass}`}
            />
          </a>
          {ads.length > 1 && (
            <div className="flex items-center justify-center gap-1 mt-1">
              {ads.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Show ad ${idx + 1}`}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === activeIndex % ads.length
                      ? "w-4 bg-red-700"
                      : "w-1.5 bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {visible && type === "ADSENSE" && adCode && (
        <div
          className="w-full text-center"
          dangerouslySetInnerHTML={{ __html: adCode }}
        />
      )}
    </div>
  );
}
