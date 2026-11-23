/*
 * PROJECT: VOID-CIRCUIT
 *
 * config/soundTest.ts - サウンドテスト・音量・EQ・イコライザUIの全ロジック管理
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import { ScenarioManager } from '../systems/scenario.js';
import type {
    BGMListItem,
    EQSettings,
    SoundTestAudioLike,
    SoundTestSettingKey
} from '../types/soundTest.js';

const SOUND_TEST_KEYS: ReadonlySet<string> = new Set<SoundTestSettingKey>([
    'se_vol',
    'bgm_vol',
    'sound',
    'bgm',
    'audio_room',
    'eq_low',
    'eq_mid',
    'eq_high'
]);

/**
 * SoundTestManager: 設定画面内のサウンド・音量・EQ・イコライザUIを専門に管理
 */
export class SoundTestManager {
    private audio: SoundTestAudioLike | null | undefined;
    private assetBase: string;

    public soundTestIndex: number = 0;
    public bgmTestIndex: number = 0;
    public roomPresetIndex: number = 0;
    public isBGMPlaying: boolean = false;
    public onIndexChanged: (() => void) | null = null;
    public peaks: number[] = new Array<number>(32).fill(0);
    public bgmList: BGMListItem[] = [];

    private eqCtx: CanvasRenderingContext2D | null = null;
    private loopId: number | null = null;
    private isActive: boolean = false;

    constructor(audio: SoundTestAudioLike | null | undefined, assetBase: string = '') {
        this.audio = audio;
        this.assetBase = assetBase;
    }

    /** 指定された setting キーがサウンド系項目かどうかを判定 */
    public handlesSetting(setting: string | undefined): setting is SoundTestSettingKey {
        return setting !== undefined && SOUND_TEST_KEYS.has(setting);
    }

    /** 設定画面オープン時の初期化・描画ループ開始 */
    public async activate(isModeActiveGetter: () => boolean): Promise<void> {
        this.isActive = true;
        await this.buildDynamicSoundTestList();
        this.setupAudioEndedListener(isModeActiveGetter);

        const eqCanvas = document.getElementById('eq-overlay-canvas') as HTMLCanvasElement | null;
        if (eqCanvas) {
            this.eqCtx = eqCanvas.getContext('2d');
            this.startLoop();
        }
    }

    /** 設定画面クローズ時のクリーンアップ */
    public deactivate(screenEl: HTMLElement | null): void {
        this.isActive = false;
        screenEl?.classList.remove('bgm-testing-mode');

        if (this.loopId !== null) {
            cancelAnimationFrame(this.loopId);
            this.loopId = null;
        }

        this.stopAndReset();
        this._hideEqualizerContainer();
    }

    /** 左右キー・矢印クリック時の値変更を一括処理 */
    public handleValueChange(setting: SoundTestSettingKey, isRight: boolean): void {
        switch (setting) {
            case 'se_vol':
                this.changeSEVolume(isRight);
                break;
            case 'bgm_vol':
                this.changeBGMVolume(isRight);
                break;
            case 'sound':
                this.changeSEIndex(isRight);
                break;
            case 'bgm':
                this.changeBGMIndex(isRight);
                break;
            case 'audio_room':
                this.changeRoomPresetIndex(isRight);
                break;
            case 'eq_low':
            case 'eq_mid':
            case 'eq_high':
                this.changeEQGain(setting, isRight);
                break;
        }
    }

