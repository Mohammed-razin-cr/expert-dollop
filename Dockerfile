# =====================================================================
# Next.js frontend for Railway.
#
# Mirrors how Skillfinity is deployed: the whole stack on Railway, one
# platform, one bill, and private networking between the app and its
# data API instead of a round trip out to the public internet.
#
# Built from Frontend/ as the service root directory.
# =====================================================================

# ---- deps: install once, cached until package-lock.json changes --------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder ----------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are substituted into the client bundle by the
# compiler, so they must exist during `next build`, not just at runtime.
# Railway passes service variables to a Dockerfile build as build args,
# but only for names declared here — an ARG that is missing yields an
# empty string and ships a bundle that cannot reach its own API.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ANON_KEY
ARG POSTGREST_URL
ARG RAILWAY_PUBLIC_DOMAIN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_ANON_KEY=$NEXT_PUBLIC_ANON_KEY \
    POSTGREST_URL=$POSTGREST_URL \
    RAILWAY_PUBLIC_DOMAIN=$RAILWAY_PUBLIC_DOMAIN \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- runner -----------------------------------------------------------
# `output: 'standalone'` emits server.js plus only the node_modules it
# actually reached, so the final image carries none of the build toolchain.
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
