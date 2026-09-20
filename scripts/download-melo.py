"""Install pinned public Melo assets outside Git without implicit account tokens."""
import argparse, hashlib, io, json, os, zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--directory',required=True);args=p.parse_args()
root=Path(args.directory).resolve();root.mkdir(parents=True,exist_ok=True)
os.environ.update(HF_HOME=str(root/'hf'),HF_HUB_DISABLE_IMPLICIT_TOKEN='1',HF_HUB_DISABLE_TELEMETRY='1')
from huggingface_hub import snapshot_download
import requests
manifest=json.loads((Path(__file__).resolve().parents[1]/'services/melo-models.json').read_text(encoding='utf8'))
for item in manifest['tts'].values():
 snapshot_download(item['repo'],revision=item['revision'],token=False,max_workers=2,allow_patterns=['config.json','checkpoint.pth','README.md','LICENSE*'])
 print(item['repo'],flush=True)
for repo,item in manifest['text'].items():
 patterns=['*.json','*.txt','*.model','README.md','LICENSE*']+(['pytorch_model.bin'] if item['weights'] else [])
 snapshot_download(repo,revision=item['revision'],token=False,max_workers=2,allow_patterns=patterns)
 refs=root/'hf'/'hub'/('models--'+repo.replace('/','--'))/'refs';refs.mkdir(parents=True,exist_ok=True)
 (refs/'main').write_text(item['revision'],encoding='utf8')
for item in manifest['nltk']:
 name=item['name'];section='corpora' if name=='cmudict' else 'taggers' if name.startswith('averaged_') else 'tokenizers'
 url=f'https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/{section}/{name}.zip'
 with requests.get(url,timeout=60,stream=True) as response:
  response.raise_for_status();chunks=[];size=0
  for chunk in response.iter_content(1048576):
   size+=len(chunk)
   if size>50_000_000:raise ValueError('oversize_download')
   chunks.append(chunk)
 content=b''.join(chunks)
 if hashlib.sha256(content).hexdigest()!=item['sha256']:raise ValueError('dictionary_checksum_changed')
 directory=(root/'nltk'/section).resolve();directory.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(io.BytesIO(content)) as archive:
  if sum(f.file_size for f in archive.infolist())>400_000_000:raise ValueError('oversize_archive')
  for f in archive.infolist():
   if not (directory/f.filename).resolve().is_relative_to(directory):raise ValueError('archive_path')
  archive.extractall(directory)
 (directory/(name+'.zip')).write_bytes(content)
 print(name,flush=True)
(root/'jev-model-receipt.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