    /** 各サウンド系項目の表示文字列を取得（必要に応じてBGMタイトルDOMも更新） */
    public getDisplayValue(setting: SoundTestSettingKey): string {
        const audio = this.audio;

        switch (setting) {
            case 'se_vol': {
                const vol = audio ? Math.round((audio.seVolume ?? 0.8) * 100) : 80;
                return vol === 0 ? 'MUTED' : vol === 100 ? 'MAX' : `${vol}%`;
            }
            case 'bgm_vol': {
                const vol = audio ? Math.round((audio.bgmVolume ?? 0.7) * 100) : 70;
                return vol === 0 ? 'MUTED' : vol === 100 ? 'MAX' : `${vol}%`;
            }
            case 'sound':
                return audio ? audio.getSEName(this.soundTestIndex) : '---';
            case 'bgm': {
                const titleEl = document.querySelector<HTMLElement>('.bgm-title');
                if (!audio || (audio.bgmCount ?? 0) === 0) {
                    if (titleEl) titleEl.innerText = 'Please wait...';
                    return 'LOADING...';
                }
                if (titleEl) titleEl.innerText = audio.getBGMName(this.bgmTestIndex);
                return `STAGE-${this.bgmTestIndex + 1}`;
            }
            case 'audio_room':
                if (!audio || !audio.getRoomPresetName) return 'NOT READY';
                return audio.getRoomPresetName(this.roomPresetIndex);
            case 'eq_low':
            case 'eq_mid':
            case 'eq_high': {
                const targetBand = setting.replace('eq_', '') as keyof EQSettings;
                const val = audio?.eqSettings ? audio.eqSettings[targetBand] : 0;
                const sign = val > 0 ? '+' : '';
                return `${sign}${val} dB`;
            }
        }
    }

    /** BGMテスト再生のトグルとUI変形（イコライザ表示）を一括制御 */
    public toggleBGMWithUI(screenEl: HTMLElement | null): void {
        this.toggleBGM(() => this._showEqualizerContainer());

        if (this.isBGMPlaying) {
            screenEl?.classList.add('bgm-testing-mode');
        } else {
            screenEl?.classList.remove('bgm-testing-mode');
            this._hideEqualizerContainer();
        }
    }

    /** 動的にサウンドリストを構築 */
    public async buildDynamicSoundTestList(): Promise<void> {
        const totalStages = 7;
        const metaPromises: Promise<{ bgm?: string; name?: string } | null>[] = [];
        const base = this.assetBase || '';

        const scenario = new ScenarioManager();

        for (let i = 1; i <= totalStages; i++) {
            metaPromises.push(scenario.peekStageMeta(i, base));
        }

        const results = await Promise.all(metaPromises);

        const candidateList = results
            .map((meta, index) => ({
                stagePath: `stage-${index + 1}`,
                fileName: meta?.bgm ?? null,
                displayName: meta?.name ? `Stage-${index + 1}: ${meta.name}` : `Stage-${index + 1}`
            }))
            .filter((item): item is BGMListItem => item.fileName !== null);

        if (candidateList.length === 0) {
            console.warn('[SoundTest] WARNING: No stage YAMLs returned valid BGM data.');
            return;
        }

        if (!this.audio) {
            console.error('[SoundTest] ERROR: Audio manager is missing!');
            return;
        }

        const audio = this.audio;

        const loadedList = await Promise.all(
            candidateList.map(async (item): Promise<BGMListItem | null> => {
                const audioObj = await audio.loadStageBGM(item.fileName, item.stagePath);
                if (audioObj) return item;
                console.error(`[SoundTest] Failed to load BGM for ${item.stagePath}: ${item.fileName}`);
                return null;
            })
        );

        const validBgmList = loadedList.filter((item): item is BGMListItem => item !== null);

        if (typeof audio.setDynamicBGMList === 'function') {
            audio.setDynamicBGMList(validBgmList);
        }
        this.bgmList = validBgmList;
    }

    /** SEボリュームを変更 */
    public changeSEVolume(isRight: boolean): void {
        if (!this.audio) return;
        const nextVol = this._stepVolume(this.audio.seVolume ?? 0.8, isRight);
        this.audio.seVolume = nextVol;
        this.audio.setSEVolume?.(nextVol);
    }

    /** BGMボリュームを変更 */
    public changeBGMVolume(isRight: boolean): void {
        if (!this.audio) return;
        const nextVol = this._stepVolume(this.audio.bgmVolume ?? 0.7, isRight);
        this.audio.bgmVolume = nextVol;
        this.audio.setBGMVolume?.(nextVol);
    }

    /** SEの選択インデックスを変更 */
    public changeSEIndex(isRight: boolean): void {
        if (!this.audio) return;
        const len = this.audio.seCount || 0;
        if (len > 0) {
            this.soundTestIndex = isRight
                ? (this.soundTestIndex + 1) % len
                : (this.soundTestIndex - 1 + len) % len;
        }
    }

