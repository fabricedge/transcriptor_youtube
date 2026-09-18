import type { ParseResult } from "./types"

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/
const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{10,64}$/

export function parseYoutubeUrl(input: string): ParseResult {
  const s = input.trim()
  if (!s) return { ok: false, reason: "URL vazia" }

  if (!s.startsWith("http")) {
    if (VIDEO_ID_RE.test(s)) {
      return { ok: true, kind: "video", videoId: s, sourceUrl: `https://www.youtube.com/watch?v=${s}` }
    }
    if (PLAYLIST_ID_RE.test(s)) {
      return { ok: true, kind: "playlist", playlistId: s, sourceUrl: `https://www.youtube.com/playlist?list=${s}` }
    }
    return { ok: false, reason: "Não é um ID de vídeo ou playlist válido" }
  }

  const url = new URL(s)
  const host = url.hostname.replace(/^www\./, "")
  if (host !== "youtube.com" && host !== "youtu.be" && host !== "www.youtube.com" && !host.endsWith(".youtube.com")) {
    return { ok: false, reason: "Só aceitamos URLs do YouTube" }
  }

  const list = url.searchParams.get("list")
  if (list) {
    if (!PLAYLIST_ID_RE.test(list)) return { ok: false, reason: "ID de playlist inválido" }
    url.searchParams.delete("list")
    const sourceUrl = `https://www.youtube.com/playlist?list=${list}`
    return { ok: true, kind: "playlist", playlistId: list, sourceUrl }
  }

  const v = url.searchParams.get("v")
  if (v && VIDEO_ID_RE.test(v)) {
    return { ok: true, kind: "video", videoId: v, sourceUrl: `https://www.youtube.com/watch?v=${v}` }
  }

  if (host === "youtu.be") {
    const id = url.pathname.slice(1)
    if (VIDEO_ID_RE.test(id)) {
      return { ok: true, kind: "video", videoId: id, sourceUrl: `https://www.youtube.com/watch?v=${id}` }
    }
  }

  const path = url.pathname
  if (path.startsWith("/watch") || path.startsWith("/v/") || path.startsWith("/shorts/") || path.startsWith("/embed/")) {
    const id = path.split("/").filter(Boolean).pop() ?? ""
    if (VIDEO_ID_RE.test(id)) {
      return { ok: true, kind: "video", videoId: id, sourceUrl: `https://www.youtube.com/watch?v=${id}` }
    }
  }

  return { ok: false, reason: "Não conseguimos extrair um vídeo ou playlist desta URL" }
}

export async function fetchPlaylistVideoIds(playlistId: string): Promise<{ ids: string[]; error?: string }> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`, {
      headers: { "user-agent": "Mozilla/5.0" },
    })
    if (!res.ok) return { ids: [], error: `O YouTube retornou status ${res.status}` }
    const xml = await res.text()
    const ids = extractVideoIdsFromRss(xml)
    if (ids.length === 0) return { ids: [], error: "Playlist vazia ou sem vídeos" }
    return { ids }
  } catch {
    return { ids: [], error: "Falha ao consultar a playlist" }
  }
}

export function extractVideoIdsFromRss(xml: string): string[] {
  const ids: string[] = []
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g
  const videoIdRe = /<yt:videoId>([^<]+)<\/yt:videoId>/
  for (const m of xml.matchAll(entryRe)) {
    const vm = m[1].match(videoIdRe)
    if (vm && VIDEO_ID_RE.test(vm[1])) ids.push(vm[1])
  }
  return ids
}