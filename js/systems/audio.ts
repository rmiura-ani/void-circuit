/*
 * PROJECT: VOID-CIRCUIT
 *
 * audio.ts - Web Audio API & Sound Lifecycle Management
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

export type EQBand = 'low' | 'mid' | 'high';

export interface EQSettings {
    low: number;
    mid: number;
    high: number;
}

export interface RoomPreset {
    name: string;
    delayTime: number;
    feedback: number;
    reverbWet: number;
    echoWet: number;
    desc: string;
}

export interface SEConfigItem {
    file: string;
    vol: number;
}

export type SEKey = 'shot' | 'changeWp' | 'explosion' | 'hitSound' | 'powerUp' | 'siren';

export interface DynamicBGMItem {
    displayName: string;
    fileName: string;
    stagePath?: string | null;
}

declare global {
    interface Window {
        webkitAudioContext?: typeof AudioContext;
    }
}

/**
 * AudioManager: サウンドライフサイクル管理
 */
export class AudioManager {
    public basePath: string;
    public currentBgm: HTMLAudioElement | null;
    public currentBgmFileName: string;
    public preparedBgm: HTMLAudioElement | null;
    public preparedBgmFileName: string;
    public fadeInterval: ReturnType<typeof setInterval> | null;
    public bgms: Record<string, HTMLAudioElement>;
    public sounds: Partial<Record<SEKey, HTMLAudioElement>>;

    // 🔊 マスターボリュームの％管理 (0.0 〜 1.0)
    public seVolume: number;
    public bgmVolume: number;

    // BGMテスト用の再生終了時コールバック
    public onBGMEnded: (() => void) | null;

    // 🎛️ EQの設定値
    public eqSettings: EQSettings;

    // 🏛️ 空間アコースティックプリセットの定義
    public readonly ROOM_PRESETS: Record<number, RoomPreset>;
    public currentPresetId: number;

    public DYNAMIC_BGM_LIST: DynamicBGMItem[];
    public readonly CONFIG: {
        SE: Record<SEKey, SEConfigItem>;
    };
    public readonly seKeys: SEKey[];

    public audioCtx: AudioContext | null;
    public analyser: AnalyserNode | null;

    // EQ ノード
    public eqLow: BiquadFilterNode | null;
    public eqMid: BiquadFilterNode | null;
    public eqHigh: BiquadFilterNode | null;

    // 🎛️ エフェクト（DSP）ノード群
    public dryNode: GainNode | null;
    public echoNode: DelayNode | null;
    public echoFeedback: GainNode | null;
    public echoWetNode: GainNode | null;
    public reverbNodes: DelayNode[];
    public reverbWetNode: GainNode | null;

    public mediaSources: Map<HTMLAudioElement, MediaElementAudioSourceNode>;

    // 動的に生成される SE 再生メソッドの型宣言
    declare public playShot: () => void;
    declare public playChangeWp: () => void;
    declare public playExplosion: () => void;
    declare public playHitSound: () => void;
    declare public playPowerUp: () => void;
    declare public playSiren: () => void;

