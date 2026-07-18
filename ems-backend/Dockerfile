# ---- build ----
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate && npm run build

# ---- production ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache openssl libc6-compat wget \
  && addgroup -S ems && adduser -S ems -G ems

COPY package.json package-lock.json ./
COPY prisma ./prisma

# prisma CLI is a dependency (needed for migrate deploy at container start)
RUN npm ci --omit=dev && npx prisma generate \
  && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh && chown -R ems:ems /app

USER ems

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
