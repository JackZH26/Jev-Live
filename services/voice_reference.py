"""Bounded in-memory English reference audio; no paths, URLs, or pickle prompts."""
import base64
import hashlib
import io
import re
import struct
import wave

MAX_REFERENCE_BYTES = 4_000_000


def decode_reference(reference):
    if not isinstance(reference, dict):
        raise ValueError('reference_required')
    encoded, text = reference.get('audio'), reference.get('text')
    if not isinstance(text, str) or not 10 <= len(text.strip()) <= 2000 or not re.search('[a-zA-Z]', text) or re.search('[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]', text):
        raise ValueError('english_transcript_required')
    if not isinstance(encoded, str) or len(encoded) > 5_333_336:
        raise ValueError('reference_size')
    audio = base64.b64decode(encoded, validate=True)
    if len(audio) < 44 or len(audio) > MAX_REFERENCE_BYTES or audio[:4] != b'RIFF' or int.from_bytes(audio[4:8], 'little') + 8 != len(audio):
        raise ValueError('reference_format')
    try:
        with wave.open(io.BytesIO(audio), 'rb') as source:
            channels, rate = source.getnchannels(), source.getframerate()
            if source.getsampwidth() != 2 or channels not in (1, 2) or not 16000 <= rate <= 48000 or not 3 <= source.getnframes() / rate <= 20:
                raise ValueError('reference_format')
            frames = source.readframes(source.getnframes())
            if len(frames) != source.getnframes() * channels * 2 or not any(abs(value[0]) > 8 for value in struct.iter_unpack('<h', frames)):
                raise ValueError('reference_silent_or_truncated')
    except (wave.Error, EOFError) as error:
        raise ValueError('reference_format') from error
    return audio, text.strip()


class CloneVoice:
    def __init__(self, model):
        self.model = model
        self.key = None
        self.prompt = None

    def generate(self, data, **kwargs):
        import soundfile as sf
        audio, text = decode_reference(data.get('reference'))
        key = hashlib.sha256(audio + b'\0' + text.encode('utf-8')).hexdigest()
        cached = key == self.key
        if not cached:
            samples, rate = sf.read(io.BytesIO(audio), dtype='float32', always_2d=True)
            prompt = self.model.create_voice_clone_prompt(ref_audio=(samples.mean(axis=1), rate), ref_text=text, x_vector_only_mode=False)
            # A single cached identity bounds memory; languages never choose another voice.
            self.prompt, self.key = prompt, key
        wavs, rate = self.model.generate_voice_clone(text=data['text'], language=data['language'], voice_clone_prompt=self.prompt, **kwargs)
        return wavs, rate, cached