    constructor(basePath: string) {
        this.basePath = basePath;
        this.currentBgm = null;
        this.currentBgmFileName = "";
        this.preparedBgm = null;
        this.preparedBgmFileName = "";
        this.fadeInterval = null;
        this.bgms = {};
        this.sounds = {};

        // 🔊 マスターボリュームの％管理 (0.0 〜 1.0)
        this.seVolume = 0.8;   // デフォルト 80%
        this.bgmVolume = 0.7;  // デフォルト 70%

        // BGMテスト用の再生終了時コールバック
        this.onBGMEnded = null;

        // 🎛️ EQの設定値
        this.eqSettings = { low: 0, mid: 0, high: 0 };

        // 🏛️ 空間アコースティックプリセットの定義
        this.ROOM_PRESETS = {
            0: { name: "1.NORMAL",  delayTime: 0.0,  feedback: 0.0,  reverbWet: 0.0,  echoWet: 0.0,  desc: "DRY SOUND" },
            1: { name: "2.CP-01 ",  delayTime: 0.03, feedback: 0.35, reverbWet: 0.3,  echoWet: 0.15, desc: "METALLIC SHORT ECHO" },
            2: { name: "3.GALAXY",  delayTime: 0.4,  feedback: 0.4,  reverbWet: 0.0,  echoWet: 0.35, desc: "DEEP SPACE DELAY" },
            3: { name: "4.IND-ST",  delayTime: 0.22, feedback: 0.3,  reverbWet: 0.35, echoWet: 0.25, desc: "HEAVY INDUSTRIAL REVERB" }
        };
        this.currentPresetId = 0;

        this.DYNAMIC_BGM_LIST = [];
        this.CONFIG = {
            SE: {
                shot:       { file: 'shot.ogg',       vol: 0.3 },
                changeWp:   { file: 'changeWp.ogg',   vol: 0.8 },
                explosion:  { file: 'explosion.ogg',  vol: 0.3 },
                hitSound:   { file: 'hitHurt.ogg',    vol: 0.5 },
                powerUp:    { file: 'powerUp.ogg',    vol: 0.7 },
                siren:      { file: 'siren.ogg',      vol: 0.4 }
            }
        };
        this.seKeys = Object.keys(this.CONFIG.SE) as SEKey[];

        this.audioCtx = null;
        this.analyser = null;

        // EQ ノード
        this.eqLow = null;
        this.eqMid = null;
        this.eqHigh = null;

        // 🎛️ エフェクト（DSP）ノード群
        this.dryNode = null;
        this.echoNode = null;
        this.echoFeedback = null;
        this.echoWetNode = null;
        this.reverbNodes = [];
        this.reverbWetNode = null;

        this.mediaSources = new Map(); // 各Audio要素とSourceNodeの紐付けキャッシュ

        // メソッドの動的生やし
        this.seKeys.forEach(key => {
            const methodName = ('play' + key.charAt(0).toUpperCase() + key.slice(1)) as keyof this;
            (this[methodName] as unknown as () => void) = () => this._playSE(key);
        });
        this.initSEAudio();
    }

