FROM node:22-bookworm-slim AS frontend-build

WORKDIR /src/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM node:22-bookworm-slim AS backend-deps

WORKDIR /src/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=development

WORKDIR /app

COPY --from=backend-deps /src/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/
COPY --from=frontend-build /src/frontend/dist ./frontend/dist

WORKDIR /app/backend

CMD ["node", "index.js"]
