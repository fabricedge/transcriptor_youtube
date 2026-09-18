import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import type { Format, Kind, Order, OrderStatus, Transcript } from "./types"
import { config } from "./config"

export function openDb(path = config.dbPath): Database {
  if (path !== ":memory:") {
    const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "."
    if (dir && dir !== ".") mkdirSync(dir, { recursive: true })
  }
  const db = new Database(path)
  db.exec("PRAGMA journal_mode = WAL")
  db.exec("PRAGMA foreign_keys = ON")
  migrate(db)
  return db
}

export function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      stripe_session_id TEXT UNIQUE,
      payment_intent TEXT,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      kind TEXT NOT NULL,
      source_url TEXT NOT NULL,
      lang TEXT NOT NULL,
      format TEXT NOT NULL,
      video_count INTEGER NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      video_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      data BLOB NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transcript_cache (
      video_id TEXT NOT NULL,
      lang TEXT NOT NULL,
      format TEXT NOT NULL,
      data BLOB NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (video_id, lang, format)
    );
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_transcripts_order ON transcripts(order_id);
  `)
}

export function createOrder(
  db: Database,
  o: { id: string; amountCents: number; currency: string; kind: Kind; sourceUrl: string; lang: string; format: Format; videoCount: number },
): Order {
  const now = new Date().toISOString()
  const row = db
    .query(
      `INSERT INTO orders (id, stripe_session_id, payment_intent, amount_cents, currency, status, kind, source_url, lang, format, video_count, created_at, updated_at)
       VALUES (?, NULL, NULL, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?) 
       RETURNING *`,
    )
    .get(o.id, o.amountCents, o.currency, o.kind, o.sourceUrl, o.lang, o.format, o.videoCount, now, now)
  return rowToOrder(row as Record<string, unknown>)
}

export function getOrder(db: Database, id: string): Order | null {
  const row = db.query("SELECT * FROM orders WHERE id = ?").get(id)
  return row ? rowToOrder(row as Record<string, unknown>) : null
}

export function getOrderBySession(db: Database, sessionId: string): Order | null {
  const row = db.query("SELECT * FROM orders WHERE stripe_session_id = ?").get(sessionId)
  return row ? rowToOrder(row as Record<string, unknown>) : null
}

export function listOrdersByStatus(db: Database, status: OrderStatus): Order[] {
  const rows = db.query("SELECT * FROM orders WHERE status = ? ORDER BY created_at ASC").all(status)
  return (rows as Record<string, unknown>[]).map(rowToOrder)
}

export function markOrderPaid(db: Database, orderId: string, sessionId: string, paymentIntent: string): void {
  db.query(
    `UPDATE orders SET status = 'paid', stripe_session_id = ?, payment_intent = ?, updated_at = ? WHERE id = ?`,
  ).run(sessionId, paymentIntent, new Date().toISOString(), orderId)
}

export function attachSession(db: Database, orderId: string, sessionId: string): void {
  db.query(`UPDATE orders SET stripe_session_id = ?, updated_at = ? WHERE id = ?`).run(
    sessionId,
    new Date().toISOString(),
    orderId,
  )
}

export function setOrderStatus(
  db: Database,
  orderId: string,
  status: OrderStatus,
  extra?: { error?: string | null },
): void {
  db.query(`UPDATE orders SET status = ?, error = ?, updated_at = ? WHERE id = ?`).run(
    status,
    extra?.error ?? null,
    new Date().toISOString(),
    orderId,
  )
}

export function addTranscript(db: Database, t: { id: string; orderId: string; videoId: string; filename: string; data: Uint8Array }): void {
  db.query(
    `INSERT INTO transcripts (id, order_id, video_id, filename, data, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(t.id, t.orderId, t.videoId, t.filename, t.data, new Date().toISOString())
}

export function transcriptsForOrder(db: Database, orderId: string): Transcript[] {
  const rows = db.query("SELECT * FROM transcripts WHERE order_id = ? ORDER BY filename ASC").all(orderId)
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    orderId: String(r.order_id),
    videoId: String(r.video_id),
    filename: String(r.filename),
    data: r.data as Uint8Array,
    createdAt: String(r.created_at),
  }))
}

export function getCache(db: Database, videoId: string, lang: string, format: Format): Uint8Array | null {
  const row = db.query(
    "SELECT data FROM transcript_cache WHERE video_id = ? AND lang = ? AND format = ?",
  ).get(videoId, lang, format) as { data: Uint8Array } | null
  return row?.data ?? null
}

export function setCache(db: Database, videoId: string, lang: string, format: Format, data: Uint8Array): void {
  db.query(
    `INSERT INTO transcript_cache (video_id, lang, format, data, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(video_id, lang, format) DO UPDATE SET data = excluded.data, created_at = excluded.created_at`,
  ).run(videoId, lang, format, data, new Date().toISOString())
}

function rowToOrder(r: Record<string, unknown>): Order {
  return {
    id: String(r.id),
    stripeSessionId: r.stripe_session_id == null ? null : String(r.stripe_session_id),
    paymentIntent: r.payment_intent == null ? null : String(r.payment_intent),
    amountCents: Number(r.amount_cents),
    currency: String(r.currency),
    status: r.status as OrderStatus,
    kind: r.kind as Kind,
    sourceUrl: String(r.source_url),
    lang: String(r.lang),
    format: r.format as Format,
    videoCount: Number(r.video_count),
    error: r.error == null ? null : String(r.error),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }
}