    /** AudioContextの初期化 & 自動再生ロック解除 */
    private _ensureAudioContext(): void {
        if (!this.audioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            this.audioCtx = new AudioCtx();
            this._setupAudioNodes();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    /** Web Audio API ノード群の構築 */
    private _setupAudioNodes(): void {
        if (!this.audioCtx) return;

        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 64;

        this.eqLow = this.audioCtx.createBiquadFilter();
        this.eqLow.type = 'lowshelf';
        this.eqLow.frequency.value = 200;

        this.eqMid = this.audioCtx.createBiquadFilter();
        this.eqMid.type = 'peaking';
        this.eqMid.frequency.value = 1000;
        this.eqMid.Q.value = 1.0;

        this.eqHigh = this.audioCtx.createBiquadFilter();
        this.eqHigh.type = 'highshelf';
        this.eqHigh.frequency.value = 5000;

        this.dryNode = this.audioCtx.createGain();
        this.dryNode.gain.value = 1.0;

        this.echoNode = this.audioCtx.createDelay(2.0);
        this.echoFeedback = this.audioCtx.createGain();
        this.echoWetNode = this.audioCtx.createGain();

        this.echoNode.connect(this.echoFeedback);
        this.echoFeedback.connect(this.echoNode);
        this.echoNode.connect(this.echoWetNode);

        this.reverbWetNode = this.audioCtx.createGain();
        const delayTimes = [0.011, 0.015, 0.023, 0.037, 0.043, 0.059];
        this.reverbNodes = delayTimes.map(t => {
            const d = this.audioCtx!.createDelay();
            d.delayTime.value = t;
            const g = this.audioCtx!.createGain();
            g.gain.value = 0.65;

            d.connect(g);
            g.connect(d);
            g.connect(this.reverbWetNode!);
            return d;
        });

        // 集約接続: Analyser -> スピーカー
        this.analyser.connect(this.audioCtx.destination);
    }

    /** SE初期化 */
    public initSEAudio(): void {
        this.seKeys.forEach(key => {
            const conf = this.CONFIG.SE[key];
            const audio = new Audio(this.basePath + conf.file);
            audio.crossOrigin = "anonymous";
            audio.volume = conf.vol * this.seVolume;
            this.sounds[key] = audio;
        });
    }

    public setDynamicBGMList(list: DynamicBGMItem[]): void {
        this.DYNAMIC_BGM_LIST = list;
    }

    public setSEVolume(volume: number): void {
        this.seVolume = Math.max(0, Math.min(1, volume));
        this.seKeys.forEach(key => {
            const sound = this.sounds[key];
            if (sound) {
                const baseVol = this.CONFIG.SE[key].vol;
                sound.volume = baseVol * this.seVolume;
            }
        });
        console.log(`[Audio] Master SE Volume -> ${Math.round(this.seVolume * 100)}%`);
    }

    public setBGMVolume(volume: number): void {
        this.bgmVolume = Math.max(0, Math.min(1, volume));
        if (this.currentBgm && !this.fadeInterval) {
            this.currentBgm.volume = 0.7 * this.bgmVolume;
        }
        console.log(`[Audio] Master BGM Volume -> ${Math.round(this.bgmVolume * 100)}%`);
    }

    public async preloadSE(): Promise<void> {
        const loadAud = (a: HTMLAudioElement | undefined): Promise<void> => new Promise(r => {
            if (!a || a.readyState >= 3) return r();
            a.addEventListener('canplaythrough', () => r(), { once: true });
            a.addEventListener('error', () => r(), { once: true });
            a.load();
            setTimeout(r, 3000);
        });
        await Promise.all(Object.values(this.sounds).map(loadAud));
        console.log("[Audio] System SE Preload complete.");
    }

    public async loadStageBGM(fileName: string, stagePath: string | null = null): Promise<HTMLAudioElement | null> {
        if (!fileName) return null;

        // パス解決用の内部ヘルパー
        const resolvePath = (base: string, file: string): string => {
            if (/^(?:[a-z]+:)?\/\//i.test(file)) return file; // absolute URL (http://等) はそのまま
            const b = base.endsWith('/') ? base : base + '/';
            const f = file.startsWith('/') ? file.slice(1) : file;
            return b + f;
        };

        // 1. stagePath があれば basePath と結合してフルフォルダパスを作る
        const currentFolder = stagePath
            ? resolvePath(this.basePath, stagePath)
            : this.basePath;
        const targetPath = resolvePath(currentFolder, fileName);

        // 🌟 フルパス（targetPath）単位でのみキャッシュチェックを行う
        if (this.bgms[targetPath]) {
            this.preparedBgm = this.bgms[targetPath];
            this.preparedBgmFileName = targetPath;
            return this.bgms[targetPath];
        }

        return new Promise((resolve) => {
            const audio = new Audio(targetPath);
            audio.crossOrigin = "anonymous";
            audio.loop = true;
            audio.volume = 0.7 * this.bgmVolume;

            let isResolved = false;

            const onCanPlay = () => {
                if (isResolved) return;
                isResolved = true;
                // キャッシュキーは必ずフルパスで保持
                this.bgms[targetPath] = audio;
                this.preparedBgm = audio;
                this.preparedBgmFileName = targetPath;
                resolve(audio);
            };

            const onError = () => {
                if (isResolved) return;
                isResolved = true;

                // stagePath で失敗した場合のみ、basePath へフォールバック
                if (stagePath) {
                    console.warn(`[Audio] Failed at stagePath: ${targetPath}. Falling back to basePath...`);
                    this.loadStageBGM(fileName, null).then(resolve);
                    return;
                }

                console.error(`[Audio] Failed to load BGM: ${targetPath}`);
                resolve(null);
            };

            audio.addEventListener('canplaythrough', onCanPlay, { once: true });
            audio.addEventListener('error', onError, { once: true });
            audio.load();

            setTimeout(() => {
                if (isResolved) return;
                isResolved = true;
                console.warn(`[Audio] BGM load timeout: ${targetPath}`);
                resolve(null);
            }, 5000);
        });
    }

    /** Audio要素をWeb Audio APIのアナライザーノードへブリッジする */
    public setupAnalyserBridge(audioElement: HTMLAudioElement): void {
        this._ensureAudioContext();
        if (!this.audioCtx || !this.eqLow || !this.eqMid || !this.eqHigh || !this.dryNode || !this.echoNode || !this.echoWetNode || !this.reverbWetNode || !this.analyser) {
            return;
        }

        // 🌟 重複接続防止: 既に登録済みであればパラメータ更新のみを行って復帰する
        if (this.mediaSources.has(audioElement)) {
            const now = this.audioCtx.currentTime;
            this._applyCurrentEQ(now);
            this.applyRoomPresetValues(now);
            return;
        }

        const sourceNode = this.audioCtx.createMediaElementSource(audioElement);

        // 【配線】 Source -> EQ Low -> Mid -> High
        sourceNode.connect(this.eqLow);
        this.eqLow.connect(this.eqMid);
        this.eqMid.connect(this.eqHigh);

        // 1. ドライ音ルート -> Analyser
        this.eqHigh.connect(this.dryNode);
        this.dryNode.connect(this.analyser);

        // 2. エコー（ディレイ）ルート -> Analyser
        this.eqHigh.connect(this.echoNode);
        this.echoWetNode.connect(this.analyser);

        // 3. リバーブ（残響）ルート -> Analyser
        this.reverbNodes.forEach(dNode => {
            this.eqHigh!.connect(dNode);
        });
        this.reverbWetNode.connect(this.analyser);

        // キャッシュに保持
        this.mediaSources.set(audioElement, sourceNode);

        const now = this.audioCtx.currentTime;
        this._applyCurrentEQ(now);
        this.applyRoomPresetValues(now);
    }

    private _applyCurrentEQ(time: number): void {
        if (this.eqLow)  this.eqLow.gain.setValueAtTime(this.eqSettings.low, time);
        if (this.eqMid)  this.eqMid.gain.setValueAtTime(this.eqSettings.mid, time);
        if (this.eqHigh) this.eqHigh.gain.setValueAtTime(this.eqSettings.high, time);
    }

    public applyRoomPresetValues(time: number): void {
        if (!this.audioCtx || !this.echoNode || !this.echoFeedback || !this.echoWetNode || !this.reverbWetNode || !this.dryNode) return;
        const p = this.ROOM_PRESETS[this.currentPresetId];
        if (!p) return;

        this.echoNode.delayTime.setValueAtTime(p.delayTime, time);
        this.echoFeedback.gain.setValueAtTime(p.feedback, time);
        this.echoWetNode.gain.setValueAtTime(p.echoWet, time);

        this.reverbWetNode.gain.setValueAtTime(p.reverbWet, time);

        const dryVol = p.reverbWet > 0.5 ? 0.8 : 1.0;
        this.dryNode.gain.setValueAtTime(dryVol, time);
    }

    public setAudioRoomPreset(presetId: number): void {
        if (this.ROOM_PRESETS[presetId] === undefined) return;
        this.currentPresetId = presetId;

        if (this.audioCtx) {
            const now = this.audioCtx.currentTime;
            this.applyRoomPresetValues(now);
        }
        console.log(`[Audio] Room Preset Changed -> ${this.ROOM_PRESETS[presetId].name}`);
    }

    public setEQGain(band: EQBand, value: number): void {
        if (this.eqSettings[band] !== undefined) {
            this.eqSettings[band] = value;
        }

        if (this.audioCtx) {
            const now = this.audioCtx.currentTime;
            this._applyCurrentEQ(now);
        }
    }

    public playBGM(): void {
        if (!this.preparedBgm) {
            console.warn("[Audio] No BGM is prepared. Call loadStageBGM first.");
            return;
        }

        // 既に同じ曲が再生中の場合は何もしない
        if (this.currentBgm === this.preparedBgm && !this.currentBgm.paused) {
            return;
        }

        this._ensureAudioContext();
        this.resetBGM();

        this.currentBgm = this.preparedBgm;
        this.currentBgmFileName = this.preparedBgmFileName;

        this.currentBgm.currentTime = 0;
        this.currentBgm.volume = 0.7 * this.bgmVolume;

        this.setupAnalyserBridge(this.currentBgm);

        this.currentBgm.onended = () => {
            console.log(`[Audio] BGM ended: ${this.currentBgmFileName}`);
            if (typeof this.onBGMEnded === 'function') {
                this.onBGMEnded();
            }
        };
        this.currentBgm.play().catch(e => console.warn("[Audio] Autoplay blocked or audio not ready", e));
    }

    /** ⏸️ BGMの一時停止（ポーズ用） */
    public pauseBGM(): void {
        if (this.currentBgm && !this.currentBgm.paused) {
            this.currentBgm.pause();
        }
    }

    /** ▶️ BGMの再開（ポーズ解除用） */
    public resumeBGM(): void {
        if (this.currentBgm && this.currentBgm.paused) {
            this._ensureAudioContext();
            this.currentBgm.play().catch(e => console.warn("[Audio] Resume BGM failed:", e));
        }
    }

    public resetBGM(): void {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        Object.values(this.bgms).forEach(b => {
            b.pause();
            b.volume = 0.7 * this.bgmVolume;
            b.onended = null;
        });
        this.currentBgm = null;
        this.currentBgmFileName = "";
    }

    public fadeOutBGM(duration: number = 2000): void {
        if (!this.currentBgm || this.fadeInterval) return;

        const target = this.currentBgm;
        const intervalTime = 50;
        const steps = duration / intervalTime;
        const volStep = target.volume / steps;

        this.fadeInterval = setInterval(() => {
            if (target.volume > volStep) {
                target.volume -= volStep;
            } else {
                target.volume = 0;
                target.pause();
                target.onended = null;
                if (this.fadeInterval) {
                    clearInterval(this.fadeInterval);
                    this.fadeInterval = null;
                }
            }
        }, intervalTime);
    }

    private _playSE(key: SEKey): void {
        this._ensureAudioContext();
        const baseAudio = this.sounds[key];
        if (baseAudio) {
            const clone = baseAudio.cloneNode(true) as HTMLAudioElement;
            clone.volume = baseAudio.volume;
            clone.play().catch(() => {});

            clone.addEventListener('ended', () => {
                clone.pause();
                clone.src = "";
                clone.remove();
            }, { once: true });
        }
    }

    // Sound Test Helpers
    public get bgmCount(): number { return this.DYNAMIC_BGM_LIST.length; }
    public get seCount(): number { return this.seKeys.length; }
    public get roomPresetCount(): number { return Object.keys(this.ROOM_PRESETS).length; }

    public getBGMName(idx: number): string { return this.DYNAMIC_BGM_LIST[idx]?.displayName.toUpperCase() || "NONE"; }
    public getSEName(idx: number): string { return this.seKeys[idx]?.toUpperCase() || "NONE"; }
    public getRoomPresetName(idx: number): string { return this.ROOM_PRESETS[idx]?.name || "UNKNOWN"; }

    public async playBGMByIndex(idx: number): Promise<void> {
        const bgmData = this.DYNAMIC_BGM_LIST[idx];
        if (!bgmData) return;

        const audio = await this.loadStageBGM(bgmData.fileName, bgmData.stagePath);

        if (audio) {
            audio.loop = true; // サウンドテスト用ループ再生
        }

        // loadStageBGM で準備された BGM を再生
        this.playBGM();
    }

    public getByteFrequencyData(): Uint8Array | null {
        if (!this.analyser) return null;
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }

    public playSEByIndex(idx: number): void {
        const key = this.seKeys[idx];
        if (key) this._playSE(key);
    }
}