/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage4Enemies.js - STAGE-4 (Ancient Logic) 固有敵クラス群 & ボス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
"use strict";

import { Enemy, BossEnemy, ENEMY_REGISTRY } from '../enemy.js';

// ==========================================
// 1. STAGE-4 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 1. DustScout: 画面下部（砂塵の中から）逆噴射で「下から上へ」上昇してくる逆スクロール偵察機
 */
export class DustScoutEnemy extends Enemy {
    get imageName() { return "enemy_dust_scout.webp"; }

    constructor(game, bulletType = 'aim', hp = 1) {
        super(game, bulletType, hp);
        this.speedY = -2.5;
        this.hasShot = false;
    }

    setStartPosition(x, y) {
        super.setStartPosition(x, y);
    }    

    update(game) {
        if (!this.active) return;

        this.y += this.speedY;

        if (this.y <= (game?.height || 600) / 2 && !this.hasShot) {
            this.shoot(game);
            this.hasShot = true;
        }

        if (this.y < -50) {
            this.active = false;
        }
    }

    static create(game, bType, hp, data = {}) {
        return new DustScoutEnemy(game, bType, hp);
    }
}

/**
 * 2. RelicPrism: 八角形の古代パーツ。一定位置で静止・回転しながら幾何学的な格子状クロス弾幕を生成
 */
export class RelicPrismEnemy extends Enemy {
    stopY = 120;
    timer = 0;
    rotationAngle = 0;
    state = 'MOVE_IN';

    get imageName() { return "enemy_relic_prism.webp"; }

    constructor(game, bulletType = 'cross', hp = 3) {
        super(game, bulletType, hp);
        this.width = 80;
        this.height = 80;
        this.baseShootInterval = 50;
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'MOVE_IN':
                this.y += 2.0;
                if (this.y >= this.stopY) {
                    this.state = 'ROTATE_FIRE';
                }
                break;

            case 'ROTATE_FIRE':
                this.timer++;
                // 角度を更新（親クラスの shoot() がこの rotationAngle を参照してクロス弾を発射）
                this.rotationAngle += 0.05;

                // 🎯 自動射撃＆画面内判定を親クラスに一任
                super.update(game);

                if (this.timer >= 250) {
                    this.state = 'RETREAT';
                }
                break;

            case 'RETREAT':
                this.y -= 2.0;
                break;
        }
    }

    static create(game, bType, hp, data = {}) {
        const enemy = new RelicPrismEnemy(game, bType, hp);
        if (data.stopY !== undefined) enemy.stopY = data.stopY;
        return enemy;
    }
}

/**
 * 3. MirageCrawler: 砂漠の蜃気楼（ラスタスクロール波形）のようにX軸がブレながらゆっくり降下する機体
 */
export class MirageCrawlerEnemy extends Enemy {
    speedY = 1.0;
    timer = Math.random() * 100;

    get imageName() { return "enemy_mirage_crawler.webp"; }

    constructor(game, bulletType = 'aim', hp = 2) {
        super(game, bulletType, hp);
        this.baseShootInterval = 80;
    }

    update(game) {
        if (!this.active) return;
        this.timer += 0.1;

        this.y += this.speedY;
        this.x = this.startX + Math.sin(this.timer) * 35;

        super.update(game);
    }

    static create(game, bType, hp, data = {}) {
        return new MirageCrawlerEnemy(game, bType, hp);
    }
}

/**
 * 4. SandPillar: 縦長柱状の防壁構造。前面からの通常弾を大幅軽減/跳ね返す無効化ガードを持つ
 */
export class SandPillarEnemy extends Enemy {
    speedY = 0.5;
    hitFlashTimer = 0;

    get imageName() { return "enemy_sand_pillar.webp"; }

    constructor(game, bulletType = 'none', hp = 5) {
        super(game, bulletType, hp);
        this.width = 64;
        this.height = (467 / 394) * 64;
    }

    update(game) {
        if (!this.active) return;

        this.y += this.speedY;

        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer--;
        }
    }

    takeDamage(game, amount) {
        const reducedAmount = Math.max(1, Math.floor(amount * 0.5));
        this.hitFlashTimer = 5;
        return super.takeDamage(game, reducedAmount);
    }

    draw(ctx, isDebug = false) {
        ctx.save();
        if (this.hitFlashTimer > 0) {
            ctx.filter = 'brightness(3.0) contrast(1.5)';
        }
        super.draw(ctx, isDebug);
        ctx.restore();
    }

    static create(game, bType, hp, data = {}) {
        return new SandPillarEnemy(game, bType, hp);
    }
}

/**
 * 5. GigaOrb: エネルギーチャージ（フラッシュ前兆）を行い、直線状に太い弾幕を一気に射出する高耐久コア
 */
export class GigaOrbEnemy extends Enemy {
    state = 'CHARGE';
    timer = 0;

