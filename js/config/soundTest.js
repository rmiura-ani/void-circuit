/*
 * PROJECT: VOID-CIRCUIT
 *
 * soundTest.js
 *
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import { ScenarioManager } from './../systems/scenario.js';

/**
 * SoundTestManager: 設定画面内のサウンドテスト（BGM/SE）ロジックを専門に管理
 */
export class SoundTestManager {
    constructor(sc) {
        this.sc = sc;
        this.soundTestIndex = 0;
        this.bgmTestIndex = 0;
        this.roomPresetIndex = 0;   // 📻【新設】空間プリセット用の選択インデックス
        this.isBGMPlaying = false;
        this.onIndexChanged = null; // UI側に更新を通知するコールバック
        this.peaks = new Array(32).fill(0);
        this.bgmList = [];
    }

    /** 動的にサウンドリストを構築 */
    async buildDynamicSoundTestList() {
        const totalStages = 7; 
        const metaPromises = [];
        const base = this.sc.assetBase || "";

        const scenario = new ScenarioManager();

        // 1. メタデータ（YAML）の一括取得
        for (let i = 1; i <= totalStages; i++) {
            metaPromises.push(scenario.peekStageMeta(i, base));
        }

        const results = await Promise.all(metaPromises); 
        
        // 2. 有効なBGMエントリーの初期リスト化
        const candidateList = results
            .map((meta, index) => ({
                stagePath: `stage-${index + 1}`, // 💡 ここで stagePath を定義しておく！
                fileName: meta?.bgm || null,
                displayName: meta?.name ? `Stage-${index + 1}: ${meta.name}` : `Stage-${index + 1}`
            }))
            .filter(item => item.fileName !== null);

        if (candidateList.length === 0) {
            console.warn("[SoundTest] WARNING: No stage YAMLs returned valid BGM data.");
            return;
        }

        if (!this.sc.audio) {
            console.error("[SoundTest] ERROR: Audio manager (this.sc.audio) is missing!");
            return;
        }

        // 3. 各BGMを「stage-X」指定でロードを試み、フォールバックも含めて安全にロード完了を待つ
        const loadedList = await Promise.all(
            candidateList.map(async (item) => {
                // 💡 item.stagePath を使用
                const audioObj = await this.sc.audio.loadStageBGM(item.fileName, item.stagePath);
                
                if (audioObj) {
                    return item; // ロード成功
                } else {
                    console.error(`[SoundTest] Failed to load BGM for ${item.stagePath}: ${item.fileName}`);
                    return null; // 親フォルダにすらなかった場合
                }
            })
        );

        // ロードに成功したものだけに絞り込む
        const validBgmList = loadedList.filter(item => item !== null);

        // 4. オーディオマネージャーと自前リストを更新
        if (typeof this.sc.audio.setDynamicBGMList === 'function') {
            this.sc.audio.setDynamicBGMList(validBgmList);            
        }
        this.bgmList = validBgmList;
    }

    /** 補助メソッド：現在のステージ表記＋曲名を識別子として取得 */
    _getCurrentBgmName() {
        if (this.bgmList && this.bgmList[this.bgmTestIndex]) {
            const current = this.bgmList[this.bgmTestIndex];
            return `${current.stagePath} [${current.fileName}]`;
        }
        return `Unknown_BGM_${this.bgmTestIndex}`;
    }

    /** 内部補助: 現在選択中の BGM を再生 */
    _playCurrentBgm() {
        const currentBgm = this.bgmList[this.bgmTestIndex];
        if (!currentBgm || !this.sc.audio) return;

        // 💡 buildDynamicSoundTestList で準備済みのため、インデックス指定で再生するだけ
        if (typeof this.sc.audio.playBGMByIndex === 'function') {
            this.sc.audio.playBGMByIndex(this.bgmTestIndex);
        }

        // アナリティクスログ
        if (typeof Analytics !== 'undefined' && Analytics.logBgmTestPlay) {
            Analytics.logBgmTestPlay(this._getCurrentBgmName());
        }
    }

    /** SEの選択インデックスを変更 */
    changeSEIndex(isRight) {
        if (!this.sc.audio) return;
        const len = this.sc.audio.seCount || 0;
        if (len > 0) {
            this.soundTestIndex = isRight ? (this.soundTestIndex + 1) % len : (this.soundTestIndex - 1 + len) % len;
        }
    }

    /** BGMの選択インデックスを変更 */
    changeBGMIndex(isRight) {
        const len = this.bgmList?.length || 0;
        if (!this.sc.audio || len === 0) return;

        const delta = isRight ? 1 : -1;
        this.bgmTestIndex = (this.bgmTestIndex + delta + len) % len;

        if (this.isBGMPlaying) {
            this._playCurrentBgm();
        }
    }

    /** 📻【新設】空間アコースティックプリセットの選択インデックスを変更 */
    changeRoomPresetIndex(isRight) {
        if (!this.sc.audio) return;
        const len = this.sc.audio.roomPresetCount || 0;
        if (len > 0) {
            this.roomPresetIndex = isRight ? (this.roomPresetIndex + 1) % len : (this.roomPresetIndex - 1 + len) % len;
            
            // オーディオマネージャー側のノードへリアルタイムに数値を注入
            this.sc.audio.setAudioRoomPreset(this.roomPresetIndex);
        }
    }

