FROM node:13-alpine
MAINTAINER Said Sef <saidsef@gmail.com> (saidsef.co.uk/)

USER root

## Build ARG
ARG PORT=""

## PRODUCTION MODE
ENV NODE_ENV production
ENV NPM_CONFIG_FETCH_RETRIES 10
ENV NPM_CONFIG_LOGLEVEL warn
ENV PORT ${POST:-8080}

WORKDIR /app

COPY . /app

RUN apk add --update --no-cache curl && \
    rm -rf /var/cache/apk/* && \
    yarn install && \
    yarn check && \
    yarn autoclean --init && \
    yarn autoclean --force && \
    chown -R nobody .
    
USER nobody

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s CMD curl --fail http://localhost:${PORT}/healthz || exit 1

EXPOSE ${PORT}

CMD ["node", "app.js"]