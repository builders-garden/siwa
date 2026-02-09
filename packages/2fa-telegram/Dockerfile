FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY src/ src/

ENV TFA_PORT=3200
ENV TFA_APPROVAL_TIMEOUT_MS=60000
ENV TFA_AUDIT_LOG_PATH=/data/audit.jsonl

EXPOSE 3200

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3200/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["pnpm", "run", "start"]
