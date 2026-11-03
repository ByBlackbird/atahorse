# syntax=docker/dockerfile:1.7
# ---------- derleme ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# npm 10.9.9'da "Exit handler never called!" çöküşü görülüyor: önce npm 11'e yükselt, sonra
# geçici ağ arızalarına karşı ci'ı iki kez dene, son çare olarak install'a düş.
# --registry kilidi: lockfile hangi ayarda üretildiyse üretilsin, paketler her zaman npmjs'ten insin.
RUN npm install -g npm@11.19.0 --no-audit --no-fund; npm ci --no-audit --no-fund --registry=https://registry.npmjs.org || npm ci --no-audit --no-fund --registry=https://registry.npmjs.org || npm install --no-audit --no-fund --registry=https://registry.npmjs.org
COPY . .
RUN npm run build && npm prune --omit=dev

# ---------- çalışma ----------
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 DATA_DIR=/data
WORKDIR /app
# Yalnızca çalışma zamanı dosyaları (yerel derleme gerektiren bağımlılık yok: SQLite = node:sqlite)
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=4s --start-period=15s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "dist-server/index.js"]
