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

import { Enemy, BossEnemy, EnemyBullet, ENEMY_REGISTRY } from '../enemy.js';

// ==========================================
// 1. STAGE-3 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 1. WindSlicer: 画面左右の外側から超高速で水平横断する風切りストライカー
 */
export class WindSlicerEnemy extends Enemy {
    get imageName() { return "enemy_wind_slicer.webp"; }

    constructor(game, x, y, bulletType, isLeftToRight = true) {
        super(game, x, y, bulletType, 1); // HP = 1
        this.isLeftToRight = isLeftToRight;
        this.x = isLeftToRight ? -40 : game.width + 40;
        this.speedX = isLeftToRight ? 7.0 : -7.0; // 超高速水平移動
        this.hasShot = false;
    }

    update(game) {
        if (!this.active) return;

        this.x += this.speedX;

        // 画面中央を通過する瞬間に1発だけ鋭い直進弾を放つ
        const isNearCenter = this.isLeftToRight ? (this.x >= game.width / 2) : (this.x <= game.width / 2);
        if (isNearCenter && !this.hasShot) {
            this.shoot(game);
            this.hasShot = true;
        }

        if (this.x < -60 || this.x > game.width + 60) {
            this.active = false;
        }
    }

    static create(game, x, y, bType, data = {}) {
        const isLeft = data.isLeft !== undefined ? data.isLeft : true;
        return new WindSlicerEnemy(game, x, y, bType, isLeft);
    }
}

/**
 * 2. CloudLurker: 雲の中に隠れて半透明で出現し、射撃時のみ実体化（グラフィック明瞭化）する奇襲機
 */
export class CloudLurkerEnemy extends Enemy {
    get imageName() { return "enemy_cloud_lurker.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); // HP = 2
        this.speed = 1.2;
        this.timer = 0;
        this.alpha = 0.25; // 雲の中（半透明）
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += this.speed;

        // 60F（1秒）ごとに雲から姿を現して射撃
        if (this.timer % Math.floor(60 / this.fireRateMultiplier) === 0) {
            this.alpha = 1.0; // 実体化
            this.shoot(game);
        } else {
            // 徐々に半透明に戻って雲へ隠れる
            this.alpha = Math.max(0.25, this.alpha - 0.05);
        }

        if (this.isOutOfBounds(50, true)) {
            this.active = false;
        }
    }

    draw(ctx, isInvincibleCheat = false) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        super.draw(ctx, isInvincibleCheat);
        ctx.restore();
    }

    static create(game, x, y, bType, data = {}) {
        return new CloudLurkerEnemy(game, x, y, bType);
    }
}

/**
 * 3. GaleArtillery: 画面上部に陣取り、強風（自機を横へ押し流す風圧効果）を発生させる固定砲台
 */
export class GaleArtilleryEnemy extends Enemy {
    get imageName() { return "enemy_gale_artillery.webp"; }

    constructor(game, x, y, bulletType, stopY = 80) {
        super(game, x, y, bulletType, 4); // HP = 4
        this.stopY = stopY;
        this.timer = 0;
        this.state = 'MOVE_IN';
        this.windDirection = Math.random() < 0.5 ? 1 : -1; // 左吹きか右吹きか
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'MOVE_IN':
                this.y += 2.0;
                if (this.y >= this.stopY) {
                    this.state = 'BLOW_GALE';
                }
                break;

            case 'BLOW_GALE':
                this.timer++;

                // 🌪️ 環境干渉ギミック: 自機が生きていれば風圧で横に少しずつ押し流す
                if (game.player && game.player.alive) {
                    game.player.x += this.windDirection * 0.8;
                    // 画面外はみ出し防止
                    game.player.x = Math.max(0, Math.min(game.width - game.player.width, game.player.x));
                }

                if (this.timer % Math.floor(45 / this.fireRateMultiplier) === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }

                if (this.timer >= 300) {
                    this.state = 'RETREAT';
                }
                break;

            case 'RETREAT':
                this.y -= 3.0;
                if (this.isOutOfBounds(50, true)) {
                    this.active = false;
                }
                break;
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new GaleArtilleryEnemy(game, x, y, bType, data.stopY || 80);
    }
}

