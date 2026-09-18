# yt-transcribe web — serviço de transcrição paga

Serviço web que cobra por transcrição de vídeos/playlists do YouTube, usando
Stripe Checkout. Busca as legendas com o binário Go (`../yt-transcribe`) como
subprocesso e entrega arquivos `.txt/.vtt/.srt` (ou um `.zip`).

```
Home (URL + idioma + formato)
  └→ POST /checkout  →  valida URL, conta vídeos (RSS pra playlist)
                        cria pedido + Checkout Session do Stripe → redirect
                        (sucesso) → /orders/:id (polling)
  └→ POST /webhook/stripe  →  checkout.session.completed → marca pago
                        → worker (in-process) roda o binário Go
                        → guarda legendas no SQLite + cache
                        → ordem vira "ready"; falha → "failed" + refund auto
```

## Rodar local

```bash
go build -o yt-transcribe ..          # ou já compilado na raiz
cd web
bun install
export STRIPE_SECRET_KEY=sk_test_xxx
export STRIPE_WEBHOOK_SECRET=whsec_xxx
bun run src/index.ts                  # http://localhost:3000
```

## Configuração (env)

| Var | Default | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta HTTP |
| `DATABASE_PATH` | `./data/yt-transcribe.db` | SQLite |
| `APP_URL` | `http://localhost:3000` | Base usada nas URLs de retorno do Stripe |
| `STRIPE_SECRET_KEY` | — | chave secreta do Stripe (obrigatória p/ pagar) |
| `STRIPE_WEBHOOK_SECRET` | — | segredo do webhook (obrigatório p/ confirmar) |
| `PRICE_PER_VIDEO_USD` | `0.50` | preço por vídeo |
| `CURRENCY` | `usd` | moeda dos preços |
| `GO_BIN_PATH` | `../yt-transcribe` | caminho do binário Go |
| `WORKER_INTERVAL_MS` | `3000` | intervalo do job runner |
| `REQUEST_LIMIT_PER_HOUR` | `10` | limite de `/checkout` por IP |

## Stripe

1. Depois de rodar, aponte um webhook da Dashboard (ou `stripe listen`) para
   `https://SEU_HOST/webhook/stripe` no evento `checkout.session.completed`.
2. Teste local com o CLI:

   ```bash
   stripe listen --forward-to localhost:3000/webhook/stripe
   stripe trigger checkout.session.completed
   ```

Links de download (`/orders/:id/...`) ficam protegidos pelo próprio `id` do
pedido (funciona como token — sem contas, sem senhas).

## Testes

```bash
cd web
bun test       # unit + integração (stubs, sem rede)
bun run typecheck
go vet ./..    # no repo raiz
```

## Deploy

```bash
cd web
docker compose up --build
```

O `Dockerfile` faz build do binário Go e roda a app num único container Bun.
Monte o `DATABASE_PATH` num volume persistente.

## Riscos conhecidos

- **ToS/copyright:** extrair e revender transcrições pode violar os termos do
  YouTube e direitos autorais das legendas. Avalie antes de escalar.
- **Rate limit do YouTube:** o cache por `(vídeo, idioma, formato)` e o
  limite por IP reduzem o risco; legendas ausentes num idioma viram `failed`
  com reembolso automático.