# syntax=docker/dockerfile:1.7

ARG GO_VERSION=1.21

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

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /out/server /app/server

EXPOSE 8080

CMD ["/app/server"]
