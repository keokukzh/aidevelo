FROM node:lts-trixie-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY cli/package.json cli/
COPY server/package.json server/
COPY ui/package.json ui/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/adapter-utils/package.json packages/adapter-utils/
COPY packages/adapters/aidevelo-gateway/package.json packages/adapters/aidevelo-gateway/
COPY packages/adapters/claude-local/package.json packages/adapters/claude-local/
COPY packages/adapters/codex-local/package.json packages/adapters/codex-local/
COPY packages/adapters/cursor-local/package.json packages/adapters/cursor-local/
COPY packages/adapters/gemini-local/package.json packages/adapters/gemini-local/
COPY packages/adapters/opencode-local/package.json packages/adapters/opencode-local/
COPY packages/adapters/pi-local/package.json packages/adapters/pi-local/

RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app /app
COPY . .
RUN pnpm --filter @aideveloai/ui build
RUN pnpm --filter @aideveloai/server prepare:ui-dist
RUN pnpm --filter @aideveloai/server build
RUN test -f server/dist/index.js || (echo "ERROR: server build output missing" && exit 1)
RUN test -f server/ui-dist/index.html || (echo "ERROR: server UI dist missing" && exit 1)

FROM base AS production
WORKDIR /app
ARG CODEX_NPM_VERSION=0.57.0
# Copy only necessary artifacts from build stage
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/server ./server
COPY --chown=node:node --from=build /app/packages ./packages
COPY --chown=node:node --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./

# Install global tools and prepare runtime directories
RUN npm install --global --omit=dev @anthropic-ai/claude-code@latest @openai/codex@${CODEX_NPM_VERSION} opencode-ai \
  && mkdir -p /aidevelo \
  && chown node:node /aidevelo

# Set up symbolic links for shared modules
RUN mkdir -p /app/node_modules/@aideveloai \
  && ln -s /app/packages/shared /app/node_modules/@aideveloai/shared \
  && ln -s /app/packages/plugins/sdk /app/node_modules/@aideveloai/plugin-sdk

# Link zod module
RUN ZOD_DIR="$(find /app/node_modules/.pnpm -maxdepth 1 -type d -name 'zod@3*' | sort | head -n 1)/node_modules/zod" \
  && test -d "$ZOD_DIR" \
  && ln -s "$ZOD_DIR" /app/node_modules/zod

ENV NODE_ENV=production \
  HOME=/aidevelo \
  HOST=0.0.0.0 \
  PORT=3100 \
  SERVE_UI=true \
  AIDEVELO_HOME=/aidevelo \
  AIDEVELO_INSTANCE_ID=default \
  AIDEVELO_CONFIG=/aidevelo/instances/default/config.json \
  AIDEVELO_DEPLOYMENT_MODE=authenticated \
  AIDEVELO_DEPLOYMENT_EXPOSURE=private

VOLUME ["/aidevelo"]
EXPOSE 3100
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=12 CMD curl -fsS http://127.0.0.1:3100/api/health || exit 1

USER node
CMD ["node", "--import", "./server/node_modules/tsx/dist/loader.mjs", "server/dist/index.js"]
