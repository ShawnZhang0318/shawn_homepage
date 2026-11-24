"""Serve the room review or the full portfolio locally on loopback."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial
import argparse
import re
from io import BytesIO
from urllib.parse import urlsplit, urlunsplit


class WindowReviewHandler(SimpleHTTPRequestHandler):
    site_mode = False

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def send_head(self):
        request = urlsplit(self.path)
        if self.site_mode and request.path in ('/', '/index.html'):
            self.send_response(302)
            self.send_header('Location', urlunsplit(('', '', '/window-study/', request.query, '')))
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        path = Path(self.translate_path(self.path))
        cv = Path(self.directory).resolve() / 'CV'
        resolved = path.resolve()
        if resolved == cv or cv in resolved.parents:
            self.send_error(404)
            return None
        if path.suffix.lower() not in {'.mp4', '.webm'} or not path.is_file():
            return super().send_head()
        size = path.stat().st_size
        header = self.headers.get('Range')
        start, end = 0, size - 1
        if header is not None:
            span = re.fullmatch(r'bytes=(\d*)-(\d*)', header)
            if span and any(span.groups()):
                first, last = span.groups()
                start = int(first) if first else max(size - int(last), 0)
                end = min(int(last), size - 1) if first and last else size - 1
            else:
                start = size
            if start > end or start >= size:
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{size}')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return None
        self.send_response(206 if header else 200)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(end - start + 1))
        if header:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        if self.command == 'HEAD':
            return None
        with path.open('rb') as source:
            source.seek(start)
            return BytesIO(source.read(end - start + 1))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8805)
    parser.add_argument('--site', action='store_true', help='Include the portfolio pages')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    if args.site:
        root = root.parent
        WindowReviewHandler.site_mode = True
    entry = '/' if args.site else '/review.html'
    print(f'Preview: http://127.0.0.1:{args.port}{entry}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), partial(WindowReviewHandler, directory=str(root))).serve_forever()
