FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev && npx playwright install --with-deps chromium
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server.js"]
