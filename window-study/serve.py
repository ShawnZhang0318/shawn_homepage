"""Serve only this review package on loopback; no deployment."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial
import argparse
import re
from io import BytesIO


class WindowReviewHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = Path(self.translate_path(self.path))
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
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    print(f'Window review: http://127.0.0.1:{args.port}/review.html', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), partial(WindowReviewHandler, directory=str(root))).serve_forever()
