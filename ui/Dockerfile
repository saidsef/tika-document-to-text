FROM docker.io/node:23-alpine3.21

LABEL org.opencontainers.image.authors="Said Sef <said@saidsef.co.uk> (saidsef.co.uk/)"
LABEL org.opencontainers.image.source="https://github.com/saidsef/tika-document-to-text"
LABEL org.opencontainers.image.description="UI for Apache Tika"
LABEL org.opencontainers.image.licenses="MIT"

USER root

## PRODUCTION MODE
ENV NODE_ENV=production
ENV NPM_CONFIG_FETCH_RETRIES=10
ENV NPM_CONFIG_LOGLEVEL=warn
ENV NPM_CONFIG_CACHE=/app
ENV PORT=${POST:-8080}
ENV PROTOCOL=${PROTOCOL:-'http'}

WORKDIR /app

COPY . /app

RUN apk add --update --no-cache curl && \
    rm -rf /var/cache/apk/* && \
    yarn install --prod && \
    yarn check && \
    yarn autoclean --init && \
    yarn autoclean --force && \
    chown -R 10001:10001 .

USER 10001

# Health check endpoint
HEALTHCHECK --interval=120s --timeout=10s CMD curl --fail http://localhost:${PORT} || exit 1

EXPOSE ${PORT}

CMD ["node", "app.js"]
