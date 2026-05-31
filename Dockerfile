FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .
# Stale incremental cache can make tsc emit .d.ts only (no .js) inside Docker.
RUN rm -f tsconfig.build.tsbuildinfo && npm run build

FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Prisma Client is generated at build time in the builder stage (CLI is dev-only).
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Run migrations separately (once per deploy): npm run prisma:migrate:deploy
CMD ["node", "dist/main.js"]
