"""Disposable inference worker with a hard deadline and bounded recovery."""
import multiprocessing as mp
import threading
import time


def _entry(connection, factory, config):
    try:
        engine = factory(config)
        connection.send(('ready', engine.info))
        while True:
            request = connection.recv()
            try:
                audio, headers = engine.speech(request)
                if not isinstance(audio, bytes) or len(audio) > 4_000_000:
                    raise ValueError('audio_size')
                connection.send(('audio', audio, headers))
            except Exception:
                connection.send(('error',))
    except (EOFError, BrokenPipeError):
        pass
    except Exception:
        try:
            connection.send(('error',))
        except (OSError, EOFError):
            pass
    finally:
        connection.close()


class VoiceUnavailable(Exception):
    pass


class VoiceBusy(VoiceUnavailable):
    pass


class IsolatedVoice:
    def __init__(self, factory, config, deadline=25, load_deadline=240):
        self.factory, self.config = factory, config
        self.deadline, self.load_deadline = deadline, load_deadline
        self.context = mp.get_context('spawn')
        self.lock = threading.Lock()
        self.process = self.connection = None
        self.ready = False
        self.info = {}
        self.closed = False
        self.restarts = 0
        self._warming = False
        self.warm()

    def warm(self):
        if self.closed or self._warming or self.restarts >= 3:
            return
        self._warming = True
        threading.Thread(target=self._load, daemon=True).start()

    def _dispose(self):
        self.ready = False
        if self.process:
            if self.process.is_alive():
                self.process.terminate()
            self.process.join(2)
            if self.process.is_alive():
                self.process.kill()
                self.process.join(2)
            self.process.close()
            self.process = None
        if self.connection:
            self.connection.close()
            self.connection = None

    def _load(self):
        with self.lock:
            try:
                if self.closed:
                    return
                self._dispose()
                self.connection, child = self.context.Pipe()
                self.process = self.context.Process(target=_entry, args=(child, self.factory, self.config), daemon=True)
                self.process.start()
                child.close()
                if not self.connection.poll(self.load_deadline):
                    raise VoiceUnavailable()
                response = self.connection.recv()
                if response[0] != 'ready':
                    raise VoiceUnavailable()
                self.info, self.ready = response[1], True
            except (OSError, EOFError, VoiceUnavailable):
                self.restarts += 1
                self._dispose()
            finally:
                self._warming = False

    def speech(self, request):
        if not self.lock.acquire(blocking=False):
            raise VoiceBusy()
        failed = False
        try:
            if self.closed or not self.ready:
                raise VoiceUnavailable()
            start = time.monotonic()
            self.connection.send(request)
            if not self.connection.poll(self.deadline):
                raise TimeoutError()
            response = self.connection.recv()
            if response[0] != 'audio' or time.monotonic() - start > self.deadline:
                raise VoiceUnavailable()
            return response[1], response[2]
        except (OSError, EOFError, TimeoutError, VoiceUnavailable):
            if self.ready:
                self.restarts += 1
                self._dispose()
                failed = True
            raise VoiceUnavailable() from None
        finally:
            self.lock.release()
            if failed:
                self.warm()

    def close(self):
        self.closed = True
        process = self.process
        if process:
            try:
                if process.is_alive():
                    process.terminate()
            except ValueError:
                pass
        with self.lock:
            self._dispose()
