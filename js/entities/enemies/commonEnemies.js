/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/commonEnemies.js - 全ステージ共通・汎用敵クラス群
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
"use strict";

import { Enemy, EnemyBullet, ENEMY_REGISTRY } from '../enemy.js';

// ==========================================
// 1. 定番・基本行動タイプ
// ==========================================

/**
 * StraightEnemy: 直進型。毎フレーム等速直線運動を行う最も基本的な敵
 */
export class StraightEnemy extends Enemy {
    static DEFAULT_SPEED = 2.5;

    get imageName() { return "enemy_straight.webp"; }
    
    constructor(game, x, y, bulletType, hp = 1) {
        super(game, x, y, bulletType, hp);
        this.speed = StraightEnemy.DEFAULT_SPEED; 
    }

    update(game) {
        if (!this.active) return;

        // 直進移動
        this.y += this.speed;

        // 射撃判定
        const isInFiringRange = this.y > 20 && this.y < 475;
        if (isInFiringRange) {
            this.shootTimer++;
            const currentInterval = this.baseShootInterval / this.fireRateMultiplier;
            if (this.shootTimer >= currentInterval) {
                this.shoot(game);
                this.shootTimer = 0;
            }
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new StraightEnemy(game, x, y, bType, data.hp ?? 1);
    }
}


/**
 * SineEnemy: サイン波移動型。横揺れしながら降下する
 */
export class SineEnemy extends Enemy {
    static DEFAULT_AMPLITUDE = 50;
    static DEFAULT_FREQUENCY = 0.05;

    get imageName() { return "enemy_sine.webp"; }

    constructor(game, x, y, bulletType, phase = 0) {
        super(game, x, y, bulletType, 1);
        this.baseX = x;
        this.phase = phase;
        this.amplitude = SineEnemy.DEFAULT_AMPLITUDE;
        this.frequency = SineEnemy.DEFAULT_FREQUENCY;
        this.speedY = 2.0;
    }

    update(game) {
        if (!this.active) return;

        // サイン波移動
        this.y += this.speedY;
        this.x = this.baseX + Math.sin(this.phase) * this.amplitude;
        this.phase += this.frequency;

        // 射撃判定
        const isInFiringRange = this.y > 20 && this.y < 475;
        if (isInFiringRange) {
            this.shootTimer++;
            const currentInterval = this.baseShootInterval / this.fireRateMultiplier;
            if (this.shootTimer >= currentInterval) {
                this.shoot(game);
                this.shootTimer = 0;
            }
        }
    }

    static create(game, x, y, bType, data = {}) {
        const enemy = new SineEnemy(game, x, y, bType, data.phase ?? 0);
        if (data.amplitude !== undefined) enemy.amplitude = data.amplitude;
        if (data.frequency !== undefined) enemy.frequency = data.frequency;
        return enemy;
    }
}


/**
 * StationaryEnemy: 画面内の指定位置まで降りて静止し、弾を撒いて去っていく設置型
 */
export class StationaryEnemy extends Enemy {
    static DEFAULT_STOP_Y = 100;
    static DEFAULT_WAIT_TIME = 120;

    get imageName() { return "enemy_stationary.webp"; }

    constructor(game, x, y, bulletType, hp = 1, stopY = StationaryEnemy.DEFAULT_STOP_Y, waitTime = StationaryEnemy.DEFAULT_WAIT_TIME) {
        super(game, x, y, bulletType, hp);
        this.baseX = x;
        this.stopY = stopY;
        this.waitTime = waitTime;
        this.stateTimer = 0;
        this.state = 'MOVE_IN';
        this.baseShootInterval = 30; // 設置型のデフォルト発射間隔
    }

    update(game) {
        if (!this.active) return;

        // 状態別移動ロジック
        switch (this.state) {
            case 'MOVE_IN':
                this.y += 2;
                if (this.y >= this.stopY) this.state = 'STOP';
                break;

            case 'STOP':
                this.stateTimer++;
                this.x = this.baseX + Math.sin(this.stateTimer * 0.2) * 2;

                // 静止中のみ射撃タイマー更新
                this.shootTimer++;
                const currentInterval = this.baseShootInterval / this.fireRateMultiplier;
                if (this.shootTimer >= currentInterval) {
                    this.shoot(game);
                    this.shootTimer = 0;
                }

                // 待機時間が終わったら撤退状態へ
                if (this.stateTimer >= this.waitTime) {
                    this.state = 'MOVE_OUT';
                }
                break;

            case 'MOVE_OUT':
                this.y -= 3;
                break;
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new StationaryEnemy(
            game, x, y, bType, 
            data.hp ?? 1, 
            data.stopY ?? StationaryEnemy.DEFAULT_STOP_Y, 
            data.waitTime ?? StationaryEnemy.DEFAULT_WAIT_TIME
        );
    }
}


/**
 * AssaultEnemy: 直進後、自機の高度に合わせて急激に軌道修正して体当たりを狙う突撃型
 */
export class AssaultEnemy extends Enemy {
    static CHARGE_SPEED = 6.5;

