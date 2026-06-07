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

// === 1. すべての敵の基底クラス ===
class BaseEnemy {
  constructor(x, y, config = {}) {
    this.x = x;
    this.y = y;
    this.hp = config.hp || 1;
    this.maxHp = this.hp;
    this.isDead = false;
    this.frame = 0;
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.isDead = true;
      this.onDestroy();
    }
  }

  onDestroy() {
    // 爆発エフェクト等の共通処理
  }
}
// ==========================================
// 1. 定番・基本行動タイプ
// ==========================================

/**
 * StraightEnemy: 直進型。毎フレーム等速直線運動を行う最も基本的な敵
 */
class StraightEnemy extends Enemy {
    get imageName() { return "enemy_straight.webp"; }
    
    constructor(game, x, y, bulletType, hp = 1) {
        super(game, x, y, bulletType, hp);
        this.speed = 2.5; 
    }

    static create(game, x, y, bType, data) {
        return new StraightEnemy(game, x, y, bType, data.hp || 1);
    }
}

/**
 * SineEnemy: サイン波移動型。横揺れしながら降下する
 */
class SineEnemy extends Enemy {
    get imageName() { return "enemy_sine.webp"; }

    constructor(game, x, y, bulletType, phase = 0) {
        super(game, x, y, bulletType, 1);
        this.baseX = x;
        this.phase = phase;
        this.amplitude = 50;
        this.frequency = 0.05;
    }

    update(game) {
        super.update(game);
        this.x = this.baseX + Math.sin(this.phase) * this.amplitude;
        this.phase += this.frequency;
    }

    static create(game, x, y, bType, data) {
        const enemy = new SineEnemy(game, x, y, bType, data.phase || 0);
        if (data.amplitude) enemy.amplitude = data.amplitude;
        if (data.frequency) enemy.frequency = data.frequency;
        return enemy;
    }
}

/**
 * StationaryEnemy: 画面内の指定位置まで降りて静止し、弾を撒いて去っていく設置型
 */
class StationaryEnemy extends Enemy {
    get imageName() { return "enemy_stationary.webp"; }

    constructor(game, x, y, bulletType, hp = 1, stopY = 100, waitTime = 120) {
        super(game, x, y, bulletType, hp);
        this.baseX = x;
        this.stopY = stopY;
        this.waitTime = waitTime;
        this.timer = 0;
        this.state = 'MOVE_IN';
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'MOVE_IN':
                this.y += 2;
                if (this.y >= this.stopY) this.state = 'STOP';
                break;

            case 'STOP':
                this.timer++;
                this.x = this.baseX + Math.sin(this.timer * 0.2) * 2;

                const interval = Math.max(10, 30 / this.fireRateMultiplier);
                if (this.timer % Math.floor(interval) === 0) this.shoot(game);

                if (this.timer >= this.waitTime) this.state = 'MOVE_OUT';
                break;

            case 'MOVE_OUT':
                this.y -= 3;
                if (this.isOutOfBounds(50, true)) this.active = false;
                break;
        }
    }

    static create(game, x, y, bType, data) {
        return new StationaryEnemy(
            game, x, y, bType, 
            data.hp || 1, 
            data.stopY || 100, 
            data.waitTime || 120
        );
    }
}

/**
 * AssaultEnemy: 直進後、自機の高度に合わせて急激に軌道修正して体当たりを狙う突撃型
 */
class AssaultEnemy extends Enemy {
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

        if (this.state === 'FALL' && game.player && game.player.alive) {
            if (this.y >= game.player.y - 150) {
                this.state = 'CHARGE';
                const dx = game.player.x - this.x;
                const dy = game.player.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                this.vx = (dx / dist) * 6.5; 
                this.vy = (dy / dist) * 6.5;
                if (game.sc && game.sc.audio) game.sc.audio.playHitSound(); 
            }
        }

        if (this.y > game.height + 50 || this.x < -50 || this.x > game.width + 50) {
            this.active = false;
        }
    }

    static create(game, x, y, bType, data) {
        return new AssaultEnemy(game, x, y, bType);
    }
}

/**
 * HunterEnemy: 執拗に自機のX座標を追従しながら降下してくるハンター型
 */
class HunterEnemy extends Enemy {
    get imageName() { return "enemy_hunter.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); 
        this.speedY = 1.0; 
        this.speedX = 1.5; 
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += this.speedY;

        if (game.player && game.player.alive) {
            const targetX = game.player.x;
            if (this.x < targetX) this.x += this.speedX;
            else if (this.x > targetX) this.x -= this.speedX;
        }

        if (this.timer % 80 === 0) {
            this.shoot(game);
        }

        if (this.y > game.height + 50) this.active = false;
    }

    static create(game, x, y, bType, data) {
        return new HunterEnemy(game, x, y, bType);
    }
}

/**
 * ShieldEnemy: 高耐久の盾。正面から弾を受けると「撃ち返し（カウンター）」を発生させる
 */
class ShieldEnemy extends Enemy {
    get imageName() { return "enemy_shield.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 5); 
        this.speedY = 0.6; 
    }

    takeDamage(amount) {
        const isDead = super.takeDamage(amount);
        if (!isDead && this.game) {
            if (typeof EnemyBullet !== 'undefined') {
                this.game.entities.push(new EnemyBullet(this.x + this.width/2, this.y + this.height, 0, 3));
            }
        }
        return isDead;
    }

