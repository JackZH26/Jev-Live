import base64
import http.client
import io
import json
import struct
import threading
import unittest
import wave
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from unittest.mock import Mock
from voice_reference import CloneVoice, decode_reference
from local_voice import make_handler


def reference(seconds=4, sample=1200):
    output = io.BytesIO()
    with wave.open(output, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(24000)
        audio.writeframes(struct.pack('<h', sample) * (seconds * 24000))
    return {'audio': base64.b64encode(output.getvalue()).decode(), 'text': 'Welcome back. Let us enjoy the game together.'}


class ReferenceTests(unittest.TestCase):
    def test_one_prompt_is_reused_for_all_languages_and_invalidated_on_reference_changes(self):
        model = Mock()
        model.create_voice_clone_prompt.side_effect = [['first'], ['second'], ['third']]
        model.generate_voice_clone.return_value = ([[]], 24000)
        voice = CloneVoice(model)
        ref = reference()
        for language in ['English', 'Chinese', 'Japanese', 'Korean']:
            voice.generate({'reference': ref, 'text': 'sample', 'language': language})
            self.assertEqual(model.generate_voice_clone.call_args.kwargs['voice_clone_prompt'], ['first'])
            self.assertEqual(model.generate_voice_clone.call_args.kwargs['language'], language)
        self.assertEqual(model.create_voice_clone_prompt.call_count, 1)
        voice.generate({'reference': {**ref, 'text': 'A corrected English transcript.'}, 'text': 'sample', 'language': 'Chinese'})
        voice.generate({'reference': reference(sample=1300), 'text': 'sample', 'language': 'Chinese'})
        self.assertEqual(model.create_voice_clone_prompt.call_count, 3)
        self.assertFalse(model.create_voice_clone_prompt.call_args.kwargs['x_vector_only_mode'])

    def test_rejects_missing_silent_short_long_remote_and_malformed_reference(self):
        for ref in [None, {}, reference(2), reference(21), reference(sample=0), {**reference(), 'text': ''}, {**reference(), 'text': '中文参考文字而不是英语'}, {**reference(), 'audio': 'https://example.com/voice.wav'}, {**reference(), 'audio': base64.b64encode(b'bad').decode()}]:
            with self.subTest(reference_type=str(type(ref))):
                with self.assertRaises(ValueError):
                    decode_reference(ref)

    def test_http_clone_requires_reference_and_never_accepts_a_preset_or_browser_origin(self):
        engine = Mock(ready=True, info={'provider': 'qwen3-tts-clone', 'speakers': []})
        engine.speech.return_value = (b'wave', {})
        server = ThreadingHTTPServer(('127.0.0.1', 0), BaseHTTPRequestHandler)
        port = server.server_address[1]
        server.RequestHandlerClass = make_handler(engine, 'qwen-clone', port)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        def post(data, headers=None):
            client = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
            try:
                client.request('POST', '/speech', json.dumps(data), {'Content-Type': 'application/json', **(headers or {})})
                response = client.getresponse()
                response.read()
                return response.status
            finally:
                client.close()
        try:
            data = {'language': 'ja', 'text': 'こんにちは。', 'reference': reference()}
            self.assertEqual(post(data), 200)
            self.assertEqual(engine.speech.call_args.args[0]['language'], 'Japanese')
            self.assertEqual(post({**data, 'reference': None}), 400)
            self.assertEqual(post({**data, 'voice': 'ryan'}), 400)
            self.assertEqual(post({**data, 'language': []}), 400)
            self.assertEqual(post(data, {'Origin': 'https://example.com'}), 403)
            self.assertEqual(post(data, {'Host': 'evil.example'}), 403)
            self.assertEqual(engine.speech.call_count, 1)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(2)


if __name__ == '__main__':
    unittest.main()
