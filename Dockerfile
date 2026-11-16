FROM node:24-slim
WORKDIR /app
RUN mkdir -p /data /app/web
COPY . .
RUN if [ ! -f /app/web/index.html ] && [ -f /app/index.html ]; then cp /app/*.html /app/*.js /app/*.css /app/web/ 2>/dev/null || true; fi
RUN npm install --omit=dev
ENV PORT=4000 DB_FILE=/data/data.sqlite NODE_ENV=production
EXPOSE 4000
CMD ["node", "--experimental-strip-types", "server.ts"]
