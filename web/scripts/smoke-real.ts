import { openDb, createOrder } from "../src/lib/db"
import { transcribeOrder } from "../src/lib/transcriber"

const id = process.argv[2] ?? "DkmTYwT2GJc"
const lang = process.argv[3] ?? "pt-BR"

const db = openDb(":memory:")
const order = createOrder(db, {
  id: "smoke",
  amountCents: 50,
  currency: "usd",
  kind: "video",
  sourceUrl: `https://www.youtube.com/watch?v=${id}`,
  lang,
  format: "vtt",
  videoCount: 1,
})

const start = performance.now()
const res = await transcribeOrder(db, order, "../yt-transcribe")
const elapsed = ((performance.now() - start) / 1000).toFixed(1)
if (!res.ok) {
  console.error("FALHOU:", res.error)
  process.exit(1)
}
const rows = db.query("SELECT filename, length(data) AS bytes FROM transcripts").all()
console.log(`OK em ${elapsed}s —`, rows)