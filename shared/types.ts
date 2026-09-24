import type { HostingAPI } from './hosting';
export const providers = ['youtube','twitch','x'] as const;
export type Provider = typeof providers[number];
export type OAuthProvider = Exclude<Provider,'x'>;
export const providerNames:Record<Provider,string>={youtube:'YouTube',twitch:'Twitch',x:'X'};
export interface XSourceInput { name:string; server:string; key:string }
export interface XSourceSummary { configured:boolean; name:string }
export type PlayMode = 'manual' | 'auto';
export type Presentation = 'host' | 'gameplay';
export interface SteamGame {appId:string;name:string;installDirectory:string;buildId:string;branch:string;autoSupport:'experimental'|'unavailable'}
export interface Settings {
  locale: import('./i18n').Locale;
  googleClientId: string; twitchClientId: string;
  obsDirectory: string; gameWindow: string; steamAppId:string; addedSteamGames:string[];
  title: string; youtubePrivacy: 'private' | 'unlisted' | 'public';
  enabledPlatforms: Provider[];
  decisionProvider: 'rules' | 'jev'; decisionIntervalMs: number;
  autoRestart: boolean; bitrate: number;
  presentation: Presentation;
}
export interface Account { id: string; name: string; connected: boolean }
export interface GameAction { id: string; label: string; kind: string; target?: string }
export interface GameState {
  version: number; timestamp: number; session: string; map: string;
  phase: string; health: number; position: number[]; mode: PlayMode;
  epoch: number; ack: number; actions: GameAction[]; lastAction?: string;
}
export interface OutputState {
  connected: boolean; ready: boolean; active: boolean; reconnecting: boolean;
  frames: number; skipped: number; bytes: number; error?: string;
}
export interface Snapshot {
  build?:{version:string;strategyRevision:string;commit:string;builtAt:string};
  settings: Settings; accounts: Record<OAuthProvider, Account | null>; xSource:XSourceSummary;
  outputs: Record<Provider, OutputState>; mode: PlayMode;
  game: GameState | null; gameConnected: boolean; gameError: string; gamePid?:number;
  decision: string; busy: string; lastError: string; hasJevKey: boolean;
  steamGames:SteamGame[]; selectedGame:SteamGame|null;
  decisionStats:{jevRequests:number;jevResponses:number};
  autoplay:import('./etc').EtcSummary;
  gameInput:{foreground:boolean;heldInputs:number};
  auth: Partial<Record<Provider, string>>; logs: {at:string; message:string}[];
  broadcast: { youtubeUrl?: string; twitchUrl?: string; state: string };
  recovery?:Partial<Record<Provider,{state:'healthy'|'waiting'|'recovering'|'failed';attempts:number;nextAt:number}>>;
  health?:Partial<Record<Provider,import('./session-health').HealthIssue[]>>;
}
export interface StudioAPI extends HostingAPI {
  preflight():Promise<import('./readiness').ReadinessReport>;
  setLocale(locale: import('./i18n').Locale): Promise<void>;
  scanSteam():Promise<SteamGame[]>;
  addSteamGame(appId:string):Promise<void>;
  selectSteamGame(appId:string):Promise<void>;
  removeSteamGame(appId:string):Promise<void>;
  snapshot(): Promise<Snapshot>;
  saveSettings(settings: Settings): Promise<void>;
  selectPlatforms(platforms: Provider[]): Promise<void>;
  saveJevKey(key: string): Promise<void>;
  importGoogleClient(): Promise<boolean>;
  connectAccount(provider: OAuthProvider): Promise<void>;
  cancelLogin(provider: OAuthProvider): Promise<void>;
  disconnectAccount(provider: OAuthProvider): Promise<void>;
  saveXSource(source:XSourceInput):Promise<void>;
  removeXSource():Promise<void>;
  setupOBS(): Promise<void>;
  windows(): Promise<{label:string; value:string}[]>;
  setCapture(window: string): Promise<void>;
  preview(provider: Provider): Promise<string>;
  launchGame(): Promise<void>;
  setMode(mode: PlayMode): Promise<void>;
  setPresentation(mode: Presentation): Promise<void>;
  startStream(): Promise<void>;
  stopStream(): Promise<void>;
  openExternal(url: string): Promise<void>;
}