    get imageName() { return "enemy_giga_orb.webp"; }

    constructor(game, bulletType = 'twin', hp = 10) {
        super(game, bulletType, hp);
        this.width = (510 / 440) * 48;
        this.height = 48;
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'CHARGE':
                this.y += 0.8;
                this.timer++;

                if (this.timer >= 120) {
                    this.state = 'FIRE';
                    this.timer = 0;
                }
                break;

            case 'FIRE':
                this.timer++;

                // 🎯 親クラスの bulletType='twin' 射撃を呼び出し
                if (this.timer % 5 === 0) {
                    this.shoot(game);
                }

                if (this.timer >= 60) {
                    this.state = 'RETREAT';
                }
                break;

            case 'RETREAT':
                this.y -= 2.0;
                break;
        }
    }

    draw(ctx, isDebug = false) {
        ctx.save();
        if (this.state === 'CHARGE') {
            const glow = Math.sin(this.timer * 0.3) * 0.5 + 0.5;
            ctx.filter = `brightness(${1.0 + glow * 1.5}) saturate(${1.0 + glow * 2.0})`;
        }
        super.draw(ctx, isDebug);
        ctx.restore();
    }

    static create(game, bType, hp, data = {}) {
        return new GigaOrbEnemy(game, bType, hp);
    }
}

/**
 * 6. RockEnemy: 超高速で垂直落下してくるデブリ・岩石型トラップ
 */
export class RockEnemy extends Enemy {
    static DEFAULT_SPEED_Y = 6.0;

    speedX = -0.5;
    speedY = RockEnemy.DEFAULT_SPEED_Y;

    get imageName() { return "enemy_rock.webp"; }

    constructor(game, bulletType = 'none', hp = 1) {
        super(game, bulletType, hp);
    }

    update(game) {
        if (!this.active) return;
        this.x += this.speedX;
        this.y += this.speedY;
    }

    static create(game, bType, hp, data = {}) {
        const enemy = new RockEnemy(game, bType, hp);
        if (data.speedY !== undefined) enemy.speedY = data.speedY;
        return enemy;
    }
}

/**
 * 7. WormSegment: 連結エネミー（多関節）の胴体・尻尾パーツ
 */
export class WormSegment extends Enemy {
    static SEGMENT_SPACING = 20;

    constructor(game, head, index, isTail = false) {
        const imageKey = isTail ? "stage-4/enemy_worm_tail.webp" : "stage-4/enemy_worm_body.webp";
        super(game, 'none', 1);

        this.head = head;
        this.index = index;
        this.isTail = isTail;
        this.customImageKey = imageKey;

        if (game?.assets) {
            this.image = game.assets.get(imageKey);
        }

        this.width = head.width || 24;
        this.height = head.height || 24;
    }

    get imageName() {
        return this.customImageKey || (this.isTail ? "stage-4/enemy_worm_tail.webp" : "stage-4/enemy_worm_body.webp");
    }

    update(game) {
        if (!this.active) return;

        if (this.head?.active) {
            const targetIndex = this.index * 6;
            const history = this.head.history;

            if (history && history.length > targetIndex) {
                const pos = history[targetIndex];
                this.x = pos.x;
                this.y = pos.y;
                this.angle = pos.angle;
                this.isSubmerged = pos.isSubmerged;
            } else {
                this.x = this.head.x;
                this.y = this.head.y - (this.index * WormSegment.SEGMENT_SPACING);
                this.angle = this.head.angle || 0;
            }
        } else {
            this.active = false;
        }
    }

    takeDamage(game, amount) {
        if (this.isSubmerged) return false;
        const isDead = super.takeDamage(game, amount);
        if (isDead && this.head) {
            this.head.removeSegment(this);
        }
        return isDead;
    }

    draw(ctx, isDebug = false) {
        if (!this.active) return;

        ctx.save();
        if (this.isSubmerged) {
            ctx.globalAlpha = 0.3;
        }

        if (this.angle !== undefined) {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate(this.angle - Math.PI / 2);
            ctx.translate(-centerX, -centerY);
        }

        super.draw(ctx, isDebug);
        ctx.restore();
    }
}

/**
 * 8. WormEnemy: 連結エネミー（頭部）
 */
export class WormEnemy extends Enemy {
    static DEFAULT_LENGTH = 6;

    get imageName() { return "stage-4/enemy_worm_head.webp"; }

