import { prisma } from "@/lib/prisma";
import { AdSlotClient } from "./AdSlotClient";

export async function AdSlot({
  placement,
  hide,
}: {
  placement: string;
  hide?: boolean;
}) {
  if (hide) return null;

  const [globalSetting, slot] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "adsEnabled" } }),
    prisma.adPlacement.findUnique({
      where: { key: placement },
      include: {
        ads: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ]);

  if (globalSetting?.value === "false" || !slot || !slot.isActive) {
    return null;
  }

  const now = new Date();
  const activeAds = slot.ads
    .filter((a) => {
      if (a.startDate && a.startDate > now) return false;
      if (a.endDate && a.endDate < now) return false;
      return true;
    })
    .map((a) => ({
      id: a.id,
      title: a.title,
      imageUrl: a.imageUrl,
      targetUrl: a.targetUrl,
    }));

  if (slot.type === "CUSTOM" && activeAds.length === 0) return null;
  if (slot.type === "ADSENSE" && !slot.adCode) return null;

  return (
    <AdSlotClient
      placementId={slot.id}
      placementKey={slot.key}
      type={slot.type as "ADSENSE" | "CUSTOM"}
      adCode={slot.adCode}
      ads={activeAds}
    />
  );
}
