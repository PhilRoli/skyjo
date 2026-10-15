FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4300
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY shared ./shared
COPY server ./server
COPY --from=build /app/client/dist ./client/dist
EXPOSE 4300
CMD ["bun", "server/index.ts"]