    constructor(game, bulletType = 'aim', hp = 5, length = WormEnemy.DEFAULT_LENGTH) {
        super(game, bulletType, hp);

        if (game?.assets) {
            game.assets.get("stage-4/enemy_worm_body.webp");
            game.assets.get("stage-4/enemy_worm_tail.webp");
        }

        this.speedY = 1.8;
        this.moveDirectionY = 1;
        this.timer = Math.random() * 100;

        this.angle = 0;
        this.isSubmerged = false;

        this.history = [];
        this.maxHistory = length * 10;

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

    setStartPosition(x, y) {
        super.setStartPosition(x, y);
        this.baseX = x;
    }

    update(game) {
        if (!this.active) return;
        this.timer += 0.04;

        const gameHeight = game?.height || 600;
        const upperThreshold = gameHeight * 0.25;
        const lowerThreshold = gameHeight * 0.66;

        if (this.y >= lowerThreshold && this.moveDirectionY > 0) {
            this.moveDirectionY = -1;
            this.baseX = Math.max(80, Math.min(game.width - 80, this.baseX + (Math.random() - 0.5) * 120));
        }

        if (this.y <= upperThreshold && this.moveDirectionY < 0) {
            this.moveDirectionY = 1;
            this.baseX = Math.max(80, Math.min(game.width - 80, this.baseX + (Math.random() - 0.5) * 120));
        }

        const prevX = this.x;
        const prevY = this.y;

        this.y += this.speedY * this.moveDirectionY;
        this.x = (this.baseX || this.startX) + Math.sin(this.timer * 1.5) * 80;

        const dx = this.x - prevX;
        const dy = this.y - prevY;
        this.angle = Math.atan2(dy, dx);

        const wave = Math.sin(this.timer * 2.5);
        this.isSubmerged = wave > 0.2;

        this.history.unshift({
            x: this.x,
            y: this.y,
            angle: this.angle,
            isSubmerged: this.isSubmerged
        });

        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }

        if (!this.isSubmerged && Math.random() < 0.025) {
            this.shoot(game);
        }
    }

    takeDamage(game, amount) {
        if (this.isSubmerged) return false;
        return super.takeDamage(game, amount);
    }

    draw(ctx, isDebug = false) {
        ctx.save();
        if (this.isSubmerged) {
            ctx.globalAlpha = 0.3;
        }

        if (this.angle !== undefined) {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate(this.angle - Math.PI / 2);
            ctx.translate(-centerX, -centerY);
        }

        super.draw(ctx, isDebug);
        ctx.restore();
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

    static create(game, bType, hp, data = {}) {
        return new WormEnemy(game, bType, hp || 5, data.length ?? WormEnemy.DEFAULT_LENGTH);
    }
}

// ==========================================
// 2. STAGE-4 ボス実体
// ==========================================

/**
 * STAGE-4 ボス: 地上絵守護神（Ancient Golem / BossEnemy_04）
 */
export class BossEnemy_04 extends BossEnemy {
    state = 'APPEAR';
    timer = 0;
    targetPointIndex = 0;

    get imageName() { return "enemy_boss_04.webp"; }

    constructor(game, hp = 800, timeLimit, timeMultiplier) {
        super(game, hp, timeLimit, timeMultiplier);
        
        this.isBoss = true;
        this.width = 128;
        this.height = 128;
        this.hitWidth = 100;
        this.hitHeight = 100;
    }

    setStartPosition(x, y) {
        super.setStartPosition(x, y);
        this.points = [
            { x: this.startX - 80, y: 50 },
            { x: this.startX + 80, y: 120 },
            { x: this.startX, y: 80 }
        ];
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.8;
                if (this.y >= 50) {
                    this.state = 'PATROL_PATTERN';
                    this.timer = 0;
                }
                break;

            case 'PATROL_PATTERN':
                if (!this.points) {
                    this.points = [
                        { x: this.startX - 80, y: 50 },
                        { x: this.startX + 80, y: 120 },
                        { x: this.startX, y: 80 }
                    ];
                }

                const target = this.points[this.targetPointIndex];
                const dx = target.x - this.x;
                const dy = target.y - this.y;
                const dist = Math.hypot(dx, dy);

                if (dist > 4) {
                    this.x += (dx / dist) * 2.2;
                    this.y += (dy / dist) * 2.2;
                } else {
                    this.targetPointIndex = (this.targetPointIndex + 1) % this.points.length;
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }

                if (this.timer % 35 === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }
                break;
        }
    }

    static create(game, bType, hp, data = {}) {
        return new BossEnemy_04(
            game, 
            hp || 800, 
            data.timeLimit, 
            data.timeMultiplier
        );
    }
}

// ==========================================
// 3. ENEMY_REGISTRY への自動登録
// ==========================================

ENEMY_REGISTRY.set('dust_scout', DustScoutEnemy);
ENEMY_REGISTRY.set('relic_prism', RelicPrismEnemy);
ENEMY_REGISTRY.set('mirage_crawler', MirageCrawlerEnemy);
ENEMY_REGISTRY.set('sand_pillar', SandPillarEnemy);
ENEMY_REGISTRY.set('giga_orb', GigaOrbEnemy);
ENEMY_REGISTRY.set('worm', WormEnemy);
ENEMY_REGISTRY.set('rock', RockEnemy);
ENEMY_REGISTRY.set('boss_04', BossEnemy_04);