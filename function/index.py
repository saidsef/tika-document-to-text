#!/usr/bin/env python3

import os
import logging
import handler
from json import dumps, loads
from flask import Flask, request, jsonify, Response
from prometheus_flask_exporter import PrometheusMetrics

PORT = os.environ.get("PORT", "7070")
HOST = os.environ.get("POD_IP", "127.0.0.1")
app = Flask(__name__)

PrometheusMetrics(app, group_by='url_rule')

logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)


@app.route('/', methods=['GET'])
def index():
  return jsonify(['{} {}'.format(list(rule.methods), rule) for rule in app.url_map.iter_rules() if 'static' not in str(rule)])


@app.route('/api/v1/url', methods=['GET', 'POST'])
async def transform():
  if request.method == 'POST':
    j = loads(request.get_data())
    url = j['fileUrl']
    data = await handler.handle(url)
    return Response(dumps(
        {'fileUrl': url, 'data': data}
    ), mimetype='application/json')
  else:
    return Response(dumps(
        {'message': 'healthy'}
    ), mimetype='application/json')


if __name__ == '__main__':
    app.run(host=HOST, port=PORT)
