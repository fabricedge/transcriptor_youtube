import { config, formats, langs } from "./lib/config"
import type { Order } from "./lib/types"

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

const css = `
body{font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#222;line-height:1.5}
h1{font-size:1.4rem}
input,select,button{font-size:1rem;padding:8px 10px;border:1px solid #ccc;border-radius:6px}
input{width:100%;box-sizing:border-box;margin:6px 0 12px}
label{font-weight:600;font-size:.9rem}
button[type=submit]{background:#0a84ff;color:#fff;border:none;cursor:pointer;margin-top:8px}
button[type=submit]:hover{background:#0070e0}
.box{border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0;background:#fff}
.error{color:#c21f1f;background:#fdeaea;border-color:#f5c2c2}
.ok{color:#0f7a3d;background:#eafaf0;border-color:#bfe9cc}
.muted{color:#666;font-size:.85rem}
ul.downloads{list-style:none;padding:0;margin:8px 0 16px}
ul.downloads li{margin:4px 0}
a.dl{color:#0a84ff;text-decoration:none}
.spinner{display:inline-block;width:16px;height:16px;border:3px solid #ccc;border-top-color:#0a84ff;border-radius:50%;animation:spin 1s linear infinite;vertical-align:middle;margin-right:8px}
@keyframes spin{to{transform:rotate(360deg)}}
`

export function layout(title: string, body: string): Response {
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · YouTube Transcripts</title><style>${css}</style></head>
<body>${body}</body></html>`
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
}

export function homePage(opts: { error?: string; cancelled?: boolean } = {}): Response {
  const langOpts = langs.map((l) => `<option value="${l.code}">${esc(l.label)}</option>`).join("")
  const fmtOpts = formats.map((f) => `<option value="${f.code}">${esc(f.label)}</option>`).join("")
  const err = opts.error ? `<div class="box error">${esc(opts.error)}</div>` : ""
  const cancel = opts.cancelled ? `<div class="box error">Pagamento cancelado — nenhum valor foi cobrado.</div>` : ""
  return layout(
    "Transcrever vídeo ou playlist",
    `<h1>Transcrever vídeo do YouTube</h1>
${cancel}${err}
<form action="/checkout" method="post">
  <label for="url">URL do vídeo ou playlist</label>
  <input id="url" name="url" type="text" required placeholder="https://www.youtube.com/watch?v=…" autofocus>
  <label for="lang">Idioma das legendas</label>
  <select id="lang" name="lang">${langOpts}</select>
  <label for="format">Formato</label>
  <select id="format" name="format">${fmtOpts}</select>
  <p class="muted">Preço: <strong>${fmtPrice(1)}</strong> por vídeo.</p>
  <button type="submit">Pagar e transcrever</button>
</form>
<p class="muted" style="margin-top:24px">Você paga com cartão (Stripe). Assim que o pagamento for confirmado, geramos os arquivos da transcrição para download.</p>`,
  )
}

export function fmtPrice(cents: number): string {
  const locale = config.currency === "brl" ? "pt-BR" : "en-US"
  return new Intl.NumberFormat(locale, { style: "currency", currency: config.currency.toUpperCase() }).format(cents / 100)
}

export function orderPage(order: Order, readyFilenames: string[] = []): Response {
  const kindText = order.kind === "playlist" ? `playlist · ${order.videoCount} vídeos` : "vídeo único"
  const header = `<h1>Transcrição do YouTube</h1>
<p class="muted">Pedido <code>${esc(order.id)}</code> · ${kindText} · ${esc(order.lang || "auto")} · ${order.format.toUpperCase()} · ${fmtPrice(order.amountCents)}</p>`
  return layout(
    `Pedido ${order.id}`,
    `${header}${statusBody(order, readyFilenames)}`,
  )
}

export function statusBody(order: Order, readyFilenames: string[] = []): string {
  switch (order.status) {
    case "ready":
      return `<div class="box ok"><strong>Pronto!</strong> Seus arquivos estão gerados.</div>
<ul class="downloads"><li><a class="dl" href="/orders/${esc(order.id)}/download/all.zip">Baixar tudo (.zip)</a></li></ul>
<p class="muted">Ou baixe individualmente:</p>
<ul class="downloads">${readyFilenames
        .map(
          (f) =>
            `<li><a class="dl" href="/orders/${esc(order.id)}/download/${encodeURIComponent(f)}">${esc(f)}</a></li>`,
        )
        .join("")}</ul>`
    case "failed":
      return `<div class="box error"><strong>Não foi possível transcrever.</strong><br>${esc(order.error ?? "erro desconhecido")}</div>
<p class="muted">Se houve cobrança, o reembolso foi solicitado automaticamente (pode levar alguns dias para aparecer no cartão).</p>`
    default:
      return `<div class="box"><span class="spinner"></span>Processando sua transcrição… Isso leva alguns instantes.</div>
<script>
const poll = () => fetch('/orders/${order.id}/status').then(r => r.json()).then(s => {
  if (s.status === 'ready' || s.status === 'failed') location.reload()
  else setTimeout(poll, 2000)
}).catch(() => setTimeout(poll, 4000))
poll()
</script>`
  }
}

export function notFoundPage(): Response {
  const res = layout(
    "Pedido não encontrado",
    `<h1>Pedido não encontrado</h1><p class="muted">O link pode estar errado ou expirado. <a href="/">Voltar</a></p>`,
  )
  return new Response(res.body, { status: 404, headers: res.headers })
}