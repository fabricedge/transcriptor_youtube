FROM golang:1.24 AS go-build
WORKDIR /src
COPY go.mod go.sum ./
COPY .gitignore /dev/null
COPY *.go ./
RUN CGO_ENABLED=0 go build -o /out/yt-transcribe .

FROM oven/bun:1 AS bun-deps
WORKDIR /app
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
COPY --from=bun-deps /app/node_modules ./node_modules
COPY web/package.json ./
COPY web/src ./src
COPY --from=go-build /out/yt-transcribe /usr/local/bin/yt-transcribe
ENV GO_BIN_PATH=/usr/local/bin/yt-transcribe
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]