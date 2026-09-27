/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage3Enemies.js - STAGE-3 (Cloud Palace) 固有敵クラス群 & ボス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
"use strict";

import { Enemy, BossEnemy, ENEMY_REGISTRY } from '../enemy.js';

// ==========================================
// 1. STAGE-3 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 1. WindSlicer: 画面左右の外側から超高速で水平横断する風切りストライカー
 */
export class WindSlicerEnemy extends Enemy {
    isLeftToRight = true;
    speedX = 7.0;
    hasShot = false;

    get imageName() { return "enemy_wind_slicer.webp"; }

    constructor(game, bulletType = 'straight', hp = 1) {
        super(game, bulletType, hp);
        this.width = 40;
        this.height = (157 / 241) * 40;
    }

    /** 方向と速度の設定 */
    setDirection(isLeftToRight) {
        this.isLeftToRight = isLeftToRight;
        this.speedX = isLeftToRight ? 7.0 : -7.0;
    }

    update(game) {
        if (!this.active) return;

        this.x += this.speedX;

        // 画面中央を通過する瞬間に1発だけ親の shoot(game) で射撃
        const isNearCenter = this.isLeftToRight 
            ? (this.x >= game.width / 2) 
            : (this.x <= game.width / 2);

        if (isNearCenter && !this.hasShot) {
            this.shoot(game);
            this.hasShot = true;
        }

        // 画面外に出て一定距離進んだら非アクティブ化
        if (this.x < -60 || this.x > game.width + 60) {
            this.active = false;
        }
    }

    draw(ctx, isDebug = false) {
        if (!this.active) return;

        ctx.save();
        // 右から左へ向かう場合（!isLeftToRight）は左右反転を行う
        if (!this.isLeftToRight) {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;

            ctx.translate(centerX, centerY);
            ctx.scale(-1, 1);
            ctx.translate(-centerX, -centerY);
        }
        super.draw(ctx, isDebug);
        ctx.restore(); 
    }

    static create(game, bType, hp, data = {}) {
        const enemy = new WindSlicerEnemy(game, bType, hp);
        
        // data.from が 'right' または data.isLeft が false なら右から左へ移動
        const isLeftToRight = data.from === 'right' ? false : (data.isLeft !== undefined ? data.isLeft : true);
        enemy.setDirection(isLeftToRight);
        
        return enemy;
    }
}

/**
 * 2. CloudLurker: 雲の中に隠れて半透明で出現し、射撃時のみ実体化（グラフィック明瞭化）する奇襲機
 */
export class CloudLurkerEnemy extends Enemy {
    speed = 1.2;
    alpha = 0.25; // 雲の中（半透明）

    get imageName() { return "enemy_cloud_lurker.webp"; }

    constructor(game, bulletType = 'aim', hp = 2) {
        super(game, bulletType, hp);
        this.baseShootInterval = 60; // 60フレーム間隔で射撃
    }

    update(game) {
        if (!this.active) return;

        this.y += this.speed;

        // 前回発射時からのカウント（shootTimer）を監視して透過度を制御
        const currentInterval = Math.max(1, Math.floor(this.baseShootInterval / this.fireRateMultiplier));
        if (this.shootTimer >= currentInterval - 1) {
            this.alpha = 1.0; // 発射直前に実体化
        } else {
            // 徐々に半透明に戻る
            this.alpha = Math.max(0.25, this.alpha - 0.05);
        }

        // 親クラスの自動射撃カウンター＆発射処理を実行
        super.update(game);
    }

    draw(ctx, isDebug = false) {
        if (!this.active) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;
        super.draw(ctx, isDebug);
        ctx.restore();
    }

    static create(game, bType, hp, data = {}) {
        return new CloudLurkerEnemy(game, bType, hp);
    }
}

/**
 * 3. SkyFalcon: 自機の上空に漂い、自機が直下に重なった瞬間に超高速で垂直急降下（ダイブ）するドッグファイト機
 */
export class SkyFalconEnemy extends Enemy {
    state = 'HOVER'; // HOVER, LOCKON, DIVE
    timer = 0;
    speedX = 1.8;

    get imageName() { return "enemy_sky_falcon.webp"; }

