#!/usr/bin/env python3

import logging
from os import environ
from json import dumps, loads
from subprocess import Popen, PIPE

logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

def byte2json(b):
    doc = loads(b.decode("utf-8").replace("'", '"'))
    if doc[0]["X-TIKA:content"]:
        return doc[0]["X-TIKA:content"]
    else:
        return doc

def handle(req):
    """handle a request to the function
    Args:
        req (str): request body
    """
    env = environ.copy()
    p = Popen(["java","org.apache.tika.cli.TikaCLI", "-J", "-h", "{}".format(req)], stdout=PIPE, stderr=PIPE, env=env)
    out, err = p.communicate()
    data = []
    if len(out) > 0:
        data.append(byte2json(out))
    if len(out) < 1 and len(err) > 0:
        data.append({"error":"{}".format(err), "url":"{}".format(req)})
    return "\n\n".join(data).rstrip()