    get imageName() { return "enemy_assault.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 1);
        this.state = 'FALL';
        this.vx = 0;
        this.vy = 3.0;
    }

    update(game) {
        if (!this.active) return;

        this.x += this.vx;
        this.y += this.vy;

        // 自機の位置に合わせて突撃開始
        if (this.state === 'FALL' && game?.player?.alive) {
            if (this.y >= game.player.y - 150) {
                this.state = 'CHARGE';
                const dx = game.player.x - this.x;
                const dy = game.player.y - this.y;
                const dist = Math.hypot(dx, dy) || 1;
                
                this.vx = (dx / dist) * AssaultEnemy.CHARGE_SPEED; 
                this.vy = (dy / dist) * AssaultEnemy.CHARGE_SPEED;
                
                game.sc?.audio?.playHitSound?.(); 
            }
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new AssaultEnemy(game, x, y, bType);
    }
}


/**
 * HunterEnemy: 執拗に自機のX座標を追従しながら降下してくるハンター型
 */
export class HunterEnemy extends Enemy {
    get imageName() { return "enemy_hunter.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); 
        this.speedY = 1.0; 
        this.speedX = 1.5; 
        this.baseShootInterval = 80;
    }

    update(game) {
        if (!this.active) return;

        this.y += this.speedY;

        // X軸追従
        if (game?.player?.alive) {
            const targetX = game.player.x;
            if (this.x < targetX) {
                this.x = Math.min(this.x + this.speedX, targetX);
            } else if (this.x > targetX) {
                this.x = Math.max(this.x - this.speedX, targetX);
            }
        }

        // 射撃処理
        const isInFiringRange = this.y > 20 && this.y < 475;
        if (isInFiringRange) {
            this.shootTimer++;
            const currentInterval = this.baseShootInterval / this.fireRateMultiplier;
            if (this.shootTimer >= currentInterval) {
                this.shoot(game);
                this.shootTimer = 0;
            }
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new HunterEnemy(game, x, y, bType);
    }
}


/**
 * ShieldEnemy: 高耐久の盾。正面から弾を受けると「撃ち返し（カウンター）」を発生させる
 */
export class ShieldEnemy extends Enemy {
    get imageName() { return "enemy_shield.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 5); 
        this.speedY = 0.6; 
    }

    update(game) {
        if (!this.active) return;
        this.y += this.speedY;
    }

    takeDamage(amount) {
        const isDead = super.takeDamage(amount);
        // ダメージを受けるたびにカウンター弾発射
        if (!isDead && this.game) {
            this.game.entities.push(
                new EnemyBullet(this.x + this.width / 2, this.y + this.height, 0, 3)
            );
        }
        return isDead;
    }

    static create(game, x, y, bType, data = {}) {
        return new ShieldEnemy(game, x, y, bType);
    }
}


/**
 * ScoutEnemy: 画面外からUの字を描いて索敵し、弾を撒いて上部へ去っていく偵察型
 */
export class ScoutEnemy extends Enemy {
    get imageName() { return "enemy_scout.webp"; }

    constructor(game, x, y, bulletType, isLeftToRight = true) {
        super(game, x, y, bulletType, 1);
        this.timer = 0;
        this.isLeft = isLeftToRight;
        this.x = isLeftToRight ? -32 : (game?.width ?? 640) + 32; 
        this.y = 80;
        this.hasShot = false;
    }

    update(game) {
        if (!this.active) return;

        this.timer += 0.04;
        this.x += this.isLeft ? 3.5 : -3.5;
        this.y = 80 + Math.sin(this.timer) * 120;

        // U字最下点付近で1回だけ射撃
        if (Math.abs(this.timer - Math.PI / 2) < 0.05 && !this.hasShot) {
            this.shoot(game); 
            this.hasShot = true;
        }
    }

    static create(game, x, y, bType, data = {}) {
        const isLeft = data.isLeft ?? true;
        return new ScoutEnemy(game, x, y, bType, isLeft);
    }
}


// ==========================================
// 2. 特殊ギミック・環境障害物タイプ
// ==========================================

/**
 * RockEnemy: 超高速で垂直落下してくるデブリ・岩石型トラップ
 */
export class RockEnemy extends Enemy {
    static DEFAULT_SPEED_Y = 6.0;

