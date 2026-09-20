"""Download public voice weights outside Git; never use implicit account tokens."""
import argparse, json, os
from pathlib import Path
os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN']='1'
from huggingface_hub import HfApi, snapshot_download
p=argparse.ArgumentParser();p.add_argument('--directory',required=True);args=p.parse_args()
root=Path(args.directory).resolve();root.mkdir(parents=True,exist_ok=True)
model='Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice'
revision=HfApi(token=False).model_info(model).sha
snapshot_download(model,revision=revision,local_dir=root,token=False,max_workers=3,allow_patterns=['*.json','*.txt','*.safetensors','speech_tokenizer/*'])
(root/'jev-model-receipt.json').write_text(json.dumps({'model':model,'revision':revision},indent=2),encoding='utf-8')
print(json.dumps({'downloaded':True,'model':model,'revision':revision}))
