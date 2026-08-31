FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV CI=true
RUN corepack enable
COPY . .
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_LOCAL_AUTH_BYPASS=false
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_LOCAL_AUTH_BYPASS=$NEXT_PUBLIC_LOCAL_AUTH_BYPASS
RUN pnpm install --no-frozen-lockfile && pnpm turbo build --filter=@webpilot/web...
ENV NODE_ENV=production
# Cloud Run injects PORT (8080) at runtime; `next start` (no -p flag, see
# apps/web/package.json) reads it automatically. EXPOSE is documentation
# only, not a runtime binding -- kept generic since the real port is
# whatever Cloud Run sets.
EXPOSE 8080
CMD ["pnpm","--filter","@webpilot/web","start"]