    get imageName() { return "enemy_rock.webp"; }

    constructor(game, x, y, bulletType, speedY = RockEnemy.DEFAULT_SPEED_Y) {
        super(game, x, y, 'none', 1);
        this.speedY = speedY;
    }

    update(game) {
        if (!this.active) return;
        this.y += this.speedY;
    }

    static create(game, x, y, bType, data = {}) {
        return new RockEnemy(game, x, y, bType, data.speedY ?? RockEnemy.DEFAULT_SPEED_Y);
    }
}


/**
 * MineDebrisEnemy: 完全無敵の浮遊障害物（破壊不可）
 */
export class MineDebrisEnemy extends Enemy {
    static DEFAULT_SPEED_Y = 1.2;

    get imageName() { return "enemy_mine_debris.webp"; }

    constructor(game, x, y, bulletType, speedY = MineDebrisEnemy.DEFAULT_SPEED_Y) {
        super(game, x, y, 'none', Infinity);
        this.speedY = speedY;
    }

    update(game) {
        if (!this.active) return;
        this.y += this.speedY;
    }

    takeDamage(_amount) {
        // 完全無敵
        return false;
    }

    static create(game, x, y, bType, data = {}) {
        return new MineDebrisEnemy(game, x, y, bType, data.speedY ?? MineDebrisEnemy.DEFAULT_SPEED_Y);
    }
}


/**
 * WormSegment: 連結エネミー（多関節）の胴体パーツ
 */
export class WormSegment extends Enemy {
    static SEGMENT_SPACING = 24;

    get imageName() {
        return this.isTail ? "enemy_worm_tail.webp" : "enemy_worm_body.webp";
    }

    constructor(game, head, index, isTail = false) {
        super(game, head.x, head.y - index * WormSegment.SEGMENT_SPACING, 'none', 1);
        this.head = head;
        this.index = index;
        this.isTail = isTail;
    }

    update(game) {
        if (!this.active) return;

        if (this.head?.active) {
            this.y = this.head.y - (this.index * WormSegment.SEGMENT_SPACING);
            this.x = this.head.x;
        } else {
            this.active = false;
        }
    }

    takeDamage(amount) {
        const isDead = super.takeDamage(amount);
        if (isDead && this.head) {
            this.head.removeSegment(this);
        }
        return isDead;
    }

    forceDestroy() {
        this.active = false;
        this.onDie(this.game, true);
    }
}


/**
 * WormEnemy: 連結エネミー（頭部）
 */
export class WormEnemy extends Enemy {
    static DEFAULT_LENGTH = 5;

    get imageName() { return "enemy_worm_head.webp"; }

    constructor(game, x, y, bulletType, length = WormEnemy.DEFAULT_LENGTH) {
        super(game, x, y, bulletType, 1);
        this.speedY = 1.0;
        this.segments = [];

        if (game?.entities) {
            for (let i = 1; i < length; i++) {
                const isTail = (i === length - 1);
                const seg = new WormSegment(game, this, i, isTail);
                this.segments.push(seg);
                game.entities.push(seg);
            }
        }
    }

    update(game) {
        if (!this.active) return;
        this.y += this.speedY;
    }

    removeSegment(seg) {
        const idx = this.segments.indexOf(seg);
        if (idx !== -1) {
            this.segments.splice(idx, 1);
            this.segments.forEach((s, i) => {
                s.index = i + 1;
            });
        }
    }

    takeDamage(amount) {
        const isDead = super.takeDamage(amount);
        if (isDead) {
            this.segments.forEach((seg, i) => {
                setTimeout(() => {
                    seg.forceDestroy();
                }, (i + 1) * 80);
            });
        }
        return isDead;
    }

    static create(game, x, y, bType, data = {}) {
        return new WormEnemy(game, x, y, bType, data.length ?? WormEnemy.DEFAULT_LENGTH);
    }
}


// ==========================================
// 3. ENEMY_REGISTRY への動的自動登録
// ==========================================
ENEMY_REGISTRY.set('straight', StraightEnemy);
ENEMY_REGISTRY.set('sine', SineEnemy);
ENEMY_REGISTRY.set('stationary', StationaryEnemy);
ENEMY_REGISTRY.set('assault', AssaultEnemy);
ENEMY_REGISTRY.set('hunter', HunterEnemy);
ENEMY_REGISTRY.set('shield', ShieldEnemy);
ENEMY_REGISTRY.set('scout', ScoutEnemy);
ENEMY_REGISTRY.set('rock', RockEnemy);
ENEMY_REGISTRY.set('debris', MineDebrisEnemy);
ENEMY_REGISTRY.set('worm', WormEnemy);
