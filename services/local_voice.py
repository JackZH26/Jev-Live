"""Loopback-only local TTS. No cloud inference, audio uploads, credentials or text logs."""
import argparse, io, json, os, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1'
os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN']='1'
from voice_worker import IsolatedVoice, VoiceBusy, VoiceUnavailable
from voice_reference import CloneVoice, decode_reference

class QwenEngine:
    def __init__(self, config):
        import torch
        from qwen_tts import Qwen3TTSModel
        self.torch = torch
        torch.set_num_threads(8)
        if config['device'].startswith('cuda'):
            torch.cuda.set_per_process_memory_fraction(min(.8,config['gpu_budget_mib']*1048576/torch.cuda.get_device_properties(0).total_memory),0)
        self.model=Qwen3TTSModel.from_pretrained(config['model'],device_map=config['device'],dtype=torch.float32 if config['device']=='cpu' else torch.bfloat16,attn_implementation='sdpa')
        cloning=config.get('engine')=='qwen-clone'
        if self.model.model.tts_model_type!=('base' if cloning else 'custom_voice'):
            raise ValueError('wrong_voice_model_variant')
        self.clone=CloneVoice(self.model) if cloning else None
        self.info={'provider':'qwen3-tts-clone' if cloning else 'qwen3-tts','device':config['device'],'speakers':[] if cloning else self.model.get_supported_speakers()}
    def speech(self, data):
        import soundfile as sf
        start=time.monotonic()
        cached=False
        with self.torch.inference_mode():
            if self.clone:
                wavs,rate,cached=self.clone.generate(data,non_streaming_mode=True,max_new_tokens=350,do_sample=False)
            else:
                wavs,rate=self.model.generate_custom_voice(text=data['text'],language=data['language'],speaker=data['voice'],non_streaming_mode=True,max_new_tokens=350,do_sample=False)
        output=io.BytesIO();sf.write(output,wavs[0],rate,format='WAV',subtype='PCM_16')
        return output.getvalue(),{'X-Synthesis-Ms':round((time.monotonic()-start)*1000),'X-Audio-Ms':round(len(wavs[0])/rate*1000),'X-Voice-Prompt-Cached':str(cached).lower()}

def main():
    p=argparse.ArgumentParser();p.add_argument('--engine',choices=['qwen','qwen-clone','melo'],default='qwen');p.add_argument('--model',required=True);p.add_argument('--device',choices=['cpu','cuda:0'],default='cpu');p.add_argument('--port',type=int);p.add_argument('--gpu-budget-mib',type=int,default=3072);p.add_argument('--deadline',type=float,default=25);args=p.parse_args()
    if not 1024<=args.gpu_budget_mib<=8192:raise ValueError('Invalid GPU budget')
    if not 1<=args.deadline<=300:raise ValueError('Invalid inference deadline')
    if args.port is None:args.port={'qwen':11435,'melo':11437,'qwen-clone':11438}[args.engine]
    args.model=str(Path(args.model).resolve())
    factory=QwenEngine
    if args.engine=='melo':
        from melo_voice import MeloEngine
        factory=MeloEngine
        args.device='cpu'
    engine=IsolatedVoice(factory,vars(args),deadline=args.deadline)
    server=ThreadingHTTPServer(('127.0.0.1',args.port),make_handler(engine,args.engine,args.port));server.daemon_threads=True
    print(json.dumps({'listening':True,'port':args.port,'device':args.device}),flush=True)
    try:server.serve_forever()
    finally:engine.close();server.server_close()

def make_handler(engine,mode,port):
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
            except (BrokenPipeError,ConnectionResetError,TimeoutError):pass
        def allowed(self):
            return self.headers.get('Host') in [f'127.0.0.1:{port}',f'localhost:{port}'] and not self.headers.get('Origin')
        def do_GET(self):
            if not self.allowed():return self.send(403,b'{}')
            if self.path!='/health':return self.send(404,b'{}')
            self.send(200,json.dumps({**engine.info,'ready':engine.ready,'languages':list(languages),'busy':engine.lock.locked(),'restarts':engine.restarts}).encode())
        def do_POST(self):
            if not self.allowed():return self.send(403,b'{}')
            if self.path!='/speech':return self.send(404,b'{}')
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not 0<length<=(5_400_000 if mode=='qwen-clone' else 8192):raise ValueError()
                data=json.loads(self.rfile.read(length))
                if not isinstance(data,dict):raise ValueError()
                text=data['text'];language=data['language']
                if not isinstance(text,str) or not 0<len(text.strip())<=350 or not isinstance(language,str) or language not in languages:raise ValueError()
                speaker=(data.get('voice') or 'auto') if mode=='melo' else (data.get('voice') or defaults.get(language))
                if mode=='qwen-clone':
                    if data.get('voice'):raise ValueError()
                    decode_reference(data.get('reference'))
                elif engine.ready and speaker not in engine.info.get('speakers',[]):raise ValueError()
            except (ValueError,KeyError,TypeError):return self.send(400,b'{"error":"invalid_request"}')
            try:
                request={'text':text,'language':languages[language],'voice':speaker}
                if mode=='qwen-clone':request['reference']=data['reference']
                audio,headers=engine.speech(request)
                self.send(200,audio,'audio/wav',headers)
            except VoiceBusy:self.send(429,b'{"error":"busy"}')
            except VoiceUnavailable:self.send(503,b'{"error":"synthesis_unavailable"}')
    return Handler

if __name__=='__main__':main()
