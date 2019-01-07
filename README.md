# Apache Tika Implementation [![Build Status](https://travis-ci.org/saidsef/faas-convert-to-text.svg?branch=master)](https://travis-ci.org/saidsef/faas-convert-to-text)

The Apache Tika™ toolkit detects and extracts metadata and text from over a thousand different file types (such as PPT, XLS, and PDF). All of these file types can be parsed through a single interface, making Tika useful for search engine indexing, content analysis, translation, and much more.

## Prerequisite

 - OpenFaas Services [or]
 - Kubernetes Cluster

## Deployment - OpenFaas

From GitHub:

```shell
git clone https://github.com/saidsef/faas-convert-to-text.git
cd faas-convert-to-text/
faas-cli deploy -f ./convert-to-text.yml
```

```shell
faas-cli deploy -f https://raw.githubusercontent.com/saidsef/faas-convert-to-text/master/convert-to-text.yml
```

Take it for a test drive:

```shell
curl -d 'https://d1.awsstatic.com/whitepapers/aws-overview.pdf' http://localhost:8080/function/convert-to-text
```

```python
from requests import post
data='https://d1.awsstatic.com/whitepapers/aws-overview.pdf'
r = post('http://localhost:8080/function/convert-to-text', data=data)
print(r.text)
```
