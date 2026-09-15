# Static-only Kind Meitner landing page image. This deliberately does not copy
# the backend, agent runtimes, credentials, or persistent application state.
FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN npm install --global pnpm@10.33.0
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1

# Keep the lockfile install reproducible while providing every workspace
# manifest pnpm needs to resolve the root lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/docs/package.json ./apps/docs/package.json
COPY cloudflare/control-plane/package.json ./cloudflare/control-plane/package.json
RUN pnpm install --frozen-lockfile

COPY . .
# landing.html is an explicit Vite build entry and produces dist/landing.html.
RUN pnpm exec vite build

FROM nginx:1.27.5-alpine AS runtime

COPY deploy/landing/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 8080
