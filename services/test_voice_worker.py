import time
import unittest
from voice_worker import IsolatedVoice, VoiceUnavailable

class FakeEngine:
    def __init__(self, config):
        self.info = {'provider': 'test'}
    def speech(self, request):
        if request.get('stall'):
            time.sleep(60)
        return b'wave', {}

class WorkerTests(unittest.TestCase):
    def ready(self, worker):
        deadline = time.monotonic() + 10
        while not worker.ready and time.monotonic() < deadline:
            time.sleep(.02)
        self.assertTrue(worker.ready)
    def test_native_stall_is_terminated_and_next_request_recovers(self):
        worker = IsolatedVoice(FakeEngine, {}, deadline=.2, load_deadline=10)
        try:
            self.ready(worker)
            old_pid = worker.process.pid
            start = time.monotonic()
            with self.assertRaises(VoiceUnavailable):
                worker.speech({'stall': True})
            self.assertLess(time.monotonic() - start, 3)
            self.ready(worker)
            self.assertNotEqual(worker.process.pid, old_pid)
            self.assertEqual(worker.speech({})[0], b'wave')
        finally:
            worker.close()
        self.assertFalse(worker.ready)
        self.assertIsNone(worker.process)
    def test_repeated_stalls_trip_circuit(self):
        worker = IsolatedVoice(FakeEngine, {}, deadline=.1, load_deadline=10)
        try:
            for _ in range(3):
                self.ready(worker)
                with self.assertRaises(VoiceUnavailable):
                    worker.speech({'stall': True})
            time.sleep(.2)
            self.assertFalse(worker.ready)
            self.assertIsNone(worker.process)
            self.assertEqual(worker.restarts, 3)
        finally:
            worker.close()

if __name__ == '__main__':
    unittest.main()
