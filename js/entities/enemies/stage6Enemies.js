/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage6Enemies.js - STAGE-6 (Burning Orbit) 固有敵クラス群 & ボス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import { Enemy, BossEnemy, EnemyBullet, ENEMY_REGISTRY } from '../enemy.js';

// ==========================================
// 1. STAGE-6 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 1. OrbitInterceptor: 大気圏突入（赤熱エフェクト）後、急ブレーキをかけてミサイルを放ち上空へ離脱する邀撃機
 */
export class OrbitInterceptorEnemy extends Enemy {
    get imageName() { return "enemy_orbit_interceptor.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); // HP = 2
        this.speedY = 6.0;
        this.state = 'ENTRY'; // ENTRY, BRAKE, RETREAT
        this.stateTimer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.stateTimer++;

        switch (this.state) {
            case 'ENTRY':
                this.y += this.speedY;
                if (this.y >= 140) {
                    this.state = 'BRAKE';
                    this.stateTimer = 0; // 状態遷移時にタイマーリセット
                    this.bulletType = 'triple';
                    this.shoot(game);
                }
                break;

            case 'BRAKE':
                this.y += 0.5;
                if (this.stateTimer >= 90) { // ブレーキ状態を確実に90F維持
                    this.state = 'RETREAT';
                    this.stateTimer = 0;
                }
                break;

            case 'RETREAT':
                this.y -= 4.0;
                break;
        }
    }

    draw(ctx) {
        ctx.save();
        if (this.state === 'ENTRY') {
            ctx.filter = 'brightness(1.8) saturate(2) drop-shadow(0px 0px 8px #FF4500)';
        }
        super.draw(ctx);
        ctx.restore();
    }

    static create(game, x, y, bType, data = {}) {
        return new OrbitInterceptorEnemy(game, x, y, bType);
    }
}

/**
 * 2. HeatArmor: 正面装甲（真下からの攻撃）を完全無効化する重装甲機
 */
export class HeatArmorEnemy extends Enemy {
    get imageName() { return "enemy_heat_armor.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 6); // HP = 6
        this.speedY = 0.6;
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;
        this.y += this.speedY;

        const interval = Math.max(1, Math.floor(70 / this.fireRateMultiplier));
        if (this.timer % interval === 0) {
            this.bulletType = 'straight';
            this.shoot(game);
        }
    }

    /** 正面耐熱装甲：自機が正面（幅±20px以内）から攻撃した場合は無効化 */
    takeDamage(amount) {
        if (this.game && this.game.player) {
            const playerX = this.game.player.x + this.game.player.width / 2;
            const myX = this.x + this.width / 2;
            if (Math.abs(playerX - myX) < 20) {
                // TODO: 装甲で弾かれた効果音（SE）や火花エフェクトを呼び出すとより良くなります
                return false;
            }
        }
        return super.takeDamage(amount);
    }

    static create(game, x, y, bType, data = {}) {
        return new HeatArmorEnemy(game, x, y, bType);
    }
}

/**
 * 3. HomingPod: プレイヤーを追尾する弾を一定間隔で射出するポッド機
 */
export class HomingPodEnemy extends Enemy {
    get imageName() { return "enemy_homing_pod.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); // HP = 2
        this.speedY = 0.8;
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;
        this.y += this.speedY;

        const interval = Math.max(1, Math.floor(80 / this.fireRateMultiplier));
        if (this.timer % interval === 0) {
            this.shootHomingBullet(game);
        }
    }

    shootHomingBullet(game) {
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;

        if (game.player && game.player.alive) {
            const dx = (game.player.x + game.player.width / 2) - bx;
            const dy = (game.player.y + game.player.height / 2) - by;
            const angle = Math.atan2(dy, dx);
            const speed = 2.5;
            game.entities.push(new EnemyBullet(bx, by, Math.cos(angle) * speed, Math.sin(angle) * speed));
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new HomingPodEnemy(game, x, y, bType);
    }
}

/**
 * 4. BeamCruiser: 高耐久・拡散弾放射の中型巡洋艦
 */
export class BeamCruiserEnemy extends Enemy {
    get imageName() { return "enemy_beam_cruiser.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 8); // HP = 8
        this.width = 80;
        this.height = 48;
        this.speedY = 0.4;
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;
        this.y += this.speedY;

        const interval = Math.max(1, Math.floor(40 / this.fireRateMultiplier));
        if (this.timer % interval === 0) {
            this.bulletType = 'triple';
            this.shoot(game);
        }
    }

