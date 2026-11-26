"use client";

import { useEffect, useRef, useState } from "react";

interface AdSlotClientProps {
  placementId: string;
  placementKey: string;
  type: "ADSENSE" | "CUSTOM";
  adCode?: string | null;
  ad?: {
    id: string;
    title: string;
    imageUrl: string;
    targetUrl: string;
  } | null;
}

const RESERVED_HEIGHT: Record<string, string> = {
  "header-leaderboard": "min-h-[90px] w-[728px] max-w-full",
  "sidebar-top": "min-h-[250px] w-full",
  "sidebar-sticky": "min-h-[250px] w-full",
  "in-article-2": "min-h-[100px] w-full",
  "in-article-5": "min-h-[100px] w-full",
  "list-between": "min-h-[90px] w-full",
  "footer-mobile": "min-h-[50px] w-[320px] max-w-full",
};

export function AdSlotClient({
  placementId,
  placementKey,
  type,
  adCode,
  ad,
}: AdSlotClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const trackedRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          if (!trackedRef.current) {
            trackedRef.current = true;
            fetch("/api/public/ads/track", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                placementId,
                adId: ad?.id ?? null,
                event: "impression",
              }),
            }).catch(() => {});
          }
          observer.disconnect();
        }
      },
      { rootMargin: "150px", threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [placementId, ad?.id]);

  function handleClick() {
    fetch("/api/public/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placementId,
        adId: ad?.id ?? null,
        event: "click",
      }),
      keepalive: true,
    }).catch(() => {});
  }

  const sizeClass = RESERVED_HEIGHT[placementKey] ?? "min-h-[90px] w-full";

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center justify-center overflow-hidden ${sizeClass}`}
    >
      {visible && type === "CUSTOM" && ad && (
        <a
          href={ad.targetUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          className="block w-full text-center group"
        >
          <span className="block text-[9px] uppercase tracking-wider text-slate-400 mb-0.5">
            Advertisement
          </span>
          <img
            src={ad.imageUrl}
            alt={ad.title}
            loading="lazy"
            className="mx-auto max-w-full h-auto rounded border border-slate-200"
          />
        </a>
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