/**
 * 4. SkyFalcon: 自機の上空に漂い、自機が直下に重なった瞬間に超高速で垂直急降下（ダイブ）するドッグファイト機
 */
export class SkyFalconEnemy extends Enemy {
    get imageName() { return "enemy_sky_falcon.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); // HP = 2
        this.state = 'HOVER'; // HOVER, LOCKON, DIVE
        this.timer = 0;
        this.speedX = 1.8;
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
                    this.shoot(game); // 突撃開始時に1発
                }
                break;

            case 'DIVE':
                this.y += 8.0; // 超高速急降下
                if (this.isOutOfBounds(50, true)) {
                    this.active = false;
                }
                break;
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new SkyFalconEnemy(game, x, y, bType);
    }
}

/**
 * 5. AegisCruiser: 両脇に小型ビット（護衛機）を連れて現れる大型巡洋機
 */
export class AegisCruiserEnemy extends Enemy {
    get imageName() { return "enemy_aegis_cruiser.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 8); // 高耐久 HP = 8
        this.width = 64;  // 大型機
        this.height = 48;
        this.speedY = 0.6;
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += this.speedY;

        // 定期的に8方向拡散弾を撒き散らす
        if (this.timer % Math.floor(90 / this.fireRateMultiplier) === 0) {
            this.bulletType = 'eight-way';
            this.shoot(game);
        }

        if (this.isOutOfBounds(60, true)) {
            this.active = false;
        }
    }

    static create(game, x, y, bType, data = {}) {
        const enemy = new AegisCruiserEnemy(game, x, y, bType);
        if (data.hp) enemy.hp = data.hp;
        return enemy;
    }
}


// ==========================================
// 2. STAGE-3 ボス実体
// ==========================================

/**
 * STAGE-3 ボス: 蒼穹龍神（BossEnemy_03）
 * 特徴: ハイスピードなS字蛇行と、ブラススタブ（キメ音）と同調した急降下突撃を放つドラゴンボス
 */
export class BossEnemy_03 extends BossEnemy {
    get imageName() { return "enemy_boss_03.webp"; }

    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        y = -160;
        super(game, x, y, hp, timeLimit, timeMultiplier);
        this.isBoss = true;
        this.width = 160;
        this.height = 128;
        this.hitWidth = 120;
        this.hitHeight = 90;

        this.state = 'APPEAR';
        this.timer = 0;
        this.baseX = x;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 1.5; // 高速進入
                if (this.y >= 60) {
                    this.state = 'SINE_DRIVE';
                    this.timer = 0;
                }
                break;

            case 'SINE_DRIVE':
                // メタルの高速ベースラインに合わせたダイナミックなS字運動
                this.x = this.baseX + Math.sin(this.timer * 0.06) * 100;
                this.y = 60 + Math.cos(this.timer * 0.03) * 30;

                if (this.timer % 24 === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }

                // 400Fごとに画面下部への急降下突撃
                if (this.timer > 400) {
                    this.state = 'DRAGON_CHARGE';
                    this.timer = 0;
                }
                break;

            case 'DRAGON_CHARGE':
                this.y += 6.0; // 牙を剥いて突撃
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
                // 上空の定位置へと帰還
                this.y -= 3.0;
                this.x += (this.baseX - this.x) * 0.05;
                if (this.y <= 60) {
                    this.y = 60;
                    this.state = 'SINE_DRIVE';
                    this.timer = 0;
                }
                break;
        }
    }

    onDie(game) {
        if (game.collisions) {
            for (let i = 0; i < 12; i++) {
                setTimeout(() => {
                    game.collisions.createExplosion(
                        this.x + Math.random() * this.width, 
                        this.y + Math.random() * this.height, 
                        { maxHp: 100 }
                    );
                }, i * 100);
            }
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_03(
            game, x, y, 
            data.hp || 70, 
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
ENEMY_REGISTRY.set('gale_artillery', GaleArtilleryEnemy);
ENEMY_REGISTRY.set('sky_falcon', SkyFalconEnemy);
ENEMY_REGISTRY.set('aegis_cruiser', AegisCruiserEnemy);
ENEMY_REGISTRY.set('boss_03', BossEnemy_03);