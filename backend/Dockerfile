FROM golang:1.21-bookworm AS builder

WORKDIR /src

COPY backend/go.mod backend/go.sum ./backend/
RUN cd backend && go mod download

COPY backend ./backend
RUN cd backend && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/server .

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV CHROME_PATH=/usr/bin/chromium

COPY --from=builder /out/server /app/server
COPY --from=builder ["/src/backend/swimming attendance", "/app/swimming attendance"]

EXPOSE 8080

CMD ["/app/server"]