    static create(game, x, y, bType, data) {
        return new ShieldEnemy(game, x, y, bType);
    }
}

/**
 * ScoutEnemy: 画面外からUの字を描いて索敵し、弾を撒いて上部へ去っていく偵察型
 */
class ScoutEnemy extends Enemy {
    get imageName() { return "enemy_scout.webp"; }

    constructor(game, x, y, bulletType, isLeftToRight = true) {
        super(game, x, y, bulletType, 1);
        this.timer = 0;
        this.isLeft = isLeftToRight;
        this.x = isLeftToRight ? -32 : game.width + 32; 
        this.y = 80;
        this.hasShot = false;
    }

    update(game) {
        if (!this.active) return;
        this.timer += 0.04;

        if (this.isLeft) {
            this.x += 3.5;
        } else {
            this.x -= 3.5;
        }
        this.y = 80 + Math.sin(this.timer) * 120;

        if (Math.abs(this.timer - Math.PI / 2) < 0.05 && !this.hasShot) {
            this.shoot(game); 
            this.hasShot = true;
        }

        if (this.x < -60 || this.x > game.width + 60) this.active = false;
    }

    static create(game, x, y, bType, data) {
        const isLeft = data.isLeft !== undefined ? data.isLeft : true;
        return new ScoutEnemy(game, x, y, bType, isLeft);
    }
}


// ==========================================
// 2. 特殊ギミック・環境障害物タイプ
// ==========================================

/**
 * RockEnemy: 超高速で垂直落下してくるデブリ・岩石型トラップ
 */
class RockEnemy extends Enemy {
    get imageName() { return "enemy_rock.webp"; }

    constructor(game, x, y, bulletType, speedY = 6.0) {
        super(game, x, y, 'none', 1);
        this.speedY = speedY;
    }

    update(game) {
        if (!this.active) return;
        this.y += this.speedY;
        if (this.isOutOfBounds(50, true)) this.active = false;
    }

    static create(game, x, y, bType, data) {
        return new RockEnemy(game, x, y, bType, data.speedY || 6.0);
    }
}

/**
 * MineDebrisEnemy: 完全無敵の浮遊障害物（破壊不可）
 */
class MineDebrisEnemy extends Enemy {
    get imageName() { return "enemy_mine_debris.webp"; }

    constructor(game, x, y, bulletType, speedY = 1.2) {
        super(game, x, y, 'none', Infinity);
        this.speedY = speedY;
    }

    update(game) {
        if (!this.active) return;
        this.y += this.speedY;
        if (this.isOutOfBounds(50, true)) this.active = false;
    }

    /** 完全無敵（ダメージ無効化） */
    takeDamage(amount) {
        return false;
    }

    static create(game, x, y, bType, data) {
        return new MineDebrisEnemy(game, x, y, bType, data.speedY || 1.2);
    }
}

/**
 * WormSegment: 連結エネミー（多関節）の胴体パーツ
 */
class WormSegment extends Enemy {
    get imageName() {
        if (this.isTail) return "enemy_worm_tail.webp";
        return "enemy_worm_body.webp";
    }

    constructor(game, head, index, isTail = false) {
        super(game, head.x, head.y - index * 24, 'none', 1);
        this.head = head;
        this.index = index;
        this.isTail = isTail;
    }

    update(game) {
        if (!this.active) return;
        if (this.head && this.head.active) {
            // 親（頭部）のY座標にピッタリ追従
            this.y = this.head.y - (this.index * 24);
            this.x = this.head.x;
        } else {
            this.active = false;
        }
    }

    takeDamage(amount) {
        const isDead = super.takeDamage(amount);
        if (isDead && this.head) {
            // 胴体が壊れたことを頭部へ通知（部位破壊・短縮化）
            this.head.removeSegment(this);
        }
        return isDead;
    }

    /** 親からの連鎖爆破呼び出し */
    forceDestroy() {
        this.active = false;
        this.onDie(this.game, true);
    }
}

/**
 * WormEnemy: 連結エネミー（頭部）。生成時に指定された連結数だけ WormSegment を自動生成する
 */
class WormEnemy extends Enemy {
    get imageName() { return "enemy_worm_head.webp"; }

    constructor(game, x, y, bulletType, length = 5) {
        super(game, x, y, bulletType, 1);
        this.speedY = 1.0;
        this.segments = [];

        // 自動で胴体・尾部パーツを連結生成
        if (game && game.entities) {
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
        if (this.isOutOfBounds(100, true)) this.active = false;
    }

    /** 胴体パーツから部位破壊された際のインデックス詰めに伴う通知 */
    removeSegment(seg) {
        const idx = this.segments.indexOf(seg);
        if (idx !== -1) {
            this.segments.splice(idx, 1);
            // 残ったセグメントの並び順を再計算
            this.segments.forEach((s, i) => {
                s.index = i + 1;
            });
        }
    }

    /** 頭部破壊時：連鎖一括爆破 */
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

    static create(game, x, y, bType, data) {
        return new WormEnemy(game, x, y, bType, data.length || 5);
    }
}


// ==========================================
// 3. ENEMY_REGISTRY への自動登録
// ==========================================

if (typeof ENEMY_REGISTRY !== 'undefined') {
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
} else {
    console.error('[Enemy Registry Error] ENEMY_REGISTRY is not defined. Make sure EnemyBase.js is loaded first.');
}