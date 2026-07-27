FROM docker.io/node:24-alpine3.24

LABEL org.opencontainers.image.authors="Said Sef <said@saidsef.co.uk> (saidsef.co.uk/)"
LABEL org.opencontainers.image.source="https://github.com/saidsef/tika-document-to-text"
LABEL org.opencontainers.image.description="UI for Apache Tika"
LABEL org.opencontainers.image.licenses="MIT"

ARG PORT=''
ARG PROTOCOL=''

## PRODUCTION MODE
ENV NODE_ENV=production
ENV NPM_CONFIG_FETCH_RETRIES=10
ENV NPM_CONFIG_LOGLEVEL=warn
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV PORT=${PORT:-8080}
ENV PROTOCOL=${PROTOCOL:-'http'}

WORKDIR /app

# Manifests first so `npm ci` is only re-run when dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --chown=10001:10001 app.js ./
COPY --chown=10001:10001 libs ./libs
COPY --chown=10001:10001 views ./views
COPY --chown=10001:10001 public ./public

USER 10001

# Node's own fetch, so the image needs no curl.
HEALTHCHECK --interval=120s --timeout=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE ${PORT}

CMD ["node", "app.js"]
