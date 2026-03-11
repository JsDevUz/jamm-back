FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

FROM deps AS build

COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
