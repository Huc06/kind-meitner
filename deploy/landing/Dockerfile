# Source-faithful Nymspace landing. It is isolated from the Electron desktop app.
FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN npm install --global pnpm@10.33.0

COPY landing/package.json landing/pnpm-lock.yaml ./
COPY landing/packages/github ./packages/github
RUN pnpm install --frozen-lockfile

COPY landing/ ./
RUN pnpm build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./
COPY --from=build /app/packages ./packages

EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
