/*
 * PROJECT: VOID-CIRCUIT
 * 
 * entities/enemies/stage1Enemies.ts - STAGE-1 (Iron Vein) 固有敵クラス群 & ボス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import {
    BossEnemy,
    EnemyBullet,
    ENEMY_REGISTRY
} from '../enemy.js';
import type {
    BossTargetLike,
    BulletType,
    EnemyGameContext,
    EnemySpawnData
} from '../../types/entities.js';

// ==========================================
// 1. STAGE-1 ボス実体
// ==========================================
/**
 * STAGE-1 ボス: アイアン・ヴェイン防衛コア（BossEnemy_01）
 */
export class BossEnemy_01 extends BossEnemy {
    // 移動・演出パラメータ
    public stopY: number = 90;
    public entranceSpeed: number = 1.5;
    public swingWidth: number = 60;   // 左右の揺れ幅
    public swingSpeed: number = 0.02; // 左右の揺れ速度

    public state: 'ENTRANCE' | 'BATTLE' = 'ENTRANCE';
    public override frame: number = 0;

    public override get imageName(): string { return "enemy_boss_01.webp"; }

    constructor(
        game: EnemyGameContext ,
        hp: number = 500,
        timeLimit?: number,
        timeMultiplier?: number
    ) {
        super(game, hp, timeLimit, timeMultiplier);
        this.isBoss = true;
        this.width = 96;
        this.height = 80;
        this.hitWidth = 75;
        this.hitHeight = 70;
    }

    /** ボスの中心X座標 */
    public get centerX(): number {
        return this.x + this.width / 2;
    }

    /** ボスの中心Y座標 */
    public get centerY(): number {
        return this.y + this.height / 2;
    }

    /**
     * メイン更新処理
     */
    public override update(game: EnemyGameContext ): void {
        if (!this.active) return;
        this.frame++;

        switch (this.state) {
            case 'ENTRANCE':
                this.updateEntrance();
                break;

            case 'BATTLE':
                this.updateBattle(game);
                break;

            default:
                break;
        }
    }

    /**
     * 1. 登場フェーズ更新
     */
    public updateEntrance(): void {
        if (this.y < this.stopY) {
            this.y += this.entranceSpeed;
        } else {
            this.state = 'BATTLE';
            // BATTLE移行時にタイマーを0リセット（startX を基準にスムーズに揺れ運動を開始）
            this.frame = 0;
            this.startX = this.x;
        }
    }

    /**
     * 2. 戦闘フェーズ更新（移動＋攻撃）
     */
    public updateBattle(game: EnemyGameContext ): void {
        // 親クラスで保持されている startX を基準に滑らかに横揺れ
        this.x = this.startX + Math.sin(this.frame * this.swingSpeed) * this.swingWidth;

        // 弾幕パターンA: 120フレーム毎 全方位8方向弾
        if (this.frame % 120 === 0) {
            this.fireRingBullets(game, 8, 3);
        }

        // 弾幕パターンB: HP 50%未満かつ40フレーム毎 自機狙い2連射
        const isSecondPhase = this.hp < this.maxHp * 0.5;
        if (isSecondPhase && this.frame % 40 === 0 && game.player && game.player.alive) {
            this.fireTargetedDualBullets(game, game.player, 4, 20);
        }
    }

    /**
     * 【弾幕A】 全方位リング弾を発射
     */
    public fireRingBullets(game: EnemyGameContext , count: number = 8, speed: number = 3): void {
        const cx = this.centerX;
        const cy = this.centerY;
        const step = (Math.PI * 2) / count;

        for (let i = 0; i < count; i++) {
            const angle = step * i;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            game.entities.push(new EnemyBullet(cx, cy, vx, vy));
        }
    }

    /**
     * 【弾幕B】 自機を狙った左右並列2連射
     */
    public fireTargetedDualBullets(
        game: EnemyGameContext ,
        target: BossTargetLike,
        speed: number = 4,
        offsetX: number = 20
    ): void {
        const cx = this.centerX;
        const cy = this.centerY;

        const targetCx = target.x + (target.width ? target.width / 2 : 0);
        const targetCy = target.y + (target.height ? target.height / 2 : 0);

        const angle = Math.atan2(targetCy - cy, targetCx - cx);
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        // 左右2箇所から発射
        game.entities.push(new EnemyBullet(cx - offsetX, cy, vx, vy));
        game.entities.push(new EnemyBullet(cx + offsetX, cy, vx, vy));
    }

    public static override create(
        game: EnemyGameContext ,
        _bType?: BulletType,
        hp?: number,
        data: EnemySpawnData = {}
    ): BossEnemy_01 {
        return new BossEnemy_01(
            game,
            hp || 500,
            typeof data.timeLimit === 'number' ? data.timeLimit : undefined,
            typeof data.timeMultiplier === 'number' ? data.timeMultiplier : undefined
        );
    }
}

// ========================================================
// 2. ENEMY_REGISTRY へのボス登録
// ========================================================
ENEMY_REGISTRY.set("boss_01", BossEnemy_01);