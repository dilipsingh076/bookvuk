# syntax=docker/dockerfile:1

# The storefront is a Node server now, not a folder of static files behind nginx.
# Server-rendering the catalogue is the whole point of the move, and that needs a
# runtime. `output: "standalone"` in next.config.mjs is what keeps this image
# small: Next traces the modules actually imported and the runtime stage copies
# only those, so node_modules never ships.

# --- deps ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# must be supplied here rather than at container start. The two that are not
# public — API_INTERNAL_URL and anything secret — are read at runtime.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:8080
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_SUPPORT_EMAIL=support@bookvuk.com
# Empty by default, which is what hides the phone card — a wrong number costs
# more trust than no number.
ARG NEXT_PUBLIC_SUPPORT_PHONE=
# Origin serving uploaded covers when the API stores them in Supabase rather
# than on its own disk. `next.config.mjs` folds this into the CSP's `img-src`,
# and the CSP is baked at build time — so leaving it out of this stage ships an
# image whose policy blocks every uploaded cover, with nothing in the network
# tab to say why. Empty locally, where covers are same-origin.
ARG NEXT_PUBLIC_MEDIA_ORIGIN=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL \
    NEXT_PUBLIC_SUPPORT_PHONE=$NEXT_PUBLIC_SUPPORT_PHONE \
    NEXT_PUBLIC_MEDIA_ORIGIN=$NEXT_PUBLIC_MEDIA_ORIGIN

# The build prerenders every book page, which means it calls the API. Point it at
# the service; if the catalogue is unreachable the build still succeeds and those
# pages render on first request instead.
ARG API_INTERNAL_URL=http://api:8000
ENV API_INTERNAL_URL=$API_INTERNAL_URL

RUN npm run build

# --- runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Not root: the server only needs to read its own files.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# `/api/health` is proxied through to the API, so a healthy answer means the
# storefront can reach its data — not merely that Node is listening.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
