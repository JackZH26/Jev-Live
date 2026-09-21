import type {HostConfig} from './hosting';
/** Supported writing systems require no inference call; unsupported/ambiguous text falls back to English. */
export function replyLanguage(text:string):HostConfig['language']{
 const clean=text.replace(/https?:\/\/\S+|@[\w.-]+/g,'');
 if(/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u.test(clean))return 'ko';
 if(/[\u3041-\u3096\u30a1-\u30fa]/u.test(clean))return 'ja';
 if(/[\u3400-\u9fff]/u.test(clean))return /[這個麼來開關還裡裏為與說話語聲遊戲槍麼點學觀眾歡謝臺灣體簡幾對嗎妳會讓裝備聽應該換邊間剛]/u.test(clean)?'zh-TW':'zh-CN';
 return 'en';
}
export const spokenLanguageNames:Record<HostConfig['language'],string>={en:'English', 'zh-CN':'Simplified Chinese (简体中文)', 'zh-TW':'Traditional Chinese (繁體中文)',ja:'Japanese (日本語)',ko:'Korean (한국어; use Hangul, not Japanese)'};
/** Catch cross-script drift before it is synthesized. Latin-script languages remain prompt-controlled. */
export function matchesReplyLanguage(text:string,language:HostConfig['language']){
 const kana=(text.match(/[\u3041-\u3096\u30a1-\u30fa]/gu)??[]).length,hangul=(text.match(/[\uac00-\ud7af]/gu)??[]).length,han=(text.match(/[\u3400-\u9fff]/gu)??[]).length;
 if(language==='ko')return hangul>0&&hangul>kana;
 if(language==='ja')return kana>0&&kana>hangul;
 if(language==='zh-CN'||language==='zh-TW')return han>0&&!kana&&!hangul;
 return /[a-z]/i.test(text)&&!kana&&!hangul&&!han&&!/[\u0400-\u04ff\u0600-\u06ff]/u.test(text);
}
