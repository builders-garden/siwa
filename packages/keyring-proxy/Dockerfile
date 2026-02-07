FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY packages/keyring-proxy/package.json ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY packages/keyring-proxy/src/ src/

ENV KEYRING_PROXY_PORT=3100
ENV KEYSTORE_BACKEND=encrypted-file
ENV KEYSTORE_PATH=/data/agent-keystore.json

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3100/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["pnpm", "run", "start"]
