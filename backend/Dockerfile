# syntax=docker/dockerfile:1

FROM node:20-bullseye-slim AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json tsconfig.json .eslintrc.cjs ./
COPY prisma ./prisma
RUN npm install
COPY src ./src
RUN npm run build

FROM node:20-bullseye-slim AS runtime
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY start.sh ./start.sh
RUN chmod +x ./start.sh
EXPOSE 3000
CMD ["./start.sh"]
