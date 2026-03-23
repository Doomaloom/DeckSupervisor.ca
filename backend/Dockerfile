# syntax=docker/dockerfile:1.7

ARG GO_VERSION=1.21
ARG RUNTIME_BASE_IMAGE=runtime-base

FROM golang:${GO_VERSION}-bookworm AS builder

WORKDIR /src

COPY backend/go.mod backend/go.sum ./backend/
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    cd backend && go mod download

COPY backend ./backend
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    cd backend && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/server ./cmd/server

FROM debian:bookworm-slim AS runtime-base

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV CHROME_PATH=/usr/bin/chromium

FROM ${RUNTIME_BASE_IMAGE}

WORKDIR /app

ENV CHROME_PATH=/usr/bin/chromium

COPY --from=builder /out/server /app/server
COPY --from=builder ["/src/backend/swimming attendance", "/app/swimming attendance"]

EXPOSE 8080

CMD ["/app/server"]
