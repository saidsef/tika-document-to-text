# Apache Tika Implementation [![CI](https://github.com/saidsef/tika-document-to-text/actions/workflows/docker.yml/badge.svg)](https://github.com/saidsef/tika-document-to-text/actions/workflows/docker.yml) [![Tagging](https://github.com/saidsef/tika-document-to-text/actions/workflows/tagging.yml/badge.svg)](https://github.com/saidsef/tika-document-to-text/actions/workflows/tagging.yml) [![Release](https://github.com/saidsef/tika-document-to-text/actions/workflows/release.yml/badge.svg)](https://github.com/saidsef/tika-document-to-text/actions/workflows/release.yml)

The Apache Tika™ toolkit detects and extracts metadata and text from over a thousand different file types (such as PPT, XLS, and PDF). All of these file types can be parsed through a single interface, making Tika useful for search engine indexing, content analysis, translation, and much more.

## Architecture

Two containers, both built and published by CI:

| Component | Source | Image tag | Role |
| --------- | ------ | --------- | ---- |
| UI | `ui/` | `ghcr.io/saidsef/tika-document-to-text:ui-latest` | Express web app. Accepts an upload and proxies it to Tika as `PUT /tika`. |
| Server | `function/Dockerfile.server` | `ghcr.io/saidsef/tika-document-to-text:server-latest` | Apache Tika server with OCR (Tesseract) and a Prometheus JMX exporter. |

Uploads are held in memory and forwarded, never written to disk. PDFs are sent with `X-Tika-PDFocrStrategy: ocr_and_text_extraction` so scanned pages are OCR'd.

## Prerequisite

- [Kubernetes Cluster](https://kubernetes.io/docs/tutorials/) >= 1.27
- [ArgoCD](https://argoproj.github.io/argo-cd/) (Optional)

## Deployment

### Kubernetes Deployment

> Create `namespace`, via `kubectl create ns web`
> Assuming you've checked out this repo

```shell
kubectl kustomize deployment/ | kubectl apply -f -
```

This deploys the UI and server with a cluster-internal `Service` only. To publish it, use one of the ingress overlays instead:

```shell
kubectl kustomize deployment/k8s/nginx-ingress/ | kubectl apply -f -   # NGINX Ingress
kubectl kustomize deployment/k8s/gateway-api/  | kubectl apply -f -    # Gateway API
```

> *NOTE:* Remember to update the hostname in `deployment/k8s/nginx-ingress/ingress.yml` or `deployment/k8s/gateway-api/route.yml`.

Or, to deploy via argocd:

```bash
kubectl apply -f deployment/argocd/application.yml
```

Take it for a test drive:

> You'll need to forward the service via `kubectl port-forward -n web svc/tika-ui 8080`

Via CLI:

```shell
curl -F "doc=@/path/to/document.pdf" http://localhost:8080/
```

Or, via Web UI, visit <http://localhost:8080/>.

## UI configuration

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PORT` | `8080` | Port the UI listens on. |
| `HOST` | `server` | Hostname of the Tika server. |
| `HOST_PORT` | `8070` | Port of the Tika server. |
| `PROTOCOL` | `http` | Scheme used for the outbound call to Tika. |
| `TIKA_TIMEOUT_MS` | `500000` | Abort a conversion after this long. |
| `MAX_UPLOAD_BYTES` | `52428800` | Reject uploads larger than this (50 MB). |
| `CANONICAL_ORIGIN` | *(request host)* | Absolute origin for canonical/Open Graph/sitemap URLs, e.g. `https://tika.example.com`. Set this when serving a public site. |

Endpoints: `/` (UI), `/healthz` (liveness/readiness), `/metrics` (Prometheus), `/robots.txt`, `/sitemap.xml`.

## Local development

```shell
cd ui
npm install
npm test                                  # unit and integration tests
HOST=127.0.0.1 HOST_PORT=9998 npm start   # against a Tika server on :9998
```

A Tika server to develop against:

```shell
docker run --rm -p 9998:9998 apache/tika:latest
```
