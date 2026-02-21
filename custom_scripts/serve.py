import os
import gzip
import io
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class COOPCOEPHandler(SimpleHTTPRequestHandler):
    # Ensure .wasm files are served with the correct MIME type
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.wasm': 'application/wasm',
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
    }

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Cache-Control", self._cache_control_for_path())
        super().end_headers()

    def _cache_control_for_path(self):
        path = self.path.split("?", 1)[0]
        if path.endswith(".html"):
            return "no-store"

        # Long-lived cache for WASM and vendor libs
        long_lived = path.endswith(".wasm") or "/wasm/antigravity/vendor/" in path
        if long_lived:
            return "public, max-age=31536000, immutable"

        # Standard cache for other assets
        if path.endswith((".js", ".mjs", ".css", ".xml", ".json", ".png", ".jpg", ".jpeg", ".svg")):
            return "public, max-age=3600"

        return "public, max-age=300"

    def do_GET(self):
        """Serve a GET request with optional Gzip compression."""
        if self.should_compress():
            return self.serve_compressed()
        return super().do_GET()

    def should_compress(self):
        """Determine if the requested resource should be compressed."""
        accept_encoding = self.headers.get('Accept-Encoding', '')
        if 'gzip' not in accept_encoding:
            return False
        
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return False
            
        # Compress heavy text-based or WASM files
        ext = os.path.splitext(path)[1].lower()
        return ext in ['.wasm', '.js', '.mjs', '.css', '.html', '.xml', '.json']

    def serve_compressed(self):
        """Compress the content and serve it."""
        path = self.translate_path(self.path)
        with open(path, 'rb') as f:
            content = f.read()

        gz_body = io.BytesIO()
        with gzip.GzipFile(fileobj=gz_body, mode='wb', compresslevel=6) as f:
            f.write(content)
        
        compressed_content = gz_body.getvalue()

        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(compressed_content)))
        self.end_headers()
        self.wfile.write(compressed_content)

if __name__ == '__main__':
    port = 8000
    print(f"Serving on port {port} with COOP/COEP/CORP + Gzip + Caching...")
    print(f"Open http://localhost:{port}/wasm/antigravity/index.html")

    server = ThreadingHTTPServer(('0.0.0.0', port), COOPCOEPHandler)
    server.serve_forever()
