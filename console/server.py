"""Private read-only JEV console. Standard-library service behind HTTPS nginx."""
import argparse
import base64
import hashlib
import hmac
import json
import math
import re
import secrets
import threading
import time
from collections import OrderedDict
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

PREFIX = '/jev-console/'


class ConsoleServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, config, directory):
        for key, length in [('salt', 32), ('password_hash', 64), ('session_key', 64), ('ingest_token', 64)]:
            if not re.fullmatch('[0-9a-f]{' + str(length) + '}', config.get(key, '')):
                raise ValueError('invalid_private_configuration')
        origin = urlsplit(config.get('origin', ''))
        if origin.scheme != 'https' or not origin.hostname or origin.path or origin.query or origin.fragment or origin.username:
            raise ValueError('invalid_private_origin')
        super().__init__(address, Handler)
        self.config = config
        self.directory = Path(directory)
        self.latest = None
        self.lock = threading.Lock()
        self.attempts = OrderedDict()

    def signature(self, payload):
        return hmac.new(self.config['session_key'].encode(), payload.encode(), hashlib.sha256).hexdigest()

    def issue(self):
        value = f'{int(time.time()) + 43200}.{secrets.token_hex(16)}'
        return value + '.' + self.signature(value)

    def valid(self, value):
        try:
            expiry, nonce, signature = value.split('.')
            return len(nonce) == 32 and int(expiry) > time.time() and int(expiry) <= time.time() + 43201 and hmac.compare_digest(signature, self.signature(expiry + '.' + nonce))
        except (ValueError, TypeError):
            return False

    def password(self, value):
        if not isinstance(value, str) or len(value) > 256:
            return False
        digest = hashlib.pbkdf2_hmac('sha256', value.encode(), bytes.fromhex(self.config['salt']), 240000).hex()
        return hmac.compare_digest(digest, self.config['password_hash'])


class Handler(BaseHTTPRequestHandler):
    server_version = 'JEVConsole'

    def log_message(self, *_):
        pass  # No credentials, request bodies, viewer IPs or game chat in logs.

    def send(self, code, body, mime='application/json; charset=utf-8', cookie=None):
        if not isinstance(body, bytes):
            body = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Robots-Tag', 'noindex, nofollow, noarchive')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(body)

    def authenticated(self):
        try:
            cookie = SimpleCookie(self.headers.get('Cookie', ''))
            return self.server.valid(cookie['jev_review'].value) if 'jev_review' in cookie else False
        except Exception:
            return False

    def route(self):
        return urlsplit(self.path).path

    def do_GET(self):
        route = self.route()
        if route == PREFIX + 'health':
            return self.send(200, {'ok': True})
        if route == PREFIX or route == PREFIX + 'index.html':
            name = 'index.html' if self.authenticated() else 'login.html'
            return self.send(200, (self.server.directory / name).read_bytes(), 'text/html; charset=utf-8')
        if route == PREFIX + 'state':
            if not self.authenticated():
                return self.send(401, {'error': 'login_required'})
            with self.server.lock:
                latest = self.server.latest
            return self.send(200, latest or {'receivedAt': None, 'state': None})
        return self.send(404, {'error': 'not_found'})

    def do_POST(self):
        route = self.route()
        if route not in (PREFIX + 'login', PREFIX + 'logout', PREFIX + 'ingest'):
            return self.send(404, {'error': 'not_found'})
        if route != PREFIX + 'ingest' and self.headers.get('Origin') != self.server.config['origin']:
            return self.send(403, {'error': 'origin'})
        if route == PREFIX + 'ingest':
            expected = 'Bearer ' + self.server.config['ingest_token']
            if not hmac.compare_digest(self.headers.get('Authorization', '').encode(), expected.encode()):
                return self.send(404, {'error': 'not_found'})
        if route == PREFIX + 'logout':
            return self.send(200, {'ok': True}, cookie='jev_review=; Path=/jev-console/; Max-Age=0; Secure; HttpOnly; SameSite=Strict')
        try:
            length = int(self.headers.get('Content-Length', '0'))
            maximum = 350000 if route.endswith('/ingest') else 2048
            if length <= 0 or length > maximum:
                return self.send(413, {'error': 'size'})
            self.connection.settimeout(5)
            data = json.loads(self.rfile.read(length))
        except (ValueError, TimeoutError):
            return self.send(400, {'error': 'invalid_json'})
        if not isinstance(data, dict):
            return self.send(400, {'error': 'invalid_object'})
        if route.endswith('/login'):
            ip = self.headers.get('X-Real-IP', self.client_address[0])  # nginx overwrites this header.
            now = time.time()
            with self.server.lock:
                attempts = [at for at in self.server.attempts.pop(ip, []) if at > now - 300]
                if len(attempts) >= 8:
                    self.server.attempts[ip] = attempts
                    return self.send(429, {'error': 'retry_later'})
                self.server.attempts[ip] = attempts + [now]
                while len(self.server.attempts) > 2000:
                    self.server.attempts.popitem(last=False)
            if not self.server.password(data.get('password')):
                return self.send(401, {'error': 'incorrect_password'})
            with self.server.lock:
                self.server.attempts.pop(ip, None)
            cookie = 'jev_review=' + self.server.issue() + '; Path=/jev-console/; Max-Age=43200; Secure; HttpOnly; SameSite=Strict'
            return self.send(200, {'ok': True}, cookie=cookie)
        # Publisher sends an explicit public telemetry projection, never raw bridge
        # commands/session credentials. Enforce the top-level contract again here.
        allowed = {'updatedAt', 'candidate', 'phase', 'game', 'self', 'executor', 'actions', 'enemies', 'cloud', 'timeline', 'route', 'metrics', 'streak', 'frame', 'trial', 'result', 'zone', 'mapView', 'navigation', 'knowledge'}
        def safe_fields(value):
            if isinstance(value, dict):
                return all(not re.search(r'token|password|secret|session|authorization|cookie|bridge|path|processId', key, re.I) and safe_fields(item) for key, item in value.items() if key != 'pathStatus')
            if isinstance(value, list):
                return all(safe_fields(item) for item in value)
            return not isinstance(value, float) or math.isfinite(value)

        if set(data) - allowed or not isinstance(data.get('updatedAt'), (int, float)) or not safe_fields(data):
            return self.send(400, {'error': 'invalid_telemetry'})
        frame = data.get('frame')
        if frame is not None:
            try:
                decoded = base64.b64decode(frame, validate=True)
                if len(decoded) > 200000 or not decoded.startswith(b'\xff\xd8'):
                    raise ValueError()
            except (ValueError, TypeError):
                return self.send(400, {'error': 'invalid_frame'})
        with self.server.lock:
            self.server.latest = {'receivedAt': int(time.time() * 1000), 'state': data}
        return self.send(200, {'ok': True})


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    parser.add_argument('--port', type=int, default=8094)
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    ConsoleServer(('127.0.0.1', args.port), config, Path(__file__).parent).serve_forever()
