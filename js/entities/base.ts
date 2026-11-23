/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/base.ts - アセット管理、エンティティベース
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import type { BoundsContext, GameContext, PlayerInputState } from '../types/entities.js';

export type { BoundsContext, GameContext, PlayerInputState };

/**
 * 全エンティティの基底クラス
 */
export class Entity {
    public x: number;
    public y: number;
    public width: number;
    public height: number;
    public active: boolean;

    /** true の間は画面外に出ても自動消滅しない（ボス戦や画面外往復ギミック用） */
    public ignoreOutOfBounds: boolean = false;
    public outOfBoundsMargin: number = 32;    /** 自身のサイズに加えて確保する画面外マージン（px） */

    constructor(x: number, y: number, width: number = 0, height: number = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.active = true;
    }

    /**
     * 共通の画面外判定（弾や通常エフェクト用）
     */
    public isOutOfBounds(game: BoundsContext, extraMargin: number = this.outOfBoundsMargin): boolean {
        if (this.ignoreOutOfBounds) return false;

        // 自分の幅・高さ＋余裕マージンを許容範囲にする
        const marginX = (this.width || 0) + extraMargin;
        const marginY = (this.height || 0) + extraMargin;

        return (
            this.x < -marginX ||
            this.x > game.width + marginX ||
            this.y < -marginY ||
            this.y > game.height + marginY
        );
    }

    /** フレーム更新処理（サブクラスでオーバーライド） */
    public update(_game: GameContext): void {}

    /** 描画処理（サブクラスでオーバーライド） */
    public draw(_ctx: CanvasRenderingContext2D): void {}
}

/**
 * AssetManager: 画像アセットの完全動的オンデマンドロード管理
 */
export class AssetManager {
    public basePath: string;
    public stagePath: string | null;
    public imageCache: Record<string, HTMLImageElement>;
    public loadingPromises: Record<string, Promise<HTMLImageElement | null>>;

    constructor(basePath: string) {
        this.basePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
        this.stagePath = null;
        this.imageCache = {};
        this.loadingPromises = {};
    }

    public get(key: string): HTMLImageElement | null {
        if (!key) return null;

        if (this.imageCache[key]) {
            const cachedImg = this.imageCache[key];
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

        this.loadingPromises[key] = new Promise<HTMLImageElement | null>(resolve => {
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

    /** キャッシュ明示的クリアメソッド */
    public clearCache(): void {
        this.imageCache = {};
        this.loadingPromises = {};
    }

    public async preload(keys: string[], stagePath?: string | null): Promise<void> {
        const normalizedStagePath = stagePath ?? null;

        if (this.stagePath !== normalizedStagePath) {
            this.clearCache();
        }
        this.stagePath = normalizedStagePath;

        await Promise.all(keys.map(key => {
            this.get(key);
            return this.loadingPromises[key] || Promise.resolve(null);
        }));
        console.log(`[Assets] Core images preloaded for: ${normalizedStagePath || 'default'}`);
    }
}