    constructor(game, bulletType = 'aim', hp = 2) {
        super(game, bulletType, hp);
        this.width = 32;
        this.height = (155 / 135) * 32;
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'HOVER':
                // 画面上部を優雅に左右往復運動
                this.x += this.speedX;
                if (this.x < 20 || this.x > game.width - 20 - this.width) {
                    this.speedX = -this.speedX;
                }

                // 自機が真下（X軸の差が30px以内）に入ったらロックオン
                if (game.player && Math.abs((this.x + this.width / 2) - (game.player.x + game.player.width / 2)) < 30) {
                    this.state = 'LOCKON';
                    this.timer = 0;
                }
                break;

            case 'LOCKON':
                this.timer++;
                // 15Fの間、急降下前兆（画面上で短く震える）
                this.x += Math.sin(this.timer * 0.8) * 2;

                if (this.timer >= 15) {
                    this.state = 'DIVE';
                    this.shoot(game); // 突撃開始時に1発射撃
                }
                break;

            case 'DIVE':
                this.y += 8.0; // 超高速急降下
                break;
        }
    }

    static create(game, bType, hp, data = {}) {
        return new SkyFalconEnemy(game, bType, hp);
    }
}

/**
 * 4. AegisCruiser: 大型巡洋機（設定された bulletType に応じて定期射撃）
 */
export class AegisCruiserEnemy extends Enemy {
    speedY = 0.6;

    get imageName() { return "enemy_aegis_cruiser.webp"; }

    constructor(game, bulletType = 'eight-way', hp = 8) {
        super(game, bulletType, hp);
        this.width = (250 / 183) * 64;
        this.height = 64;
        this.baseShootInterval = 90; // 90フレーム間隔
    }

    update(game) {
        if (!this.active) return;

        this.y += this.speedY;

        // 親クラスの自動射撃カウンター＆発射処理に任せる
        super.update(game);
    }

    static create(game, bType, hp, data = {}) {
        const enemy = new AegisCruiserEnemy(game, bType, hp);
        if (data.hp) enemy.hp = data.hp;
        return enemy;
    }
}

// ==========================================
// 2. STAGE-3 ボス実体
// ==========================================

/**
 * STAGE-3 ボス: 蒼穹龍神（BossEnemy_03）
 */
export class BossEnemy_03 extends BossEnemy {
    state = 'APPEAR';
    timer = 0;

    get imageName() { return "enemy_boss_03.webp"; }

    constructor(game, hp = 700, timeLimit, timeMultiplier) {
        super(game, hp, timeLimit, timeMultiplier);
        this.isBoss = true;
        this.width = 160;
        this.height = (505 / 482) * 160; // 約 167px
        this.y = -160; // 上部画面外から進入
    }

    /** 部位ごとの判定領域とダメージ倍率（マルチヒットボックス） */
    getHitboxes() {
        const headW = 40;
        const headH = 50;
        const headX = this.x + (this.width - headW) / 2;
        const headY = this.y + this.height - headH;

        const bodyW = 120;
        const bodyH = 120;
        const bodyX = this.x + (this.width - bodyW) / 2;
        const bodyY = this.y + 10;

        return [
            { part: 'HEAD', multiplier: 2.0, x: headX, y: headY, width: headW, height: headH },
            { part: 'BODY', multiplier: 1.0, x: bodyX, y: bodyY, width: bodyW, height: bodyH }
        ];
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 1.5;
                if (this.y >= 40) {
                    this.state = 'SINE_DRIVE';
                    this.timer = 0;
                    this.startX = this.x;
                }
                break;

            case 'SINE_DRIVE':
                this.x = this.startX + Math.sin(this.timer * 0.06) * 100;
                this.y = 40 + (1 - Math.cos(this.timer * 0.03)) * 30;

                if (this.timer % 24 === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }

                if (this.timer > 400) {
                    this.state = 'DRAGON_CHARGE';
                    this.timer = 0;
                }
                break;

            case 'DRAGON_CHARGE':
                this.y += 6.0;
                if (this.timer % 10 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                if (this.y >= 320) {
                    this.state = 'RETREAT';
                    this.timer = 0;
                }
                break;

            case 'RETREAT':
                this.y += (40 - this.y) * 0.1;
                this.x += (this.startX - this.x) * 0.1;

                if (Math.abs(this.y - 40) < 1.0 && Math.abs(this.x - this.startX) < 1.0) {
                    this.y = 40;
                    this.x = this.startX;
                    this.state = 'SINE_DRIVE';
                    this.timer = 0;
                }
                break;
        }
    }

    static create(game, bType, hp, data = {}) {
        return new BossEnemy_03(
            game, 
            hp || 700, 
            data.timeLimit || 1800, 
            data.timeMultiplier || 100
        );
    }
}

// ==========================================
// 3. ENEMY_REGISTRY への自動登録
// ==========================================

ENEMY_REGISTRY.set('wind_slicer', WindSlicerEnemy);
ENEMY_REGISTRY.set('cloud_lurker', CloudLurkerEnemy);
ENEMY_REGISTRY.set('sky_falcon', SkyFalconEnemy);
ENEMY_REGISTRY.set('aegis_cruiser', AegisCruiserEnemy);
ENEMY_REGISTRY.set('boss_03', BossEnemy_03);