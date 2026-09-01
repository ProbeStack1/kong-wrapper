FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json tsup.config.ts ./
COPY src ./src

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p /tmp/kong-bundles && chmod -R 777 /tmp/kong-bundles

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    CONTEXT_PATH=/kong-wrapper \
    KONG_BUNDLE_TEMP_DIR=/tmp/kong-bundles \
    PROBESTACK_CORS_ALLOWED_ORIGINS= \
    PROBESTACK_CORS_ALLOWED_ORIGIN_PATTERNS=http://localhost:*,https://localhost:*,http://127.0.0.1:*,https://127.0.0.1:* \
    REQUEST_TIMEOUT_MS=10000 \
    AXIOS_RETRY_COUNT=2 \
    KONNECT_REGION=in \
    AXIOS_RETRY_DELAY_MS=300 \
    KONNECT_BASE_URL=https://in.api.konghq.com \
    KONNECT_PAT=kpat_GoRoSzeJTfcE5YY3dAzMdKLvebAghR9M3fgLeyNq2SgQUbY88 \
    MONGODB_URI=mongodb+srv://admin_db_user:HdhPLHmhHEhxSUTa@probestack-prod.mby902c.mongodb.net/probestack-forgesphere?appName=probestack-prod \
    MONGODB_DB_NAME=probestack-forgesphere

EXPOSE 3000

CMD ["node", "dist/server.js"]
