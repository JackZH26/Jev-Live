"""Offline CPU MeloTTS adapter. All downloads belong to the separate installer."""
import io
import json
import os
import time
from pathlib import Path

class MeloEngine:
    def __init__(self, config):
        root=Path(config['model']).resolve()
        os.environ.update(HF_HOME=str(root/'hf'), HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_IMPLICIT_TOKEN='1', HF_HUB_DISABLE_TELEMETRY='1', NLTK_DATA=str(root/'nltk'), TORCH_FORCE_WEIGHTS_ONLY_LOAD='1')
        import torch, nltk, unidic, unidic_lite, importlib.util, sys
        # Windows cannot install mecab and MeCab into the same directory.
        # Load the Korean binding from its separate installer-owned directory.
        bindings=root/'ko-python';sys.path.append(str(bindings))
        spec=importlib.util.spec_from_file_location('mecab',bindings/'mecab/__init__.py',submodule_search_locations=[str(bindings/'mecab')])
        mecab=importlib.util.module_from_spec(spec);sys.modules['mecab']=mecab;spec.loader.exec_module(mecab)
        torch.set_num_threads(8)
        unidic.DICDIR=unidic_lite.DICDIR
        # g2p_en/g2pkk call nltk.download at import. Verify preinstalled resources;
        # never replace/disable NLTK's network guard or run pip from inference.
        def offline_resource(name,*args,**kwargs):
            section='corpora' if name=='cmudict' else 'taggers' if name.startswith('averaged_') else 'tokenizers'
            nltk.data.find(section+'/'+name)
            return True
        nltk.download=offline_resource
        from g2pkk import G2p
        # Use the maintained Windows wheel and its installed Korean dictionary.
        # The upstream eunjeon wrapper stalled on this Windows machine.
        G2p.check_mecab=lambda self:None
        G2p.get_mecab=lambda self:mecab.MeCab()
        from huggingface_hub import hf_hub_download
        from melo.api import TTS
        manifest=json.loads((Path(__file__).parent/'melo-models.json').read_text(encoding='utf8'))
        # Pin offline aliases used internally by Melo to the installed manifest.
        for repo,item in manifest['text'].items():
            directory=root/'hf'/'hub'/('models--'+repo.replace('/','--'))
            if not (directory/'snapshots'/item['revision']).is_dir():raise RuntimeError('missing_text_model')
            refs=directory/'refs';refs.mkdir(exist_ok=True)
            (refs/'main').write_text(item['revision'],encoding='utf8')
        self.models={}
        samples={'Chinese':'欢迎来到直播间。','English':'Welcome to the stream.','Japanese':'こんにちは。','Korean':'안녕하세요.'}
        for language,item in manifest['tts'].items():
            paths={name:hf_hub_download(item['repo'],name,revision=item['revision'],local_files_only=True) for name in ['config.json','checkpoint.pth']}
            model=TTS(language=item['code'],device='cpu',config_path=paths['config.json'],ckpt_path=paths['checkpoint.pth'])
            speakers=vars(model.hps.data.spk2id)
            speaker=speakers.get('EN-US',next(iter(speakers.values())))
            self.models[language]=(model,speaker)
            model.tts_to_file(samples[language],speaker,quiet=True)
        self.info={'provider':'melo','device':'cpu','speakers':['auto']}

    def speech(self,data):
        import soundfile as sf
        model,speaker=self.models[data['language']]
        start=time.monotonic()
        audio=model.tts_to_file(data['text'],speaker,quiet=True)
        output=io.BytesIO();rate=model.hps.data.sampling_rate
        sf.write(output,audio,rate,format='WAV',subtype='PCM_16')
        return output.getvalue(),{'X-Synthesis-Ms':round((time.monotonic()-start)*1000),'X-Audio-Ms':round(len(audio)/rate*1000)}
