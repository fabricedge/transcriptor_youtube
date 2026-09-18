import type { Format, Kind } from "./types"

const toInt = (v: string | undefined, def: number): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : def
}

export const config = {
  port: toInt(Bun.env.PORT, 3000),
  dbPath: Bun.env.DATABASE_PATH ?? "./data/yt-transcribe.db",
  appUrl: Bun.env.APP_URL ?? "http://localhost:3000",
  stripeSecretKey: Bun.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: Bun.env.STRIPE_WEBHOOK_SECRET ?? "",
  pricePerVideoUsd: Math.max(0.5, Number(Bun.env.PRICE_PER_VIDEO_USD) || 0.5),
  currency: (Bun.env.CURRENCY ?? "usd").toLowerCase(),
  goBinPath: Bun.env.GO_BIN_PATH ?? "../yt-transcribe",
  workerIntervalMs: toInt(Bun.env.WORKER_INTERVAL_MS, 3000),
  requestLimitPerHour: toInt(Bun.env.REQUEST_LIMIT_PER_HOUR, 10),
}

export function priceCents(count: number): number {
  return Math.round(config.pricePerVideoUsd * count * 100)
}

export const langs: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pt", label: "Portuguese (auto)" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
]

export const formats: { code: Format; label: string }[] = [
  { code: "txt", label: "Plain text (.txt)" },
  { code: "vtt", label: "WebVTT (.vtt)" },
  { code: "srt", label: "SubRip (.srt)" },
]

export function isKind(v: string): v is Kind {
  return v === "video" || v === "playlist"
}

export function isFormat(v: string): v is Format {
  return v === "txt" || v === "vtt" || v === "srt"
}