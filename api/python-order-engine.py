from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import traceback

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PYTHON_SCRIPTS = os.path.join(ROOT, 'scripts', 'python')
if PYTHON_SCRIPTS not in sys.path:
    sys.path.insert(0, PYTHON_SCRIPTS)

try:
    import order_intelligence
except Exception as exc:  # pragma: no cover
    order_intelligence = None
    IMPORT_ERROR = exc
else:
    IMPORT_ERROR = None

MAX_BODY_BYTES = 900000


def _secret():
    return (os.environ.get('PYTHON_INTERNAL_SECRET') or os.environ.get('CRON_SECRET') or '').strip()


class handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload, separators=(',', ':')).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._json(200, {
            'ok': True,
            'engine': 'python-order-intelligence',
            'runtime': 'vercel-python-function',
            'ready': IMPORT_ERROR is None,
            'route': '/api/python-order-engine'
        })

    def do_POST(self):
        try:
            expected = _secret()
            provided = (self.headers.get('x-86-python-internal') or '').strip()
            if not expected:
                return self._json(500, {'ok': False, 'engine': 'python-order-intelligence', 'error': 'Python internal route secret is not configured. Set CRON_SECRET or PYTHON_INTERNAL_SECRET.'})
            if provided != expected:
                return self._json(401, {'ok': False, 'engine': 'python-order-intelligence', 'error': 'Python internal route authorization failed.'})
            if IMPORT_ERROR is not None or order_intelligence is None:
                return self._json(500, {'ok': False, 'engine': 'python-order-intelligence', 'error': f'Python order engine import failed: {IMPORT_ERROR}'})
            length = int(self.headers.get('content-length') or '0')
            if length > MAX_BODY_BYTES:
                return self._json(413, {'ok': False, 'engine': 'python-order-intelligence', 'error': 'Python order payload is too large. Narrow the date window or reduce history.'})
            raw = self.rfile.read(length).decode('utf-8') if length else '{}'
            payload = json.loads(raw or '{}')
            result = order_intelligence.analyze(payload)
            result['runtime'] = 'vercel-python-function'
            return self._json(200 if result.get('ok') is not False else 500, result)
        except Exception as exc:
            return self._json(500, {
                'ok': False,
                'engine': 'python-order-intelligence',
                'runtime': 'vercel-python-function',
                'error': str(exc),
                'trace': traceback.format_exc(limit=3)
            })
