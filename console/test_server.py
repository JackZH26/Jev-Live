import hashlib
import http.client
import importlib.util
import json
import secrets
import threading
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('console_server', Path(__file__).with_name('server.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password = secrets.token_urlsafe(18)
        salt = secrets.token_hex(16)
        cls.config = dict(origin='https://etc.jackz.co', salt=salt, password_hash=hashlib.pbkdf2_hmac('sha256', cls.password.encode(), bytes.fromhex(salt), 240000).hex(), session_key=secrets.token_hex(32), ingest_token=secrets.token_hex(32))
        cls.server = module.ConsoleServer(('127.0.0.1', 0), cls.config, Path(__file__).parent)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def request(self, method, route, body=None, headers=None):
        conn = http.client.HTTPConnection(*self.server.server_address)
        conn.request(method, '/jev-console/' + route, json.dumps(body) if body is not None else None, headers or {})
        r = conn.getresponse()
        result = r.status, dict(r.getheaders()), r.read()
        conn.close()
        return result

    def test_private_data_and_assets(self):
        self.assertEqual(self.request('GET', 'state')[0], 401)
        self.assertNotIn(b'latencyChart', self.request('GET', '')[2])
        self.assertEqual(self.request('GET', '../server.py')[0], 404)

    def test_password_origin_and_cookie(self):
        self.assertEqual(self.request('POST', 'login', {'password': self.password})[0], 403)
        status, headers, _ = self.request('POST', 'login', {'password': self.password}, {'Origin': self.config['origin']})
        self.assertEqual(status, 200)
        cookie = headers['Set-Cookie']
        for attribute in ('Secure', 'HttpOnly', 'SameSite=Strict'):
            self.assertIn(attribute, cookie)
        self.assertIn(b'latencyChart', self.request('GET', '', headers={'Cookie': cookie.split(';')[0]})[2])
        self.assertFalse(self.server.valid(self.server.issue()[:-1] + 'x'))

    def test_publisher_auth_and_secret_rejection(self):
        self.assertEqual(self.request('POST', 'ingest', {'updatedAt': 1})[0], 404)
        headers = {'Authorization': 'Bearer ' + self.config['ingest_token']}
        self.assertEqual(self.request('POST', 'ingest', {'updatedAt': 1, 'token': 'no'}, headers)[0], 400)
        self.assertEqual(self.request('POST', 'ingest', {'updatedAt': 1, 'self': {'sessionToken': 'no'}}, headers)[0], 400)
        self.assertEqual(self.request('POST', 'ingest', {'updatedAt': float('nan')}, headers)[0], 400)
        self.assertEqual(self.request('POST', 'ingest', {'updatedAt': 1}, {'Authorization': '\u00e9'})[0], 404)
        self.assertEqual(self.request('POST', 'ingest', {'updatedAt': 1, 'self': {'health': 80}}, headers)[0], 200)

    def test_login_rate_limit(self):
        headers = {'Origin': self.config['origin'], 'X-Real-IP': 'test-client'}
        for _ in range(8):
            self.assertEqual(self.request('POST', 'login', {'password': 'wrong'}, headers)[0], 401)
        self.assertEqual(self.request('POST', 'login', {'password': self.password}, headers)[0], 429)


if __name__ == '__main__':
    unittest.main()
