/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage3Enemies.js - STAGE-3 (Cloud Palace) 固有敵クラス群 & ボス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
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
        this.width = 40;
        this.height = (157 / 241) * 40;
        this.isLeftToRight = isLeftToRight;
        
        // 指定された x は使わない、画面外にセット
        this.x = isLeftToRight ? -this.width : game.width + this.width;

        this.speedX = isLeftToRight ? 7.0 : -7.0; // 超高速水平移動
        this.hasShot = false;
    }

    update(game) {
        if (!this.active) return;

        this.x += this.speedX;

        // 画面中央を通過する瞬間に1発だけ鋭い直進弾を放つ
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

    draw(ctx) {
        ctx.save();
        // 右から左へ向かう場合（!isLeftToRight）は左右反転を行う
        if (!this.isLeftToRight) {
            // 画像の中心位置を軸にしてX軸方向に反転
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;

            ctx.translate(centerX, centerY);
            ctx.scale(-1, 1);
            ctx.translate(-centerX, -centerY);
        }
        super.draw(ctx);
        ctx.restore(); 
    }

    static create(game, x, y, bType, data = {}) {
        const isLeft = data.isLeft !== undefined ? data.isLeft : true;
        // YAMLデータ側で x が 0 として渡されている場合、画面外からの出現にしたい場合は x を渡さないか null にします
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
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        super.draw(ctx);
        ctx.restore();
    }

    static create(game, x, y, bType, data = {}) {
        return new CloudLurkerEnemy(game, x, y, bType);
    }
}

/**
 * 4. SkyFalcon: 自機の上空に漂い、自機が直下に重なった瞬間に超高速で垂直急降下（ダイブ）するドッグファイト機
 */
export class SkyFalconEnemy extends Enemy {
    get imageName() { return "enemy_sky_falcon.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); // HP = 2
        this.width = 32;
        this.height = (155 / 135) * 32;
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
        this.width = (250 / 183) * 64;
        this.height = 64;
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
    }

    static create(game, x, y, bType, data = {}) {
        const enemy = new AegisCruiserEnemy(game, x, y, bType);
        if (data.hp) enemy.hp = data.hp;
        return enemy;
    }
}


/// ==========================================
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
        this.height = (505 / 482) * 160; // 約 167px

        this.state = 'APPEAR';
        this.timer = 0;
        this.baseX = x;
    }

    /**
     * 部位ごとの判定領域とダメージ倍率（マルチヒットボックス）
     * 配列の先頭（HEAD）から判定評価を行うことで、頭と本体が重なる領域でも頭の判定が優先されます。
     */
    getHitboxes() {
        // 1. 龍の頭部（手前に大きく出っ張っている弱点）
        const headW = 40;
        const headH = 50;
        const headX = this.x + (this.width - headW) / 2;
        const headY = this.y + this.height - headH; // 下端に合わせて飛び出させる

        // 2. 城郭本体（上部のメイン装甲）
        const bodyW = 120;
        const bodyH = 120;
        const bodyX = this.x + (this.width - bodyW) / 2;
        const bodyY = this.y + 10;

        return [
            // 🎯 弱点: 龍の頭部 (被弾ダメージ 2倍)
            {
                part: 'HEAD',
                multiplier: 2.0,
                x: headX,
                y: headY,
                width: headW,
                height: headH
            },
            // 🛡️ 通常: 城郭（本体） (被弾ダメージ 1倍)
            {
                part: 'BODY',
                multiplier: 1.0,
                x: bodyX,
                y: bodyY,
                width: bodyW,
                height: bodyH
            }
        ];
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
ENEMY_REGISTRY.set('sky_falcon', SkyFalconEnemy);
ENEMY_REGISTRY.set('aegis_cruiser', AegisCruiserEnemy);
ENEMY_REGISTRY.set('boss_03', BossEnemy_03);