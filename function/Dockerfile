FROM python:3-slim-stretch
MAINTAINER Said Sef <said@saidsef.co.uk>

ENV APACHE_TIKA_VERSION 1.17
ENV OPENFAAS_VERSION 0.7.8
ENV fprocess "python3 index.py"
ENV PYTHONIOENCODING utf8
ENV TIKA_SERVER_JAR /opt/tika/tika-app.jar

WORKDIR /opt/tika

COPY . /opt/tika

RUN apt-get update && \
    mkdir -p /usr/share/man/man1 && \
    apt-get install -yy openjdk-8-jre-headless curl && \
    curl -vSL http://www.mirrorservice.org/sites/ftp.apache.org/tika/tika-app-${APACHE_TIKA_VERSION}.jar -o /opt/tika/tika-app.jar && \
    curl -vSL https://github.com/openfaas/faas/releases/download/${OPENFAAS_VERSION}/fwatchdog -o /usr/bin/watchdog && \
    apt-get purge -yy curl && apt-get autoremove -yy && \
    rm -rf /var/cache/apt/* && \
    chmod a+x /usr/bin/watchdog /opt/tika/index.py /opt/tika/handler.py

HEALTHCHECK --interval=1s CMD [ -e /tmp/.lock ] || exit 1

CMD ["watchdog"]