    static create(game, x, y, bType, data = {}) {
        const enemy = new BeamCruiserEnemy(game, x, y, bType);
        if (data.hp) enemy.hp = data.hp;
        return enemy;
    }
}

/**
 * 5. BurnerDrone: 画面下部から上昇しながら弾を突き上げるバーナー機
 */
export class BurnerDroneEnemy extends Enemy {
    get imageName() { return "enemy_burner_drone.webp"; }

    constructor(game, x, y, bulletType) {
        const startY = game.height + 32;
        super(game, x, startY, bulletType, 3); // HP = 3
        this.speedY = -1.8;
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;
        this.y += this.speedY;

        const interval = Math.max(1, Math.floor(20 / this.fireRateMultiplier));
        if (this.timer % interval === 0) {
            const bx = this.x + this.width / 2;
            const by = this.y;
            game.entities.push(new EnemyBullet(bx, by, 0, -4.0));
        }

        if (this.y < -50) {
            this.active = false;
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new BurnerDroneEnemy(game, x, y, bType);
    }
}


// ==========================================
// 2. STAGE-6 ボス実体
// ==========================================

/**
 * STAGE-6 ボス: 超巨大空中戦艦（Burning Dread / BossEnemy_06）
 */
export class BossEnemy_06 extends BossEnemy {
    get imageName() { return "enemy_boss_06.webp"; }

    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        // 初期出現Y座標を画面上部外（-180）に設定
        super(game, x, -180, hp, timeLimit, timeMultiplier);
        
        this.isBoss = true;
        this.maxHp = hp; // maxHp を確実に設定
        this.width = 240;
        this.height = 140;
        this.hitWidth = 200;
        this.hitHeight = 100;

        this.state = 'APPEAR';
        this.timer = 0;
        this.baseX = x - (this.width / 2); // 機体中央を合わせる基準座標
        this.x = this.baseX;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.4;
                if (this.y >= 20) {
                    this.state = 'HEAVY_BOMBARD';
                    this.timer = 0;
                }
                break;

            case 'HEAVY_BOMBARD':
                this.x = this.baseX + Math.sin(this.timer * 0.1) * 15;

                if (this.timer % 30 === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }

                // HP30%以下で過熱発狂モードへ
                if (this.hp < this.maxHp * 0.3) {
                    this.state = 'OVERDRIVE';
                    this.timer = 0;
                }
                break;

            case 'OVERDRIVE':
                this.x = this.baseX + Math.sin(this.timer * 0.2) * 30;

                if (this.timer % 12 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                if (this.timer % 20 === 0) {
                    this.bulletType = 'straight';
                    this.shoot(game);
                }
                break;
        }
    }

    draw(ctx) {
        ctx.save();
        if (this.state === 'OVERDRIVE') {
            ctx.filter = 'saturate(3) contrast(1.5) brightness(1.3)';
        }
        super.draw(ctx);
        ctx.restore();
    }

    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_06(
            game, x, y, 
            data.hp || 120, 
            data.timeLimit || 1800, 
            data.timeMultiplier || 100
        );
    }
}


// ==========================================
// 3. ENEMY_REGISTRY への自動登録
// ==========================================

ENEMY_REGISTRY.set('orbit_interceptor', OrbitInterceptorEnemy);
ENEMY_REGISTRY.set('heat_armor', HeatArmorEnemy);
ENEMY_REGISTRY.set('homing_pod', HomingPodEnemy);
ENEMY_REGISTRY.set('beam_cruiser', BeamCruiserEnemy);
ENEMY_REGISTRY.set('burner_drone', BurnerDroneEnemy);
ENEMY_REGISTRY.set('boss_06', BossEnemy_06);