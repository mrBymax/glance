# The image of the server. The build context is the repository root:
#   docker build -f infra/Dockerfile -t glance-server .
FROM node:22-slim
WORKDIR /app
COPY . .
# The speech clips go to a volume at /data/speech, and the server runs as the user node.
RUN npm ci --omit=dev --workspace @glance/server --include-workspace-root \
 && mkdir -p /data/speech && chown node:node /data/speech
ENV NODE_ENV=production PORT=8080 SPEECH_CACHE_DIR=/data/speech
# The server reads its catalog, its fake script, and the files of ../../agents relative to this directory.
WORKDIR /app/apps/server
USER node
EXPOSE 8080
CMD ["node", "--import", "tsx", "src/main.ts"]
