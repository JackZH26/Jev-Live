"""Loopback-only Qwen TTS. No cloud inference, audio uploads, credentials or text logs."""
import argparse, io, json, os, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1'
os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN']='1'
import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel

def main():
    p=argparse.ArgumentParser();p.add_argument('--model',required=True);p.add_argument('--device',choices=['cpu','cuda:0'],default='cpu');p.add_argument('--port',type=int,default=11435);p.add_argument('--gpu-budget-mib',type=int,default=3072);args=p.parse_args()
    torch.set_num_threads(8)
    if args.device.startswith('cuda'):
        if not 1024<=args.gpu_budget_mib<=8192:raise ValueError('Invalid GPU budget')
        torch.cuda.set_per_process_memory_fraction(min(.8,args.gpu_budget_mib*1048576/torch.cuda.get_device_properties(0).total_memory),0)
    model=Qwen3TTSModel.from_pretrained(str(Path(args.model).resolve()),device_map=args.device,dtype=torch.float32 if args.device=='cpu' else torch.bfloat16,attn_implementation='sdpa')
    speakers=model.get_supported_speakers();lock=threading.Lock()
    languages={'zh-CN':'Chinese','zh-TW':'Chinese','ja':'Japanese','ko':'Korean','en':'English'}
    defaults={'zh-CN':'uncle_fu','zh-TW':'uncle_fu','ja':'ono_anna','ko':'sohee','en':'ryan'}
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup();self.connection.settimeout(10)
        def log_message(self,*_): pass
        def send(self,code,body,kind='application/json',headers=None):
            self.send_response(code);self.send_header('Content-Type',kind);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)))
            for k,v in (headers or {}).items():self.send_header(k,str(v))
            self.end_headers()
            try:self.wfile.write(body)
            except (BrokenPipeError,ConnectionResetError):pass
        def allowed(self):
            return self.headers.get('Host') in [f'127.0.0.1:{args.port}',f'localhost:{args.port}'] and not self.headers.get('Origin')
        def do_GET(self):
            if not self.allowed():return self.send(403,b'{}')
            if self.path!='/health':return self.send(404,b'{}')
            self.send(200,json.dumps({'ready':True,'provider':'qwen3-tts','device':args.device,'speakers':speakers,'languages':list(languages),'busy':lock.locked()}).encode())
        def do_POST(self):
            if not self.allowed():return self.send(403,b'{}')
            if self.path!='/speech':return self.send(404,b'{}')
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not 0<length<=8192:raise ValueError()
                data=json.loads(self.rfile.read(length));text=data['text'];language=data['language'];speaker=data.get('voice') or defaults.get(language)
                if not isinstance(text,str) or not 0<len(text)<=350 or language not in languages or speaker not in speakers:raise ValueError()
            except (ValueError,KeyError,TypeError):return self.send(400,b'{"error":"invalid_request"}')
            if not lock.acquire(blocking=False):return self.send(429,b'{"error":"busy"}')
            try:
                start=time.monotonic()
                with torch.inference_mode():
                    wavs,rate=model.generate_custom_voice(text=text,language=languages[language],speaker=speaker,non_streaming_mode=True,max_new_tokens=350,max_time=25,do_sample=False)
                if time.monotonic()-start>=25:raise TimeoutError('synthesis_deadline')
                output=io.BytesIO();sf.write(output,wavs[0],rate,format='WAV',subtype='PCM_16');audio=output.getvalue()
                self.send(200,audio,'audio/wav',{'X-Synthesis-Ms':round((time.monotonic()-start)*1000),'X-Audio-Ms':round(len(wavs[0])/rate*1000)})
            except Exception:
                self.send(503,b'{"error":"synthesis_failed"}')
            finally:lock.release()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler);server.daemon_threads=True
    print(json.dumps({'ready':True,'port':args.port,'device':args.device}),flush=True);server.serve_forever()

if __name__=='__main__':main()
