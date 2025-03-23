#!/usr/bin/env python3

import logging
import asyncio
from os import environ
from json import loads, dumps, JSONDecodeError
from subprocess import PIPE
from typing import Dict, List, Union

logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG, handlers=[logging.StreamHandler()])


def byte2json(b: Dict) -> str | Dict:
  """Convert bytes to JSON.

  Args:
  b (bytes): Bytes to be converted to JSON
  """

  doc = loads(b.decode("utf-8", errors="replace").replace("'", '"'))
  if doc[0]["X-TIKA:content"]:
    return doc[0]["X-TIKA:content"]
  else:
    return doc

async def handle(req: str) -> str:
  """Handle a request to extract text using Apache Tika.

  Args:
  req (str): URL or file path to be processed by Tika

  Returns:
  str: JSON response with extracted text or error information

  Raises:
  ValueError: If the request is empty or invalid
  """

  # Use a copy of the environment to avoid modifying the global state
  env = environ.copy()

  if not req or not isinstance(req, str):
    raise ValueError("Request must be a non-empty string")

  if "CLASSPATH" not in env:
    # Validate CLASSPATH existence
    return dumps({"error": "CLASSPATH environment variable is not set", "url": req})

  try:
    # Use asyncio subprocess for better async handling
    process = await asyncio.create_subprocess_exec(
      "java", "-cp", env["CLASSPATH"], "org.apache.tika.cli.TikaCLI",
      "-J", "-t", req, stdout=PIPE, stderr=PIPE, env=env
    )

    # Set a timeout for the process
    out, err = await asyncio.wait_for(process.communicate(), timeout=60.0)

    responses: List[Dict[str, Union[str, Dict]]] = []

    if out:
      try:
        json_data = byte2json(out)
        responses.append(json_data)
      except JSONDecodeError:
        # Handle non-JSON output
        responses.append({"text": out.decode("utf-8", errors="replace")})

    if not out and err:
      error_message = err.decode("utf-8", errors="replace")
      responses.append({"error": error_message, "url": req})

    return "\n\n".join(dumps(resp) for resp in responses).rstrip()

  except asyncio.TimeoutError:
    return dumps({"error": "Process timed out", "url": req})
  except Exception as e:
    return dumps({"error": f"An unexpected error occurred: {str(e)}", "url": req})
