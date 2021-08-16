# Apache Tika Implementation [![Build Status](https://github.com/saidsef/faas-convert-to-text/actions/workflows/docker.yml/badge.svg]

The Apache Tika™ toolkit detects and extracts metadata and text from over a thousand different file types (such as PPT, XLS, and PDF). All of these file types can be parsed through a single interface, making Tika useful for search engine indexing, content analysis, translation, and much more.

## Prerequisite

- [Kubernetes Cluster](https://kubernetes.io/docs/tutorials/) [and]
- [Kubeless](https://kubeless.io/) [or]
- [OpenFaas Services](https://www.openfaas.com/)

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

---

### FaaS Deployment

> This assumes that you've already [deployed OpenFaas](https://docs.openfaas.com/deployment/) and installed the [OpenFaas CLI](https://github.com/openfaas/faas-cli)

```shell
faas-cli deploy -f https://raw.githubusercontent.com/saidsef/faas-convert-to-text/master/deployment/faas-deployment.yml
```

FaaS - Take it for a test drive:

```shell
curl -d 'https://d1.awsstatic.com/whitepapers/aws-overview.pdf' http://localhost:8080/function/convert-to-text
```

```python
from requests import post
data='https://d1.awsstatic.com/whitepapers/aws-overview.pdf'
headers = { 'Content-Type': 'application/json'
r = post('http://localhost:8080/function/convert-to-text', headers=headers, data=data)
print(r.text)
```
