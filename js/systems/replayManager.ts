/*
 * PROJECT: VOID-CIRCUIT
 * ReplayManager - 座標・アクションログの記録と再生管理
 */

/** 動作モードのユニオン型 */
export type ReplayMode = 'RECORD' | 'PLAYBACK';

/** 1フレームごとの記録データ */
export interface ReplayFrame {
    x: number;
    y: number;
    f: 0 | 1; // Shot
    b: 0 | 1; // Bomb / Weapon Switch
}

/** 再生・エクスポート用のリプレイデータ構造 */
export interface ReplayData {
    version?: string;
    seed: number;
    log: ReplayFrame[];
}

export class ReplayManager {
    public mode: ReplayMode;
    public seed: number;
    public log: ReplayFrame[];
    public currentFrame: number;

    constructor() {
        this.mode = 'RECORD'; // 'RECORD' | 'PLAYBACK'
        this.seed = 12345;
        this.log = [];
        this.currentFrame = 0;
    }

    /** 録画開始 */
    public startRecording(seed: number): void {
        this.mode = 'RECORD';
        this.seed = seed;
        this.log = [];
        this.currentFrame = 0;
        console.log(`[ReplayManager] 🔴 録画開始 (Seed: ${seed})`);
    }

    /** 再生開始 */
    public startPlayback(replayData: ReplayData): void {
        this.mode = 'PLAYBACK';
        this.seed = replayData.seed;
        this.log = replayData.log || [];
        this.currentFrame = 0;
        console.log(`[ReplayManager] ▶️ 再生開始 (総フレーム数: ${this.log.length}, Seed: ${this.seed})`);
    }

    /**
     * 【録画】自機の最終座標とボタン入力を記録
     */
    public recordFrame(x: number, y: number, isFiring: boolean, isBomb: boolean): void {
        if (this.mode !== 'RECORD') return;

        this.log.push({
            x: Math.round(x),
            y: Math.round(y),
            f: isFiring ? 1 : 0,  // Shot
            b: isBomb ? 1 : 0     // Bomb / Weapon Switch
        });

        this.currentFrame++;
    }

    /**
     * 【再生】現在のフレームの座標・アクションデータを取り出す
     */
    public getCurrentFrameData(): ReplayFrame | null {
        if (this.mode !== 'PLAYBACK') return null;

        const data = this.log[this.currentFrame];

        if (!data && this.currentFrame === this.log.length) {
            console.log(`[ReplayManager] 🏁 再生ログ終了 (${this.currentFrame} frames)`);
        }

        this.currentFrame++;
        return data || null;
    }

    /** エクスポート用データの出力 */
    public exportReplay(): Required<ReplayData> {
        const payload: Required<ReplayData> = {
            version: '1.0',
            seed: this.seed,
            log: this.log
        };
        console.log(`[ReplayManager] 💾 リプレイデータ出力完了 (総ログ数: ${this.log.length})`);
        return payload;
    }
}