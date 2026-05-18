FROM node:22-slim AS deps
WORKDIR /app/js
COPY js/package*.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app/js
COPY --from=deps /app/js/node_modules ./node_modules
COPY js ./
RUN npm run build

FROM node:22-slim AS runner
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app/js
COPY js/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/js/dist ./dist
COPY --from=builder /app/js/api ./api
COPY --from=builder /app/js/server ./server
COPY --from=builder /app/js/src/lib ./src/lib
COPY --from=builder /app/js/db ./db
EXPOSE 8080
CMD ["npm", "start"]
