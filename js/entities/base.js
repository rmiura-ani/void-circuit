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
     * 画面外および座標異常の共通判定
     * @param {number} margin 通常エンティティの画面外許容マージン
     * @param {boolean} isEnemy 敵固有のトリッキーな移動（左右・上への一時アウト）を許容するか
     * @returns {boolean} 排除すべき対象（画面外・異常値）ならtrue
     */
    isOutOfBounds(margin, isEnemy = false) {
        // 🛑 【最優先セーフティ】座標が NaN になったら無条件で即時排除
        if (Number.isNaN(this.x) || Number.isNaN(this.y)) {
            return true;
        }

        const gameWidth = typeof GAME_CONFIG !== 'undefined' ? GAME_CONFIG.WIDTH : 800;
        const gameHeight = typeof GAME_CONFIG !== 'undefined' ? GAME_CONFIG.HEIGHT : 600;

        // 🛑 【敵専用ロジック】トリッキーな動きをする敵の場合
        if (isEnemy) {
            // 1. 下方向に完全に突き抜けたら消滅
            if (this.y > gameHeight) {
                return true;
            }

            // 2. 画面外から戻ってくる動きを許容しつつ、絶対に戻ってこれない領域（3000px）に暴走した場合は強制排除
            const ABSOLUTE_LIMIT = 3000;
            if (this.x < -ABSOLUTE_LIMIT || this.x > ABSOLUTE_LIMIT || this.y < -ABSOLUTE_LIMIT) {
                return true;
            }

            return false;
        }

        // 🛑 【通常ロジック】自機、自機弾、敵弾などは四方のマージンを越えたら即消滅
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

        if (this.imageCache[key]) {
            return this.imageCache[key];
        }
        if (key.includes("LOOP") || key.includes("BOSS_TRIGGER") || !key.includes(".")) {
            return null;
        }
        
        if (!this.loadingPromises[key]) {
            this.loadingPromises[key] = new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = "anonymous";

                img.onload = () => {
                    this.imageCache[key] = img;
                    console.log(`[Assets] Ready: ${key} (from ${img.src})`);
                    resolve(img);
                };

                if (this.stagePath) {
                    const stageUrl = `${this.basePath}${this.stagePath}/${key}`;
                    
                    img.onerror = () => {
                        const fallbackUrl = `${this.basePath}${key}`;
                        
                        img.onerror = () => {
                            console.error(`[Assets] ❌ Load failed completely: ${key}`);
                            this.loadingPromises[key] = null;
                            resolve(null);
                        };
                        img.src = fallbackUrl;
                    };
                    
                    img.src = stageUrl;
                } else {
                    const defaultUrl = `${this.basePath}${key}`;
                    img.onerror = () => {
                        console.error(`[Assets] ❌ Load failed: ${defaultUrl}`);
                        this.loadingPromises[key] = null;
                        resolve(null);
                    };
                    img.src = defaultUrl;
                }
            });
        }

        return null; 
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