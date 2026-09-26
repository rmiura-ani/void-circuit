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
 * ScoutEnemy: 画面外からUの字を描いて索敵し、弾を撒いて上部へ去っていく偵察型
 */
export class ScoutEnemy extends Enemy {
    get imageName() { return "enemy_scout.webp"; }

    constructor(game, x, y, bulletType, isLeft = true) {
        super(game, x, y, bulletType, 1);
        this.timer = 0;
        this.isLeft = isLeft;
        this.x = isLeft ? -32 : (game?.width ?? 640) + 32; 
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


/**
 * StationaryEnemy: 画面内の指定位置まで降りて静止し、弾を撒いて去っていく設置型
 */
export class StationaryEnemy extends Enemy {
    static DEFAULT_STOP_Y = 100;
    static DEFAULT_WAIT_TIME = 120;

    get imageName() { return "enemy_stationary.webp"; }

    constructor(game, x, y, bulletType, hp = 1, stopY = StationaryEnemy.DEFAULT_STOP_Y, waitTime = StationaryEnemy.DEFAULT_WAIT_TIME) {
        super(game, x, y, bulletType, hp);
        this.baseX = x; // 🎯 画面生成時点での初期X座標
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
                // MOVE_IN から STOP に切り替わる瞬間に、補正済みの this.x を baseX として再記憶する
                if (this.y >= this.stopY) {
                    this.state = 'STOP';
                    this.baseX = this.x; // 👈 🎯 これを追加！spawnEnemyで補正された後の位置をベースにする
                }
                break;

            case 'STOP':
                this.stateTimer++;
                // baseX を基準に揺らす（これで補正位置からズレなくなる）
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
 * GaleArtillery: 画面上部に陣取り、強風（自機を横へ押し流す風圧効果）を発生させる固定砲台
 */
export class GaleArtilleryEnemy extends Enemy {
    get imageName() { return "enemy_gale_artillery.webp"; }

    constructor(game, x, y, bulletType, stopY = 80) {
        super(game, x, y, bulletType, 4); // HP = 4
        this.width = 160;
        this.height = (155 / 291) * 160;
        this.stopY = stopY;
        this.timer = 0;
        this.state = 'MOVE_IN';
        this.windDirection = Math.random() < 0.5 ? 1 : -1; // 左吹きか右吹きか

        this.windParticles = Array.from({ length: 15 }, () => ({
            x: Math.random() * game.width,
            y: Math.random() * game.height,
            length: 20 + Math.random() * 40, // 線の長さ
            speed: 6 + Math.random() * 6     // 風のスピード
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

                // 🌪️ 風圧を自機へ「外部の力」として加える
                if (game.player && game.player.alive) {
                    // マウス操作でも流されるよう、風圧の強さを少し高め（例: 1.5〜2.0程度）に設定
                    const windPower = (Math.sin(this.timer * 0.08) * 0.8 + 1.2); 
                    game.player.windForceX = this.windDirection * windPower;
                }

                if (this.timer % Math.floor(45 / this.fireRateMultiplier) === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }

                if (this.timer >= 150) {
                    this.state = 'RETREAT';
                }
                break;

            case 'RETREAT':
                this.y -= 3.0;
                break;
        }
    }

    draw(ctx) {
        super.draw(ctx); // 本体描画

        // 🌪️ 風を吹かせている状態の時だけ風圧ラインを描画
        if (this.state === 'BLOW_GALE') {
            ctx.save();
            ctx.strokeStyle = 'rgba(200, 255, 255, 0.4)'; // うっすら光る水色/白
            ctx.lineWidth = 1.5;

            // 💡 ctx.canvas から画面幅を取得
            const gameWidth = ctx.canvas.width;

            for (const p of this.windParticles) {
                // 風の向きに合わせてパーティクルを移動
                p.x += this.windDirection * p.speed;

                // 画面外に出たら反対側からリスポーン（game.width / this.gamewidth を置き換え）
                if (this.windDirection > 0 && p.x > gameWidth) p.x = -p.length;
                if (this.windDirection < 0 && p.x < -p.length) p.x = gameWidth;

                // 描画（風の流れを表す横線）
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + (this.windDirection * p.length), p.y);
                ctx.stroke();
            }
            ctx.restore();
        }
    }   
    static create(game, x, y, bType, data = {}) {
        return new GaleArtilleryEnemy(game, x, y, bType, data.stopY || 80);
    }
}

// ==========================================
// 3. ENEMY_REGISTRY への動的自動登録
// ==========================================
ENEMY_REGISTRY.set('straight', StraightEnemy);
ENEMY_REGISTRY.set('sine', SineEnemy);
ENEMY_REGISTRY.set('scout', ScoutEnemy);
ENEMY_REGISTRY.set('stationary', StationaryEnemy);
ENEMY_REGISTRY.set('assault', AssaultEnemy);
ENEMY_REGISTRY.set('hunter', HunterEnemy);
ENEMY_REGISTRY.set('shield', ShieldEnemy);
ENEMY_REGISTRY.set('gale_artillery', GaleArtilleryEnemy);
