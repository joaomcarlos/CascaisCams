#!/usr/bin/env python3
import http.server
import functools

ROOT = "/home/jc/Projects/personal/CascaisCams"


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.startswith("/live/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(
        ("127.0.0.1", 8931), functools.partial(Handler, directory=ROOT)
    ).serve_forever()
