#!/usr/bin/env python3

import sys
import handler

def get_stdin():
    buf = ""
    for line in sys.stdin:
        buf = buf + line
    return buf

if(__name__ == "__main__"):
    st = get_stdin()
    if st == "" or len(st) < 1:
        raise Exception("input string is empty")

    print(handler.handle(st))