    /** BGMの選択インデックスを変更 */
    public changeBGMIndex(isRight: boolean): void {
        const len = this.bgmList?.length || 0;
        if (!this.audio || len === 0) return;

        const delta = isRight ? 1 : -1;
        this.bgmTestIndex = (this.bgmTestIndex + delta + len) % len;

        if (this.isBGMPlaying) {
            this._playCurrentBgm();
        }
    }

    /** 空間アコースティックプリセットの選択インデックスを変更 */
    public changeRoomPresetIndex(isRight: boolean): void {
        if (!this.audio) return;
        const len = this.audio.roomPresetCount || 0;
        if (len > 0) {
            this.roomPresetIndex = isRight
                ? (this.roomPresetIndex + 1) % len
                : (this.roomPresetIndex - 1 + len) % len;

            this.audio.setAudioRoomPreset(this.roomPresetIndex);
        }
    }

    /** SEの再生 */
    public playSE(): void {
        if (this.audio) {
            this.audio.playSEByIndex(this.soundTestIndex);
        }
    }

    /** BGMの再生・停止をトグル制御 */
    public toggleBGM(onToggleOnCallback?: () => void): void {
        if (!this.audio) return;

        this.isBGMPlaying = !this.isBGMPlaying;

        if (this.isBGMPlaying) {
            this._playCurrentBgm();
            if (typeof onToggleOnCallback === 'function') {
                onToggleOnCallback();
            }
        } else {
            this.audio.resetBGM();
        }
    }

    /** BGM終了時の自動次曲遷移リスナーを設定 */
    public setupAudioEndedListener(isModeActiveGetter: () => boolean): void {
        if (!this.audio) return;
        this.audio.resetBGM();
        this.audio.onBGMEnded = () => {
            if (!isModeActiveGetter() || !this.isBGMPlaying) return;
            this.playNextBGMAutomated();
        };
    }

    /** 自動で次の曲へ移行 */
    public playNextBGMAutomated(): void {
        if (!this.audio) return;
        const len = this.bgmList.length;
        if (len <= 0) return;

        this.bgmTestIndex = (this.bgmTestIndex + 1) % len;
        this.isBGMPlaying = true;
        this._playCurrentBgm();

        if (typeof this.onIndexChanged === 'function') {
            this.onIndexChanged();
        }
    }

    /** 状態の強制リセット */
    public stopAndReset(): void {
        if (this.audio) {
            this.audio.resetBGM();
            if (this.audio.bgmNode) {
                this.audio.bgmNode.onended = null;
            }
        }
        this.isBGMPlaying = false;
        this.peaks.fill(0);
    }

    /** EQ（Low/Mid/High）のゲイン値をリアルタイムに変更 */
    public changeEQGain(setting: 'eq_low' | 'eq_mid' | 'eq_high', isRight: boolean): void {
        if (!this.audio || !this.audio.eqSettings) return;

        const step = isRight ? 1 : -1;
        const targetBand = setting.replace('eq_', '') as keyof EQSettings;

        const currentVal = this.audio.eqSettings[targetBand];
        const newVal = Math.max(-10, Math.min(15, currentVal + step));

        this.audio.setEQGain(targetBand, newVal);
    }

    /** イコライザー描画ループ開始 */
    public startLoop(): void {
        if (!this.isActive || !this.eqCtx) return;
        this.drawEqualizer(this.eqCtx, 0, 0);
        this.loopId = requestAnimationFrame(() => this.startLoop());
    }

