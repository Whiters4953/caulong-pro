FROM node:24-slim
WORKDIR /app
RUN mkdir -p /data
COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev
COPY backend/src backend/src
COPY web web
ENV PORT=4000 DB_FILE=/data/data.sqlite NODE_ENV=production
EXPOSE 4000
CMD ["node", "--experimental-strip-types", "backend/src/server.ts"]
