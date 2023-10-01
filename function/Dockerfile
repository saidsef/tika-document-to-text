FROM docker.io/python:3.11-buster

LABEL maintainer "Said Sef <said@saidsef.co.uk> (saidsef.co.uk/)"
LABEL org.opencontainers.image.source "https://github.com/saidsef/tika-document-to-text"
LABEL org.opencontainers.image.description "Apache Tika API Server - Python"

ENV APACHE_TIKA_VERSION 1.28.5
ENV CLASSPATH "/opt/tika/tika-server.jar:/opt/tika/libs"
ENV JAI_IMAGEIO_JPEG2000 1.4.0
ENV JBIG2_IMAGEIO 3.0.4
ENV MS 180000
ENV POD_IP ${POD_IP:-0.0.0.0}
ENV PORT ${PORT:-7070}
ENV PYTHONIOENCODING utf8
ENV SQLITE_JDBC 3.40.0.0

WORKDIR /opt/tika

COPY . /opt/tika
# https://mvnrepository.com/artifact/org.apache.tika
RUN apt-get update && \
    mkdir -p /usr/share/man/man1 /opt/tika/libs && \
    apt-get install -yy openjdk-11-jre-headless curl && \
    curl -vSL https://archive.apache.org/dist/tika/${APACHE_TIKA_VERSION}/tika-app-${APACHE_TIKA_VERSION}.jar -o /opt/tika/tika-app.jar && \
    curl -vSL https://repo1.maven.org/maven2/org/apache/tika/tika-core/${APACHE_TIKA_VERSION}/tika-core-${APACHE_TIKA_VERSION}.jar -o /opt/tika/libs/tika-core.jar && \
    curl -vSL https://repo1.maven.org/maven2/org/apache/tika/tika-xmp/${APACHE_TIKA_VERSION}/tika-xmp-${APACHE_TIKA_VERSION}.jar -o /opt/tika/libs/tika-xmp.jar && \
    curl -vSL https://repo1.maven.org/maven2/org/apache/tika/tika-serialization/${APACHE_TIKA_VERSION}/tika-serialization-${APACHE_TIKA_VERSION}.jar -o /opt/tika/libs/tika-serialization.jar && \
    curl -vSL https://repo1.maven.org/maven2/org/apache/tika/tika-langdetect/${APACHE_TIKA_VERSION}/tika-langdetect-${APACHE_TIKA_VERSION}.jar -o /opt/tika/libs/tika-langdetect.jar && \
    curl -vSL https://repo1.maven.org/maven2/org/apache/tika/tika-translate/${APACHE_TIKA_VERSION}/tika-translate-${APACHE_TIKA_VERSION}.jar -o /opt/tika/libs/tika-translate.jar && \
    curl -vSL https://repo1.maven.org/maven2/org/apache/tika/tika-nlp/${APACHE_TIKA_VERSION}/tika-nlp-${APACHE_TIKA_VERSION}.jar -o /opt/tika/libs/tika-nlp.jar && \
    curl -vSL https://repo1.maven.org/maven2/org/apache/tika/tika-dl/${APACHE_TIKA_VERSION}/tika-dl-${APACHE_TIKA_VERSION}.jar -o /opt/tika/libs/tika-dl.jar && \
    curl -vSL https://repo1.maven.org/maven2/org/xerial/sqlite-jdbc/${SQLITE_JDBC}/sqlite-jdbc-${SQLITE_JDBC}.jar -o /opt/tika/libs/sqlite-jdbc.jar && \
    curl -vSL https://repo1.maven.org/maven2/org/apache/pdfbox/jbig2-imageio/${JBIG2_IMAGEIO}/jbig2-imageio-${JBIG2_IMAGEIO}.jar -o /opt/tika/libs/levigo-jbig2-imageio.jar && \
    curl -vSL https://repo1.maven.org/maven2/com/github/jai-imageio/jai-imageio-jpeg2000/${JAI_IMAGEIO_JPEG2000}/jai-imageio-jpeg2000-${JAI_IMAGEIO_JPEG2000}.jar -o /opt/tika/libs/jai-imageio-jpeg2000.jar && \
    apt-get purge -yy curl && apt-get autoremove -yy && \
    rm -rf /var/cache/apt/* /tmp/* && \
    pip install --no-cache-dir -r requirements.txt && \
    fc-cache -f && \
    chmod a+x /opt/tika/index.py /opt/tika/handler.py && \
    chown nobody -R /opt/tika

USER nobody

EXPOSE ${PORT}

HEALTHCHECK --interval=60s --timeout=10s CMD curl --fail http://localhost:${PORT}/ || exit 1

CMD ["python3", "index.py"]