    /** イコライザーの描画ロジック */
    public drawEqualizer(ctx: CanvasRenderingContext2D, x: number, y: number): void {
        if (!this.audio || !this.audio.getByteFrequencyData) return;

        const rawData = this.audio.getByteFrequencyData();
        if (!rawData) return;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const targetIndices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const activeCount = targetIndices.length;
        const canvasWidth = ctx.canvas.width;
        const maxHeight = ctx.canvas.height;
        const barGap = 4;
        const barWidth = (canvasWidth - barGap * (activeCount - 1)) / activeCount;

        const eqSettings = this.audio.eqSettings || { low: 0, mid: 0, high: 0 };

        const lowBoost = Math.max(0, eqSettings.low);
        const midBoost = Math.max(0, eqSettings.mid);
        const highBoost = Math.max(0, eqSettings.high);

        let currentHue = 130;
        const totalBoost = lowBoost + midBoost + highBoost;

        if (totalBoost > 0) {
            const targetHue = (lowBoost * 20 + midBoost * 130 + highBoost * 195) / totalBoost;
            const maxBoost = Math.max(lowBoost, midBoost, highBoost);
            const shiftRatio = Math.pow(maxBoost / 15, 0.5);
            currentHue = 130 * (1 - shiftRatio) + targetHue * shiftRatio;
        }

        const lfFull = Math.max(0, eqSettings.low + 10);
        const mfFull = Math.max(0, eqSettings.mid + 10);
        const hfFull = Math.max(0, eqSettings.high + 10);
        const maxFullFactor = Math.max(lfFull, mfFull, hfFull);

        const currentSaturation = 75 + (maxFullFactor / 25) * 25;

        let fxLightnessBonus = 0;
        const p = this.audio.ROOM_PRESETS?.[this.roomPresetIndex];
        if (p) {
            fxLightnessBonus = Math.max(p.reverbWet, p.echoWet) * 12;
        }

        const baseLightness = 30 + (maxFullFactor / 25) * 40;
        const currentLightness = Math.min(82, baseLightness + fxLightnessBonus);

        const barStyle = `hsl(${Math.floor(currentHue)}, ${Math.floor(currentSaturation)}%, ${Math.floor(currentLightness)}%)`;

        ctx.save();
        for (let i = 0; i < activeCount; i++) {
            const rawIdx = targetIndices[i];
            if (rawIdx === undefined) continue;

            const rawValue = rawData[rawIdx] ?? 0;
            let processedValue = (rawValue - 140 + rawIdx * 6) * 2;
            processedValue = Math.max(0, Math.min(255, processedValue));
            let barHeight = (processedValue / 255) * maxHeight;

            if (rawValue > 10) {
                barHeight = Math.max(2, Math.min(maxHeight - 4, barHeight));
            } else {
                barHeight = 1;
            }

            ctx.fillStyle = barStyle;

            const barX = x + i * (barWidth + barGap);
            const barY = y + maxHeight - barHeight;

            if (barHeight > 0) ctx.fillRect(barX, barY, barWidth, barHeight);

            const currentPeak = this.peaks[i] ?? 0;
            const nextPeak = barHeight >= currentPeak ? barHeight : Math.max(0, currentPeak - 0.45);
            this.peaks[i] = nextPeak;

            if (nextPeak > 0) {
                ctx.fillStyle = 'rgba(255, 255, 220, 0.95)';
                ctx.fillRect(barX, y + maxHeight - nextPeak, barWidth, 2);
            }

            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            for (let h = 0; h < maxHeight; h += 4) {
                ctx.fillRect(barX, y + h, barWidth + 1, 1);
            }
        }
        ctx.restore();
    }

    // --- プライベート補助メソッド ---

    private _stepVolume(current: number, isRight: boolean): number {
        let vol = isRight ? current + 0.1 : current - 0.1;
        if (vol > 1.05) vol = 0.0;
        if (vol < -0.05) vol = 1.0;
        return Math.max(0, Math.min(1, Math.round(vol * 10) / 10));
    }

    private _getCurrentBgmName(): string {
        const current = this.bgmList[this.bgmTestIndex];
        return current ? `${current.stagePath} [${current.fileName}]` : `Unknown_BGM_${this.bgmTestIndex}`;
    }

    private _playCurrentBgm(): void {
        const currentBgm = this.bgmList[this.bgmTestIndex];
        if (!currentBgm || !this.audio) return;

        if (typeof this.audio.playBGMByIndex === 'function') {
            this.audio.playBGMByIndex(this.bgmTestIndex);
        }

        if (window.Analytics?.logBgmTestPlay) {
            window.Analytics.logBgmTestPlay(this._getCurrentBgmName());
        }
    }

    private _showEqualizerContainer(): void {
        const eqContainer = document.getElementById('eq-container');
        if (eqContainer) {
            eqContainer.style.display = 'block';
            setTimeout(() => {
                eqContainer.style.opacity = '1';
            }, 10);
        }
    }

    private _hideEqualizerContainer(): void {
        const eqContainer = document.getElementById('eq-container');
        if (eqContainer) {
            eqContainer.style.opacity = '0';
            eqContainer.style.display = 'none';
        }
    }
}