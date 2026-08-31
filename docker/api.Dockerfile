FROM node:22-bookworm-slim
WORKDIR /app
ENV CI=true
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY . .
# prisma generate only needs DATABASE_URL to be a syntactically valid
# connection string, not a reachable one — the real value is injected at
# runtime via Cloud Run's --set-secrets. No .env ships in the image
# (correctly gitignored), so without this placeholder generate fails the
# build entirely.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV DIRECT_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm install --no-frozen-lockfile && pnpm db:generate && pnpm turbo build --filter=@webpilot/api...
ENV NODE_ENV=production
EXPOSE 4000
CMD ["pnpm","--filter","@webpilot/api","start"]
