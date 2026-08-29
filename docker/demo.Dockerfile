FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --no-frozen-lockfile && pnpm turbo build --filter=@webpilot/demo-portal...
ENV NODE_ENV=production
EXPOSE 4200
CMD ["pnpm","--filter","@webpilot/demo-portal","start"]
