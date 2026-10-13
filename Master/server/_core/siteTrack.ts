import type { Express, Request, Response } from "express";
import { z } from "zod";
import { recordSiteEvent } from "../db/siteEvents";
import { isBotUserAgent, isValidSiteTrackPath, SITE_TRACK_EVENTS, SITE_TRACK_PATH_MAX } from "../../shared/siteTracking";
import { checkRateLimit } from "./rateLimit";

const trackSchema = z
  .object({
    event: z.enum(SITE_TRACK_EVENTS),
    path: z.string().max(SITE_TRACK_PATH_MAX).refine(isValidSiteTrackPath),
  })
  .strict();

const RATE_LIMIT = { windowMs: 60 * 1000, maxAttempts: 120 };

/**
 * Medição própria e anônima do site comercial: só contador agregado por
 * dia/página/evento. IP é usado apenas em memória pro rate limit — nunca
 * gravado. Sempre 204: medição jamais pode quebrar ou denunciar erro à página.
 */
export async function handleSiteTrack(req: Request, res: Response) {
  try {
    if (isBotUserAgent(req.get("user-agent"))) {
      res.status(204).end();
      return;
    }
    if (!checkRateLimit(`track:${req.ip ?? "unknown"}`, RATE_LIMIT).allowed) {
      res.status(429).end();
      return;
    }
    const parsed = trackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).end();
      return;
    }
    await recordSiteEvent(parsed.data.path, parsed.data.event);
    res.status(204).end();
  } catch (error) {
    console.warn("[track] falha ao registrar evento:", error instanceof Error ? error.message : error);
    res.status(204).end();
  }
}

export function registerSiteTrackRoute(app: Express) {
  app.post("/api/track", handleSiteTrack);
}
