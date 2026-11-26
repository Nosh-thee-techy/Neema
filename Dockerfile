# Builds the Neema web app and serves static files + Msingi TTS proxy.
# Build context is the repo root, because the web app imports packages/core.

FROM node:24-slim AS build
WORKDIR /repo
RUN corepack enable

# Install dependencies first so this layer is reused when only source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY packages/core packages/core
COPY apps/web apps/web
RUN pnpm --filter @neema/web build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /repo/apps/web/dist ./dist
COPY apps/web/server.mjs ./server.mjs
COPY apps/web/signPlanServer.mjs ./signPlanServer.mjs
COPY apps/web/careChatServer.mjs ./careChatServer.mjs
COPY packages/core/src/careCards.who.json ./careCards.who.json
EXPOSE 8080
CMD ["node", "server.mjs"]
