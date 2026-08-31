FROM mcr.microsoft.com/playwright:v1.55.0-noble
WORKDIR /app
ENV CI=true
RUN corepack enable
COPY . .
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV DIRECT_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm install --no-frozen-lockfile && pnpm db:generate && pnpm turbo build --filter=@webpilot/browser-worker...
ENV NODE_ENV=production
EXPOSE 4100
CMD ["pnpm","--filter","@webpilot/browser-worker","start"]
