import { Database } from "bun:sqlite"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { addTranscript, getCache, setCache, setOrderStatus } from "./db"
import { config } from "./config"
import type { Format, Order } from "./types"
import { fetchPlaylistVideoIds, parseYoutubeUrl } from "./youtube"

const extFor = (f: Format): string => (f === "txt" ? "txt" : f === "vtt" ? "vtt" : "srt")
const videoUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`

export type VideoSource = { videoId: string; sourceUrl: string }

export function resolveSourceUrls(order: Order): { urls: VideoSource[]; error?: string } {
  const parsed = parseYoutubeUrl(order.sourceUrl)
  if (!parsed.ok) return { urls: [], error: parsed.reason }
  if (parsed.kind === "video") {
    return { urls: [{ videoId: parsed.videoId, sourceUrl: videoUrl(parsed.videoId) }] }
  }
  return { urls: [], error: "playlist não suportado inline; use resolvePlaylistUrls" }
}

export async function resolvePlaylistUrls(playlistId: string): Promise<{ urls: VideoSource[]; error?: string }> {
  const { ids, error } = await fetchPlaylistVideoIds(playlistId)
  if (error) return { urls: [], error }
  return { urls: ids.map((videoId) => ({ videoId, sourceUrl: videoUrl(videoId) })) }
}

export async function resolveOrderUrls(order: Order): Promise<{ urls: VideoSource[]; error?: string }> {
  const parsed = parseYoutubeUrl(order.sourceUrl)
  if (!parsed.ok) return { urls: [], error: parsed.reason }
  if (parsed.kind === "video") return { urls: [{ videoId: parsed.videoId, sourceUrl: videoUrl(parsed.videoId) }] }
  const r = await resolvePlaylistUrls(parsed.playlistId)
  if (r.error) return { urls: [], error: r.error }
  const urls = r.urls.slice(0, order.videoCount)
  return { urls }
}

export async function runGoTranscribe(
  goBin: string | string[],
  sourceUrl: string,
  lang: string,
  format: Format,
  opts: { timeoutMs?: number; env?: Record<string, string> } = {},
): Promise<{ ok: true; data: Uint8Array } | { ok: false; error: string }> {
  const timeoutMs = opts.timeoutMs ?? 60_000
  const dir = await mkdtemp(join(tmpdir(), "yt-transcribe-"))
  const cmd = Array.isArray(goBin) ? goBin : [goBin]
  const proc = Bun.spawn([...cmd, "--lang", lang, "--format", format, "--out", dir, sourceUrl], {
    stdout: "pipe",
    stderr: "pipe",
    env: opts.env ?? Bun.env,
  })

  const result = await Promise.race([proc.exited, Bun.sleep(timeoutMs).then(() => "TIMEOUT" as const)])
  if (result === "TIMEOUT") {
    proc.kill("SIGKILL")
    void (await proc.exited.catch(() => 0))
    return { ok: false, error: "timeout ao buscar transcrição" }
  }

  const stderr = await new Response(proc.stderr).text()
  void (await new Response(proc.stdout).text())

  if (proc.exitCode !== 0) {
    return { ok: false, error: stderr.trim() || `exit code ${proc.exitCode}` }
  }

  const id = extractIdFromUrl(sourceUrl)
  const file = `${dir}/${id}.${extFor(format)}`
  const f = Bun.file(file)
  if (!(await f.exists())) {
    return { ok: false, error: `arquivo de saída não encontrado (${stderr.trim() || exitCodeMsg(proc.exitCode)})` }
  }
  const data = new Uint8Array(await f.arrayBuffer())
  return { ok: true, data }
}

function exitCodeMsg(code: number | null): string {
  return `exit code ${code}`
}

export function extractIdFromUrl(url: string): string {
  const p = parseYoutubeUrl(url)
  return p.ok && p.kind === "video" ? p.videoId : url
}

export function transcribeOrder(
  db: Database,
  order: Order,
  goBin: string = config.goBinPath,
  opts: { env?: Record<string, string> } = {},
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  return (async () => {
    setOrderStatus(db, order.id, "processing")

    const { urls, error } = await resolveOrderUrls(order)
    if (error) return { ok: false, error }
    if (urls.length === 0) return { ok: false, error: "nenhum vídeo para transcrever" }

    for (const { videoId, sourceUrl } of urls) {
      let data: Uint8Array
      const cached = getCache(db, videoId, order.lang, order.format)
      if (cached) {
        data = cached
      } else {
        const res = await runGoTranscribe(goBin, sourceUrl, order.lang, order.format, opts)
        if (!res.ok) return { ok: false, error: `vídeo ${videoId}: ${res.error}` }
        data = res.data
        setCache(db, videoId, order.lang, order.format, data)
      }
      addTranscript(db, {
        id: crypto.randomUUID(),
        orderId: order.id,
        videoId,
        filename: `${videoId}.${extFor(order.format)}`,
        data,
      })
    }

    return { ok: true, count: urls.length }
  })()
}