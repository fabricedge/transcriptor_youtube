export type Format = "txt" | "vtt" | "srt"
export type Kind = "video" | "playlist"

export type OrderStatus = "pending" | "paid" | "processing" | "ready" | "failed"

export type Order = {
  id: string
  stripeSessionId: string | null
  paymentIntent: string | null
  amountCents: number
  currency: string
  status: OrderStatus
  kind: Kind
  sourceUrl: string
  lang: string
  format: Format
  videoCount: number
  error: string | null
  createdAt: string
  updatedAt: string
}

export type Transcript = {
  id: string
  orderId: string
  videoId: string
  filename: string
  data: Uint8Array
  createdAt: string
}

export type ParseResult =
  | { ok: true; kind: "video"; videoId: string; sourceUrl: string }
  | { ok: true; kind: "playlist"; playlistId: string; sourceUrl: string }
  | { ok: false; reason: string }