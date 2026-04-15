# --- Build stage ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build-only

# --- Production stage ---
FROM node:22-alpine AS production
RUN addgroup -r kneo && adduser -r -G kneo kneo
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server.cjs ./
COPY .env.production ./
RUN chown -R kneo:kneo /app
USER kneo
EXPOSE 5174
ENV PORT=5174
ENV NODE_ENV=production
ENTRYPOINT ["node", "server.cjs"]