    /** SEの再生 */
    playSE() {
        if (this.sc.audio) {
            this.sc.audio.playSEByIndex(this.soundTestIndex);
        }
    }

    /** BGMの再生・停止をトグル制御 */
    toggleBGM(onToggleOnCallback) {
        if (!this.sc.audio) return;

        this.isBGMPlaying = !this.isBGMPlaying;

        if (this.isBGMPlaying) {
            this._playCurrentBgm();

            if (typeof onToggleOnCallback === 'function') {
                onToggleOnCallback(); // イコライザー表示用コールバック
            }
        } else {
            this.sc.audio.resetBGM();
        }
    }

    /** BGM終了時の自動次曲遷移リスナーを設定 */
    setupAudioEndedListener(isModeActive) {
        if (!this.sc.audio) return;        
        this.sc.audio.resetBGM();
        this.sc.audio.onBGMEnded = () => {
            if (!isModeActive || !this.isBGMPlaying) return;
            this.playNextBGMAutomated();
        };
    }

    /** 自動で次の曲へ移行 */
    playNextBGMAutomated() {
        if (!this.sc.audio) return;
        const len = this.bgmList.length;
        if (len <= 0) return;

        this.bgmTestIndex = (this.bgmTestIndex + 1) % len;
        this.isBGMPlaying = true;
        this._playCurrentBgm();

        // UI側に「曲が変わったから描画更新して！」と通知
        if (typeof this.onIndexChanged === 'function') {
            this.onIndexChanged();
        }
    }

    /** 状態の強制リセット */
    stopAndReset() {
        if (this.sc.audio) {
            this.sc.audio.resetBGM();
            if (this.sc.audio.bgmNode) {
                this.sc.audio.bgmNode.onended = null;
            }
        }
        this.isBGMPlaying = false;
        this.peaks.fill(0);
    }

    /** EQ（Low/Mid/High）のゲイン値をリアルタイムに変更 */
    changeEQGain(setting, isRight) {
        if (!this.sc.audio) return;

        const step = isRight ? 1 : -1;
        const targetBand = setting.replace('eq_', ''); // 'low', 'mid', 'high' を抽出

        const currentVal = this.sc.audio.eqSettings[targetBand];
        const newVal = Math.max(-10, Math.min(15, currentVal + step));

        this.sc.audio.setEQGain(targetBand, newVal);
    }

    /** イコライザーの描画ロジック（0 dB基準・空間エフェクト連動強化版） */
    drawEqualizer(ctx, x, y, currentSetting) {
        if (!this.sc.audio || !this.sc.audio.getByteFrequencyData) return;

        const rawData = this.sc.audio.getByteFrequencyData();
        if (!rawData) return;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const targetIndices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const activeCount = targetIndices.length; 
        const canvasWidth = ctx.canvas.width;
        const maxHeight = ctx.canvas.height;
        const barGap = 4; 
        const barWidth = (canvasWidth - (barGap * (activeCount - 1))) / activeCount;

        const eqSettings = this.sc.audio.eqSettings || { low: 0, mid: 0, high: 0 };
        
        const lowBoost  = Math.max(0, eqSettings.low);
        const midBoost  = Math.max(0, eqSettings.mid);
        const highBoost = Math.max(0, eqSettings.high);

        let currentHue = 130;
        const totalBoost = lowBoost + midBoost + highBoost;

        if (totalBoost > 0) {
            const targetHue = ((lowBoost * 20) + (midBoost * 130) + (highBoost * 195)) / totalBoost;
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
        if (this.sc.audio.ROOM_PRESETS && this.sc.audio.ROOM_PRESETS[this.roomPresetIndex]) {
            const p = this.sc.audio.ROOM_PRESETS[this.roomPresetIndex];
            fxLightnessBonus = Math.max(p.reverbWet, p.echoWet) * 12;
        }

        const baseLightness = 30 + (maxFullFactor / 25) * 40;
        const currentLightness = Math.min(82, baseLightness + fxLightnessBonus);

        const barStyle = `hsl(${Math.floor(currentHue)}, ${Math.floor(currentSaturation)}%, ${Math.floor(currentLightness)}%)`;

        ctx.save();
        for (let i = 0; i < activeCount; i++) {
            const rawIdx = targetIndices[i];
            let rawValue = rawData[rawIdx];
            let processedValue = ((rawValue - 140 + (rawIdx * 6)) * 2);
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

            if (barHeight >= this.peaks[i]) {
                this.peaks[i] = barHeight;
            } else {
                this.peaks[i] = Math.max(0, this.peaks[i] - 0.45); 
            }

            if (this.peaks[i] > 0) {
                ctx.fillStyle = "rgba(255, 255, 220, 0.95)";
                ctx.fillRect(barX, y + maxHeight - this.peaks[i], barWidth, 2);
            }

            ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
            for (let h = 0; h < maxHeight; h += 4) {
                ctx.fillRect(barX, y + h, barWidth + 1, 1);
            }
        }
        ctx.restore();
    }
}