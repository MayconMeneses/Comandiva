import { and, gte, sql } from "drizzle-orm";
import { getDb } from "./client";
import { siteEvents } from "../../drizzle/schema";
import { fortalezaDay, type SiteTrackEvent } from "../../shared/siteTracking";

/** Incrementa o contador agregado do dia — nada identificável é gravado. */
export async function recordSiteEvent(path: string, event: SiteTrackEvent) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(siteEvents)
    .values({ day: fortalezaDay(), path, event, count: 1 })
    .onDuplicateKeyUpdate({ set: { count: sql`${siteEvents.count} + 1` } });
}

type Row = { path: string; event: string; count: number };

/** Agrega linhas (path/event/count) em visitas por página, CTAs e funil. Pura, testável. */
export function summarizeSiteEvents(rows: Row[]) {
  const sumEvent = (event: string) => rows.filter(row => row.event === event).reduce((total, row) => total + row.count, 0);
  const pageViews = new Map<string, number>();
  for (const row of rows) {
    if (row.event === "page_view") pageViews.set(row.path, (pageViews.get(row.path) ?? 0) + row.count);
  }
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);
  const start = sumEvent("signup_start");
  const submit = sumEvent("signup_submit");
  const success = sumEvent("signup_success");
  return {
    pageViewsByPath: [...pageViews].map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views),
    totalPageViews: sumEvent("page_view"),
    ctaClicks: sumEvent("cta_click"),
    funnel: {
      start,
      submit,
      success,
      submitRatePct: pct(submit, start),
      successRatePct: pct(success, submit),
      overallRatePct: pct(success, start),
    },
  };
}

function daysAgo(days: number): string {
  // days=7 => hoje + 6 dias anteriores (7 dias corridos, incluindo hoje).
  return fortalezaDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
}

export async function getSiteStats() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const since30 = daysAgo(30);
  const since7 = daysAgo(7);
  const rows = await db
    .select({ day: siteEvents.day, path: siteEvents.path, event: siteEvents.event, count: siteEvents.count })
    .from(siteEvents)
    .where(and(gte(siteEvents.day, since30)));
  return {
    last7Days: summarizeSiteEvents(rows.filter(row => row.day >= since7)),
    last30Days: summarizeSiteEvents(rows),
  };
}
