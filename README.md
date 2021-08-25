# Apache Tika Implementation [![Build Status](https://github.com/saidsef/faas-convert-to-text/actions/workflows/docker.yml/badge.svg)](#deployment) [![Build Status](https://github.com/saidsef/faas-convert-to-text/actions/workflows/tagging.yml/badge.svg)](#deployment)

The Apache Tika™ toolkit detects and extracts metadata and text from over a thousand different file types (such as PPT, XLS, and PDF). All of these file types can be parsed through a single interface, making Tika useful for search engine indexing, content analysis, translation, and much more.

## Prerequisite

- [Kubernetes Cluster](https://kubernetes.io/docs/tutorials/) [and]
- [Kubeless](https://kubeless.io/)

## Deployment

### Kubernetes Deployment

> Create `namespace`, via `kubectl create ns web`
> Assuming you've checked out this repo

```shell
kubectl apply -k ./deployment/k8s
```

Kubernetes - Take it for a test drive:

You can visit the UI via:

```shell
http(s)://tika-ui.hostname.tld
```

Via CLI:

> You'll need to forward service via `kubectl port-forward -n web svc/server 7071`

```shell
curl -d @test/url.json http://localhost:7071/tika -H 'Content-Type: application/json'
```
