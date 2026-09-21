import {etcContent,isEtc} from '../shared/game-content';
import type {HostConfig} from '../shared/hosting';
export function parseHostContext(raw:string):Record<string,any>{try{const value=JSON.parse(raw);return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
export function gameKnowledge(raw:string,question?:string){
 const c=parseHostContext(raw);if(!isEtc(c.appId))return undefined;
 const matched=question?etcContent.facts.filter(f=>f.keywords.test(question)):[];
 return {title:etcContent.name,scope:'General game rules, not evidence of current match events. Unknown features, dates and prices must remain unknown.',facts:(matched.length?matched:etcContent.facts).map(f=>f.fact)};
}
type Segment={id:string;kind:'fact'|'wishlist';text:string};
/** No promotion during combat, missing telemetry, or immediately after a fight. */
export class HostContent {
 private startedAt=0;private safeSince=0;private safe=false;private app='';private lastFact=0;private lastWishlist=0;
 private previous?:{match:string;health:number;shots:number};private decks=new Map<string,number[]>();private last=new Map<string,number>();
 reset(now=Date.now()){this.startedAt=now;this.safeSince=0;this.safe=false;this.app='';this.lastFact=now;this.lastWishlist=now;this.previous=undefined;this.decks.clear();this.last.clear();}
 observe(raw:string,now:number){
  const c=parseHostContext(raw);if(c.appId!==this.app){this.reset(now);this.app=c.appId;}
  let safe=isEtc(c.appId)&&c.connected===true&&['menu','loading','ended','paused'].includes(c.phase);
  if(isEtc(c.appId)&&c.connected===true&&c.phase==='playing'){
   const a=c.activity,prev=this.previous;
   safe=!!a&&typeof a.at==='number'&&now-a.at>=0&&now-a.at<2000&&a.enemies===0&&a.health>35&&a.danger===false&&a.healing===false&&a.reloading===false&&a.traveling===false;
   if(a){if(!prev||prev.match!==a.match||a.health<prev.health||a.shots!==prev.shots)safe=false;this.previous={match:a.match,health:a.health,shots:a.shots};}
  }
  if(safe&&!this.safe)this.safeSince=now;
  if(!safe)this.safeSince=0;
  this.safe=safe;
 }
 eligible(raw:string,now=Date.now()){
  this.observe(raw,now);return this.safe&&now-this.safeSince>=20000;
 }
 private draw(key:string,count:number){let deck=this.decks.get(key);if(!deck?.length){deck=Array.from({length:count},(_,i)=>i);for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}if(deck.length>1&&deck[deck.length-1]===this.last.get(key))[deck[0],deck[deck.length-1]]=[deck[deck.length-1],deck[0]];this.decks.set(key,deck);}const index=deck.pop()!;this.last.set(key,index);return index;}
 next(config:HostConfig,raw:string,now:number):Segment|undefined{
  if(!this.eligible(raw,now))return;
  if(config.gameContent.wishlist&&now-this.lastWishlist>=config.gameContent.wishlistIntervalSec*1000){const i=this.draw('wishlist',etcContent.reminders.length);return{id:'wishlist',kind:'wishlist',text:etcContent.reminders[i]};}
  if(config.gameContent.introductions&&now-this.lastFact>=config.gameContent.introIntervalSec*1000){const facts=etcContent.facts.filter(f=>f.lines.length);const f=facts[this.draw('topics',facts.length)];return{id:f.id,kind:'fact',text:f.lines[this.draw(f.id,f.lines.length)]};}
 }
 delivered(s:Segment,now:number){if(s.kind==='wishlist')this.lastWishlist=now;this.lastFact=now;}
}
