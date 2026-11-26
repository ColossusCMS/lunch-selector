FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && install -d -o node -g node /app/server/data /home/node/.claude

USER node
ENV PATH="/home/node/.local/bin:$PATH" \
    CLAUDE_CONFIG_DIR=/home/node/.claude \
    DISABLE_AUTOUPDATER=1 \
    LUNCH_RECOMMEND_SEED=/app/category-tags.seed.json
WORKDIR /app

RUN curl -fsSL https://claude.ai/install.sh -o /tmp/install-claude.sh \
    && bash /tmp/install-claude.sh stable \
    && rm /tmp/install-claude.sh \
    && claude --version

COPY package.json ./
COPY js/ ./js/
COPY server/*.js ./server/
COPY server/data/category-tags.json /app/category-tags.seed.json

EXPOSE 8787
CMD ["node", "server/index.js"]
