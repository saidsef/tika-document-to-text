from subprocess import Popen, PIPE
from json import dumps, loads

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
    p = Popen(["java","-jar","tika-app.jar", "-J", "-T", "-r", "{}".format(req)], stdout=PIPE, stderr=PIPE)
    out, err = p.communicate()
    data = []
    if len(out) > 0:
        data.append(byte2json(out))
    if len(out) < 1 and len(err) > 0:
        data.append({"error":"{}".format(err), "url":"{}".format(req)})
    return "\n\n".join(data)
