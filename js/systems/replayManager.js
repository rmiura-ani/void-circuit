/*
 * PROJECT: VOID-CIRCUIT
 * ReplayManager - 座標・アクションログの記録と再生管理
 */

export class ReplayManager {
    constructor() {
        this.mode = 'RECORD'; // 'RECORD' | 'PLAYBACK'
        this.seed = 12345;
        this.log = [];
        this.currentFrame = 0;
    }

    /** 録画開始 */
    startRecording(seed) {
        this.mode = 'RECORD';
        this.seed = seed;
        this.log = [];
        this.currentFrame = 0;
        console.log(`[ReplayManager] 🔴 録画開始 (Seed: ${seed})`);
    }

    /** 再生開始 */
    startPlayback(replayData) {
        this.mode = 'PLAYBACK';
        this.seed = replayData.seed;
        this.log = replayData.log || [];
        this.currentFrame = 0;
        console.log(`[ReplayManager] ▶️ 再生開始 (総フレーム数: ${this.log.length}, Seed: ${this.seed})`);
    }

    /**
     * 【録画】自機の最終座標とボタン入力を記録
     */
    recordFrame(x, y, isFiring, isBomb) {
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
    getCurrentFrameData() {
        if (this.mode !== 'PLAYBACK') return null;

        const data = this.log[this.currentFrame];

        if (!data && this.currentFrame === this.log.length) {
            console.log(`[ReplayManager] 🏁 再生ログ終了 (${this.currentFrame} frames)`);
        }

        this.currentFrame++;
        return data || null;
    }

    /** エクスポート用データの出力 */
    exportReplay() {
        const payload = {
            version: '1.0',
            seed: this.seed,
            log: this.log
        };
        console.log(`[ReplayManager] 💾 リプレイデータ出力完了 (総ログ数: ${this.log.length})`);
        return payload;
    }
}