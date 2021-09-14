# Apache Tika Implementation [![CI](https://github.com/saidsef/faas-convert-to-text/actions/workflows/docker.yml/badge.svg)](#deployment) [![Tagging](https://github.com/saidsef/faas-convert-to-text/actions/workflows/tagging.yml/badge.svg)](#deployment) [![Release](https://github.com/saidsef/faas-convert-to-text/actions/workflows/release.yml/badge.svg)](#deployment)

The Apache Tika™ toolkit detects and extracts metadata and text from over a thousand different file types (such as PPT, XLS, and PDF). All of these file types can be parsed through a single interface, making Tika useful for search engine indexing, content analysis, translation, and much more.

## Prerequisite

- [Kubernetes Cluster](https://kubernetes.io/docs/tutorials/)
- [ArgoCD](https://argoproj.github.io/argo-cd/)

## Deployment

### Kubernetes Deployment

> Create `namespace`, via `kubectl create ns web`
> Assuming you've checked out this repo

```shell
kubectl kustomize deployment/ | kubectl apply -f -
```

Or, to deploy via argocd:

```bash
kubectl apply -f deployment/argocd/application.yml
```

> *NOTE:* Remeber to update `Ingress` hostname

Take it for a test drive:

Via CLI:

> You'll need to forward service via `kubectl port-forward -n web svc/tika-ui 8080`

```shell
curl -d @test/url.json http://localhost:8080/ -H 'Content-Type: application/json'
```

Or, via Web UI:

Using a browser visit:

```shell
http://loclahost:8080/
```
