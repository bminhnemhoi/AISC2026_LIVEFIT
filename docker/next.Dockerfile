# Build context: ./next. Node 22 LTS with node:sqlite backup() (>=22.16).
FROM node:22.23.3-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG APP_COMMIT=unknown
RUN printf '%s' "$APP_COMMIT" > APP_COMMIT && mkdir -p public && npm run build:ops && npm run build
RUN npm prune --omit=dev

FROM node:22.23.3-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends util-linux ca-certificates restic && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/livelift /var/backups/livelift && chown node:node /var/lib/livelift /var/backups/livelift
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.ops ./.ops
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build /app/APP_COMMIT ./APP_COMMIT
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
