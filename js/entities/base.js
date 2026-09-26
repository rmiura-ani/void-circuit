/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/base.js - アセット管理、エンティティベース、
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

/**
 * 全エンティティの基底クラス
 */
export class Entity {
    /**
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} width - 当たり判定幅
     * @param {number} height - 当たり判定高さ
     */
    constructor(x, y, width = 0, height = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.active = true;
    }

    /**
     * 共通の画面外判定（弾や通常エフェクト用）
     * @param {number} margin 許容マージン
     */
    isOutOfBounds(margin = 32) {
        // 🛑 【最優先セーフティ】NaN ガード
        if (Number.isNaN(this.x) || Number.isNaN(this.y)) return true;

        // 🛑 【プレイヤー保護】Playerは画面外判定で絶対消さない
        if (this.constructor && this.constructor.name === 'Player') return false;

        const gameWidth = typeof GAME_CONFIG !== 'undefined' ? game.width : 800;
        const gameHeight = typeof GAME_CONFIG !== 'undefined' ? game.height : 600;

        return (
            this.y > gameHeight + margin || 
            this.y < -margin || 
            this.x > gameWidth + margin || 
            this.x < -margin
        );
    }

    /** フレーム更新処理（サブクラスでオーバーライド） */
    update(game) {}

    /** 描画処理（サブクラスでオーバーライド） */
    draw(ctx) {}
}


/**
 * AssetManager: 画像アセットの完全動的オンデマンドロード管理
 */
export class AssetManager {
    constructor(basePath) {
        this.basePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
        this.stagePath = null;
        this.imageCache = {};
        this.loadingPromises = {};
    }

    get(key) {
        if (!key) return null;

        // キャッシュにある場合
        if (this.imageCache[key]) {
            const cachedImg = this.imageCache[key];
            // 💡 エラーで破綻した画像（naturalWidth === 0 かつ complete === true）なら null を返す
            if (cachedImg.complete && cachedImg.naturalWidth === 0) {
                return null;
            }
            return cachedImg;
        }

        if (key.includes("LOOP") || key.includes("BOSS_TRIGGER") || !key.includes(".")) {
            return null;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        this.imageCache[key] = img;

        this.loadingPromises[key] = new Promise(resolve => {
            img.onload = () => {
                console.log(`[Assets] Ready: ${key} (from ${img.src})`);
                resolve(img);
            };

            const handleFinalError = () => {
                console.error(`[Assets] ❌ Load failed completely: ${key}`);
                delete this.imageCache[key];
                delete this.loadingPromises[key];
                resolve(null);
            };

            if (this.stagePath) {
                const stageUrl = `${this.basePath}${this.stagePath}/${key}`;

                img.onerror = () => {
                    const fallbackUrl = `${this.basePath}${key}`;

                    img.onerror = handleFinalError;
                    img.src = fallbackUrl;
                };

                img.src = stageUrl;
            } else {
                const defaultUrl = `${this.basePath}${key}`;
                img.onerror = handleFinalError;
                img.src = defaultUrl;
            }
        });

        return img;
    }

    /** 💡 キャッシュ明示的クリアメソッド */
    clearCache() {
        this.imageCache = {};
        this.loadingPromises = {};
    }

    async preload(keys, stagePath) {
        // 💡 ステージ切り替え時は古いキャッシュを破棄して読み直しを許可する
        if (this.stagePath !== stagePath) {
            this.clearCache();
        }
        this.stagePath = stagePath;

        await Promise.all(keys.map(key => {
            this.get(key);
            return this.loadingPromises[key] || Promise.resolve();
        }));
        console.log(`[Assets] Core images preloaded for: ${stagePath || 'default'}`);
    }
}