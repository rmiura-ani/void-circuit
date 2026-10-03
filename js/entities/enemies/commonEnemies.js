/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/commonEnemies.js - 全ステージ共通・汎用敵クラス群
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import { Enemy, EnemyBullet, ENEMY_REGISTRY } from '../enemy.js';

// ==========================================
// 1. 定番・基本行動タイプ
// ==========================================

/**
 * StraightEnemy: 直進型。毎フレーム等速直線運動を行う最も基本的な敵
 */
export class StraightEnemy extends Enemy {
    speed = 2.5;

    get imageName() { return "enemy_straight.webp"; }

    update(game) {
        if (!this.active) return;

        // 直進移動
        this.y += this.speed;

        // 射撃判定含む基本更新
        super.update(game);
    }

    static create(game, bType, hp, data = {}) {
        return new StraightEnemy(game, bType, hp);
    }
}


/**
 * SineEnemy: サイン波移動型。横揺れしながら降下する
 */
export class SineEnemy extends Enemy {
    phase = 0;
    amplitude = 50;
    frequency = 0.05;
    speedY = 2.0;

    get imageName() { return "enemy_sine.webp"; }

    update(game) {
        if (!this.active) return;

        // サイン波移動 (setStartPosition で記憶した startX を基準に揺らす)
        this.y += this.speedY;
        this.x = this.startX + Math.sin(this.phase) * this.amplitude;
        this.phase += this.frequency;

        super.update(game);
    }

    static create(game, bType, hp, data = {}) {
        const enemy = new SineEnemy(game, bType, hp);
        if (data.phase !== undefined) enemy.phase = data.phase;
        if (data.amplitude !== undefined) enemy.amplitude = data.amplitude;
        if (data.frequency !== undefined) enemy.frequency = data.frequency;
        return enemy;
    }
}


/**
 * ScoutEnemy: 画面外からUの字を描いて索敵し、弾を撒いて上部へ去っていく偵察型
 */
export class ScoutEnemy extends Enemy {
    timer = 0;
    isLeft = true;
    hasShot = false;

    get imageName() { return "enemy_scout.webp"; }

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

        super.update(game);
    }

    static create(game, bType, hp, data = {}) {
        const enemy = new ScoutEnemy(game, bType, hp);
        
        // from の指定から侵入方向を判定 ("right" 以外は isLeft = true)
        enemy.isLeft = String(data.from || 'left').toLowerCase() !== 'right';

        return enemy;
    }
}


/**
 * StationaryEnemy: 画面内の指定位置まで降りて静止し、弾を撒いて去っていく設置型
 */
export class StationaryEnemy extends Enemy {
    stopY = 100;
    waitTime = 120;
    stateTimer = 0;
    state = 'MOVE_IN';

    get imageName() { return "enemy_stationary.webp"; }

    constructor(game, bulletType = 'aim', hp = 1) {
        super(game, bulletType, hp);
        this.baseShootInterval = 30;
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'MOVE_IN':
                this.y += 2;
                if (this.y >= this.stopY) {
                    this.state = 'STOP';
                }
                break;

            case 'STOP':
                this.stateTimer++;
                // 記憶された startX をベースに細かく横揺れ
                this.x = this.startX + Math.sin(this.stateTimer * 0.2) * 2;

                // 🎯 親クラスの自動射撃カウンター＆発射処理に一任！
                super.update(game);

                if (this.stateTimer >= this.waitTime) {
                    this.state = 'MOVE_OUT';
                }
                break;

            case 'MOVE_OUT':
                this.y -= 3;
                break;
        }
    }

    static create(game, bType, hp, data = {}) {
        const enemy = new StationaryEnemy(game, bType, hp);
        if (data.stopY !== undefined) enemy.stopY = data.stopY;
        if (data.waitTime !== undefined) enemy.waitTime = data.waitTime;
        return enemy;
    }
}


/**
 * AssaultEnemy: 直進後、自機の高度に合わせて急激に軌道修正して体当たりを狙う突撃型
 */
export class AssaultEnemy extends Enemy {
    static CHARGE_SPEED = 6.5;

    state = 'FALL';
    vx = 0;
    vy = 3.0;

    get imageName() { return "enemy_assault.webp"; }

    update(game) {
        if (!this.active) return;

        this.x += this.vx;
        this.y += this.vy;

        if (this.state === 'FALL' && game?.player?.alive) {
            if (this.y >= game.player.y - 150) {
                this.state = 'CHARGE';
                const dx = game.player.x - this.x;
                const dy = game.player.y - this.y;
                const dist = Math.hypot(dx, dy) || 1;
                
                this.vx = (dx / dist) * AssaultEnemy.CHARGE_SPEED; 
                this.vy = (dy / dist) * AssaultEnemy.CHARGE_SPEED;
            }
        }
    }

