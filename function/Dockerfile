FROM python:3-slim-stretch
MAINTAINER Said Sef <said@saidsef.co.uk>

ENV APACHE_TIKA_VERSION 1.18
ENV CLASSPATH /opt/tika/tika-app.jar:/opt/tika/libs/*
ENV OPENFAAS_VERSION 0.8.3
ENV SQLITE_JDBC 3.21.0
ENV JBIG2_IMAGEIO 2.0
ENV JAI_IMAGEIO_JPEG2000 1.3.0
ENV fprocess "python3 index.py"
ENV PYTHONIOENCODING utf8
ENV TIKA_SERVER_JAR /opt/tika/tika-app.jar

WORKDIR /opt/tika

COPY . /opt/tika

RUN apt-get update && \
    mkdir -p /usr/share/man/man1 /opt/tika/libs && \
    apt-get install -yy openjdk-8-jre-headless curl && \
    curl -vSL http://www.mirrorservice.org/sites/ftp.apache.org/tika/tika-app-${APACHE_TIKA_VERSION}.jar -o /opt/tika/tika-app.jar && \
    curl -vSL https://github.com/openfaas/faas/releases/download/${OPENFAAS_VERSION}/fwatchdog -o /usr/bin/watchdog && \
    curl -vSL http://central.maven.org/maven2/org/xerial/sqlite-jdbc/${SQLITE_JDBC}/sqlite-jdbc-${SQLITE_JDBC}.jar -o /opt/tika/libs/sqlite-jdbc.jar && \
    curl -vSL http://central.maven.org/maven2/com/levigo/jbig2/levigo-jbig2-imageio/${JBIG2_IMAGEIO}/levigo-jbig2-imageio-${JBIG2_IMAGEIO}.jar -o /opt/tika/libs/levigo-jbig2-imageio.jar && \
    curl -vSL http://central.maven.org/maven2/com/github/jai-imageio/jai-imageio-jpeg2000/${JAI_IMAGEIO_JPEG2000}/jai-imageio-jpeg2000-${JAI_IMAGEIO_JPEG2000}.jar -o /opt/tika/libs/jai-imageio-jpeg2000.jar && \
    apt-get purge -yy curl && apt-get autoremove -yy && \
    rm -rf /var/cache/apt/* /tmp/* && \
    chmod a+x /usr/bin/watchdog /opt/tika/index.py /opt/tika/handler.py

HEALTHCHECK --interval=1s CMD [ -e /tmp/.lock ] || exit 1

CMD ["watchdog"]
