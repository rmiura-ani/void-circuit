/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage7Enemies.js - STAGE-7 (Absolute Core) 固有敵クラス群 & ラストボス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import { Enemy, BossEnemy, EnemyBullet, ENEMY_REGISTRY } from '../enemy.js';

// ==========================================
// 1. STAGE-7 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 1. CircuitWalker: 背景の電子グリッドに沿うようにカクカクと90度直角に曲がりながら迫る電子プログラム機
 */
export class CircuitWalkerEnemy extends Enemy {
    get imageName() { return "enemy_circuit_walker.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); // HP = 2
        this.vx = 0;
        this.vy = 2.0;
        this.timer = 0;
        this.turnInterval = 60; // 60Fごとに直角ターン
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.x += this.vx;
        this.y += this.vy;

        // グリッド線に沿うように90度直角ターンを繰り返す
        if (this.timer % this.turnInterval === 0) {
            if (this.vy !== 0) {
                this.vy = 0;
                this.vx = (this.x < game.width / 2) ? 2.5 : -2.5; // 画面中央方向へ曲がる
            } else {
                this.vx = 0;
                this.vy = 2.5; // 再び下降
                this.shoot(game);
            }
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new CircuitWalkerEnemy(game, x, y, bType);
    }
}

/**
 * 2. VoidBit: 自機の周囲を円軌道で周回しながら中心に向けて高密度射撃を行う電子ビット機
 */
export class VoidBitEnemy extends Enemy {
    get imageName() { return "enemy_void_bit.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 1); // HP = 1
        this.width = 24;
        this.height = 24;
        this.angle = Math.random() * Math.PI * 2;
        this.radius = 120; // 自機からの周回半径
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;
        this.angle += 0.04; // 円周運動

        // 自機が存在すれば、自機を中心に円運動を行う
        if (game.player && game.player.alive) {
            const px = game.player.x + game.player.width / 2;
            const py = game.player.y + game.player.height / 2;
            this.x = px + Math.cos(this.angle) * this.radius - this.width / 2;
            this.y = py + Math.sin(this.angle) * this.radius - this.height / 2;
        } else {
            this.y += 2.0;
        }

        // 50F（約0.8秒）周期で自機狙い弾
        const interval = Math.max(1, Math.floor(50 / this.fireRateMultiplier));
        if (this.timer % interval === 0) {
            this.bulletType = 'aim';
            this.shoot(game);
        }

        // 4秒経過（240F）で消滅
        if (this.timer >= 240) {
            this.active = false;
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new VoidBitEnemy(game, x, y, bType);
    }
}

/**
 * 3. GateKeeper: 画面中央を左右に陣取り、格子状（レーザー）の弾幕の壁を作る中型要塞防衛機
 */
export class GateKeeperEnemy extends Enemy {
    get imageName() { return "enemy_gate_keeper.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 8); // HP = 8
        this.width = 64;
        this.height = 48;
        this.speedX = 1.5;
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += 0.3; // 非常にゆっくり下降
        this.x += this.speedX;

        if (this.x < 30 || this.x > game.width - 30 - this.width) {
            this.speedX = -this.speedX; // 画面端で反転
        }

        // 30F周期で全方位8方向弾幕を連続掃射
        const interval = Math.max(1, Math.floor(30 / this.fireRateMultiplier));
        if (this.timer % interval === 0) {
            this.bulletType = 'eight-way';
            this.shoot(game);
        }
    }

    static create(game, x, y, bType, data = {}) {
        const enemy = new GateKeeperEnemy(game, x, y, bType);
        if (data.hp) enemy.hp = data.hp;
        return enemy;
    }
}


// ==========================================
// 2. STAGE-7 最終ボス実体（第1形態 / 第2形態 トランスフォーム）
// ==========================================

/**
 * STAGE-7 ボス: 最終要塞機械心臓（Absolute Core / BossEnemy_07）
 * 特徴: HP33%以下で変形演出に入り【第2形態（Overlord）】へと覚醒・変身するラストボス
 */
export class BossEnemy_07 extends BossEnemy {
    // 形態に応じて自動的に画像パスを切り替え
    get imageName() { 
        return this.formPhase === 2 ? "enemy_boss_07_phase2.webp" : "enemy_boss_07_phase1.webp"; 
    }

    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        super(game, x, -160, hp, timeLimit, timeMultiplier);
        this.isBoss = true;
        this.maxHp = hp; // HP最大値を明示的に設定（第2形態移行判定用）
        this.width = 160;
        this.height = 160;
        this.hitWidth = 120;
        this.hitHeight = 120;

        this.state = 'APPEAR';
        this.timer = 0;
        this.baseX = x - (this.width / 2); // 機体中央を合わせる
        this.x = this.baseX;
        this.formPhase = 1; // 1: 第一形態, 2: 最終形態
        this.isInvincible = false;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.5;
                if (this.y >= 35) {
                    this.state = 'CORE_PHASE_1';
                    this.timer = 0;
                }
                break;

            case 'CORE_PHASE_1':
                this.x = this.baseX + Math.sin(this.timer * 0.01) * 35;

                const intEight = Math.max(1, Math.floor(40 / this.fireRateMultiplier));
                if (this.timer % intEight === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }

                const intAim = Math.max(1, Math.floor(25 / this.fireRateMultiplier));
                if (this.timer % intAim === 0) {
                    this.bulletType = 'aim';
                    this.shoot(game);
                }

                // ⚡ ギミック：HPが33%を切ると第2形態変形演出を発動
                if (this.hp < this.maxHp / 3) {
                    this.formPhase = 2;
                    this.state = 'TRANSFORM';
                    this.timer = 0;
                }
                break;

            case 'TRANSFORM':
                // 変形中の2秒間（120F）は無敵状態
                this.isInvincible = true;
                this.x = this.baseX + Math.sin(this.timer * 0.6) * 6; // 超高速振動

                if (this.timer > 120) {
                    this.isInvincible = false; // 無敵解除
                    this.state = 'FINAL_OVERLORD';
                    this.timer = 0;
                }
                break;

            case 'FINAL_OVERLORD':
                // 最終暴走状態の移動と攻撃
                this.x = this.baseX + Math.sin(this.timer * 0.04) * 80;
                this.y = 35 + Math.cos(this.timer * 0.03) * 15;

                if (this.timer % 15 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                if (this.timer % 10 === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }
                break;
        }
    }

    /** 変形演出中（isInvincible = true）はすべての被ダメージを無効化 */
    takeDamage(amount) {
        if (this.isInvincible) return false;
        return super.takeDamage(amount);
    }

    draw(ctx) {
        ctx.save();
        if (this.state === 'TRANSFORM') {
            const flash = 2.0 + Math.sin(this.timer * 0.8) * 1.5;
            ctx.filter = `contrast(3) brightness(${flash})`;
        } else if (this.formPhase === 2) {
            ctx.filter = 'saturate(3) contrast(1.4) drop-shadow(0px 0px 18px #FF0055)';
        }
        super.draw(ctx);
        ctx.restore();
    }

    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_07(
            game, x, y, 
            data.hp || 150, 
            data.timeLimit || 2400, 
            data.timeMultiplier || 150
        );
    }
}


// ==========================================
// 3. ENEMY_REGISTRY への自動登録
// ==========================================

ENEMY_REGISTRY.set('circuit_walker', CircuitWalkerEnemy);
ENEMY_REGISTRY.set('void_bit', VoidBitEnemy);
ENEMY_REGISTRY.set('gate_keeper', GateKeeperEnemy);
ENEMY_REGISTRY.set('boss_07', BossEnemy_07);