    static create(game, bType, hp, data = {}) {
        return new AssaultEnemy(game, bType, hp);
    }
}


/**
 * HunterEnemy: 執拗に自機のX座標を追従しながら降下してくるハンター型
 */
export class HunterEnemy extends Enemy {
    speedY = 1.0;
    speedX = 1.5;

    get imageName() { return "enemy_hunter.webp"; }

    constructor(game, bulletType = 'aim', hp = 2) {
        super(game, bulletType, hp); 
        this.baseShootInterval = 80;
    }

    update(game) {
        if (!this.active) return;

        this.y += this.speedY;

        if (game?.player?.alive) {
            const targetX = game.player.x;
            if (this.x < targetX) {
                this.x = Math.min(this.x + this.speedX, targetX);
            } else if (this.x > targetX) {
                this.x = Math.max(this.x - this.speedX, targetX);
            }
        }

        // 親クラスの update で画面内判定＆射撃タイマー処理を行う
        super.update(game);
    }

    static create(game, bType, hp, data = {}) {
        return new HunterEnemy(game, bType, hp);
    }
}


/**
 * ShieldEnemy: 高耐久の盾。正面から弾を受けると「撃ち返し（カウンター）」を発生させる
 */
export class ShieldEnemy extends Enemy {
    speedY = 0.6;

    get imageName() { return "enemy_shield.webp"; }

    constructor(game, bulletType = 'aim', hp = 5) {
        super(game, bulletType, hp);
    }

    update(game) {
        if (!this.active) return;
        this.y += this.speedY;
    }

    takeDamage(game, amount) {
        const isDead = super.takeDamage(game, amount);
        if (!isDead && game) {
            game.entities.push(
                new EnemyBullet(this.x + this.width / 2, this.y + this.height, 0, 3)
            );
        }
        return isDead;
    }

    static create(game, bType, hp, data = {}) {
        return new ShieldEnemy(game, bType, hp);
    }
}


/**
 * GaleArtilleryEnemy: 画面上部に陣取り、強風を発生させる固定砲台
 */
export class GaleArtilleryEnemy extends Enemy {
    stopY = 40;
    timer = 0;
    state = 'MOVE_IN';

    get imageName() { return "enemy_gale_artillery.webp"; }

    constructor(game, bulletType = 'triple', hp = 4) {
        super(game, bulletType, hp);
        this.width = 160;
        this.height = (155 / 291) * 160;
        this.baseShootInterval = 45;
        this.windDirection = game.random.next() < 0.5 ? 1 : -1;

        this.windParticles = Array.from({ length: 15 }, () => ({
            x: game.random.range(0, game.width),
            y: game.random.range(0, game.height),
            length: game.random.range(20, 60),
            speed: game.random.range(6, 12)
        }));
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

                if (game.player && game.player.alive) {
                    const windPower = (Math.sin(this.timer * 0.08) * 0.8 + 1.2); 
                    game.player.windForceX = this.windDirection * windPower;
                }

                // 🎯 親クラスの自動射撃カウンター＆発射処理を実行
                super.update(game);

                if (this.timer >= 150) {
                    this.state = 'RETREAT';
                }
                break;

            case 'RETREAT':
                this.y -= 3.0;
                break;
        }
    }

    draw(ctx, isDebug = false) {
        super.draw(ctx, isDebug);

        if (this.state === 'BLOW_GALE') {
            ctx.save();
            ctx.strokeStyle = 'rgba(200, 255, 255, 0.4)';
            ctx.lineWidth = 1.5;

            const gameWidth = ctx.canvas.width;

            for (const p of this.windParticles) {
                p.x += this.windDirection * p.speed;

                if (this.windDirection > 0 && p.x > gameWidth) p.x = -p.length;
                if (this.windDirection < 0 && p.x < -p.length) p.x = gameWidth;

                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + (this.windDirection * p.length), p.y);
                ctx.stroke();
            }
            ctx.restore();
        }
    }   

    static create(game, bType, hp, data = {}) {
        const enemy = new GaleArtilleryEnemy(game, bType, hp);
        if (data.stopY !== undefined) enemy.stopY = data.stopY;
        return enemy;
    }
}

// ==========================================
// 2. ENEMY_REGISTRY への動的自動登録
// ==========================================
ENEMY_REGISTRY.set('straight', StraightEnemy);
ENEMY_REGISTRY.set('sine', SineEnemy);
ENEMY_REGISTRY.set('scout', ScoutEnemy);
ENEMY_REGISTRY.set('stationary', StationaryEnemy);
ENEMY_REGISTRY.set('assault', AssaultEnemy);
ENEMY_REGISTRY.set('hunter', HunterEnemy);
ENEMY_REGISTRY.set('shield', ShieldEnemy);
ENEMY_REGISTRY.set('gale_artillery', GaleArtilleryEnemy);