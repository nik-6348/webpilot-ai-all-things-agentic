FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --no-frozen-lockfile && pnpm db:generate && pnpm turbo build --filter=@webpilot/notifier...
ENV NODE_ENV=production
EXPOSE 4300
CMD ["pnpm","--filter","@webpilot/notifier","start"]
