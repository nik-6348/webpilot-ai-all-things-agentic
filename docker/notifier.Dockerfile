FROM node:22-bookworm-slim
WORKDIR /app
ENV CI=true
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY . .
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV DIRECT_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm install --no-frozen-lockfile && pnpm db:generate && pnpm turbo build --filter=@webpilot/notifier...
ENV NODE_ENV=production
EXPOSE 4300
CMD ["pnpm","--filter","@webpilot/notifier","start"]
