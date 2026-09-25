/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage2Enemies.js - ステージ2（水脈・深海エリア）敵クラス定義
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import { Enemy, BossEnemy, EnemyBullet, ENEMY_REGISTRY } from '../enemy.js';

// ==========================================
// 1. STAGE-2 固有のザコ・中型敵クラス群
// ==========================================

/**
/* 1. AquaJetEnemy（S字型水流機動雑魚）
 */
export class AquaJetEnemy extends Enemy {
    constructor(game, x, y, bulletType, hp = 2) {
        super(game, x, y, bulletType, hp);
        this.speedY = 1.5;
        this.sinAngle = Math.random() * Math.PI * 2;
        this.sinSpeed = 0.05;
        this.sinAmplitude = 2.5;
    }

    get imageName() { return "enemy_aquajet.webp"; }

    update(game) {
        if (!this.active) return;

        // S字サイン波移動
        this.sinAngle += this.sinSpeed;
        this.x += Math.sin(this.sinAngle) * this.sinAmplitude;
        this.y += this.speedY;

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
        return new AquaJetEnemy(game, x, y, bType, data.hp || 2);
    }
}

/**
/* 2. WaveSpreaderEnemy（波状拡散砲台）
 */
export class WaveSpreaderEnemy extends Enemy {
    constructor(game, x, y, bulletType, hp = 4) {
        super(game, x, y, bulletType, hp);
        this.speedY = 1.0;
        this.targetY = 100 + Math.random() * 80;
        this.isHovering = false;
        this.hoverTimer = 0;
        this.hoverDuration = 180; // 3秒間ホバリング
        this.baseShootInterval = 45; // 高速拡散射撃
    }

    get imageName() { return "enemy_wavespreader.webp"; }

    update(game) {
        if (!this.active) return;

        if (!this.isHovering) {
            this.y += this.speedY;
            if (this.y >= this.targetY) {
                this.isHovering = true;
            }
        } else {
            this.hoverTimer++;
            this.x += Math.sin(this.hoverTimer * 0.05) * 0.8; // ゆらゆら揺れる

            if (this.hoverTimer >= this.hoverDuration) {
                this.isHovering = false;
                this.speedY = 2.5; // 退避加速
            }
        }

        // 射撃処理
        if (this.isHovering) {
            this.shootTimer++;
            if (this.shootTimer >= this.baseShootInterval) {
                this.shootSpreadWave(game);
                this.shootTimer = 0;
            }
        }
    }

    shootSpreadWave(game) {
        if (!game?.player) return;
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;

        for (let i = -2; i <= 2; i++) {
            const angle = (Math.PI / 2) + (i * 0.25);
            game.entities.push(new EnemyBullet(bx, by, Math.cos(angle) * 3, Math.sin(angle) * 3));
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new WaveSpreaderEnemy(game, x, y, bType, data.hp || 4);
    }
}

/**
 * 3. BubbleMineEnemy（泡装甲浮遊機）
 */
export class BubbleMineEnemy extends Enemy {
    constructor(game, x, y, bulletType, hp = 6) {
        super(game, x, y, bulletType, hp);
        this.speedY = 0.8;
    }

    get imageName() { return "enemy_bubblemine.webp"; }

    update(game) {
        if (!this.active) return;
        this.y += this.speedY;

    }

    takeDamage(amount) {
        const killed = super.takeDamage(amount);
        if (this.game) {
            // 被弾時：周囲に小泡弾を弾き飛ばす演出
            this.popBubbleCluster(this.game, killed ? 8 : 2);
        }
        return killed;
    }

    popBubbleCluster(game, count) {
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 1 + Math.random() * 2;
            game.entities.push(new EnemyBullet(bx, by, Math.cos(angle) * spd, Math.sin(angle) * spd));
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new BubbleMineEnemy(game, x, y, bType, data.hp || 6);
    }
}

/**
 * 4. VortexDiverEnemy（渦潮急降下機）
 */
export class VortexDiverEnemy extends Enemy {
    constructor(game, x, y, bulletType, hp = 3) {
        super(game, x, y, bulletType, hp);
        this.state = 'DIVING'; // DIVING -> TURNING -> ASCENDING
        this.speedY = 4.0;
        this.turnTimer = 0;
        this.flipScaleY = 1.0;
    }

    get imageName() { return "enemy_vortexdiver.webp"; }

    update(game) {
        if (!this.active) return;

        if (this.state === 'DIVING') {
            this.y += this.speedY;
            if (this.y >= 350) {
                this.state = 'TURNING';
            }
        } else if (this.state === 'TURNING') {
            this.turnTimer++;
            // 10フレームかけてスムーズに上下反転
            this.flipScaleY = 1.0 - (this.turnTimer / 10) * 2.0;

            if (this.turnTimer >= 10) {
                this.flipScaleY = -1.0;
                this.state = 'ASCENDING';
                this.shootBurst(game);
            }
        } else if (this.state === 'ASCENDING') {
            this.y -= this.speedY * 0.8;
        }
    }

    shootBurst(game) {
        if (!game?.player) return;
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;
        for (let i = 0; i < 12; i++) {
            const a = (Math.PI * 2 / 12) * i;
            game.entities.push(new EnemyBullet(bx, by, Math.cos(a) * 3.5, Math.sin(a) * 3.5));
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        // 敵の中心座標を移動・反転の軸にする
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        ctx.translate(cx, cy);
        ctx.scale(1, this.flipScaleY);
        ctx.translate(-cx, -cy);

        super.draw(ctx);
        ctx.restore();
    }

    static create(game, x, y, bType, data = {}) {
        return new VortexDiverEnemy(game, x, y, bType, data.hp || 3);
    }
}

/// ==========================================
// 2. STAGE-2 ボス実体
// ==========================================
/**
/* 5. BossEnemy_02（Stage 2 ボス：水棲機甲 leviathan）
 */
export class BossEnemy_02 extends BossEnemy {
    constructor(game, x, y, hp = 150, timeLimit, timeMultiplier) {
        super(game, x, y, hp, timeLimit, timeMultiplier);
        this.width = 96;
        this.height = 96;
        
        this.state = 'NORMAL'; // NORMAL, DIVING, ASCENDING
        this.stateTimer = 0;
        this.diveCycleTimer = 0;
        this.angle = 0;
    }

    get imageName() { return "boss_stage2.webp"; }

    update(game) {
        if (!this.active) return;

        this.stateTimer++;
        this.diveCycleTimer++;

        // 1. 状態遷移ロジック（定期的な潜航・浮上）
        if (this.state === 'NORMAL' && this.diveCycleTimer > 300) { // 5秒ごとに潜航試行
            this.state = 'DIVING';
            this.stateTimer = 0;
            this.diveCycleTimer = 0;
        }

        // 2. 状態別の行動
        if (this.state === 'DIVING') {
            if (this.stateTimer > 120) { // 2秒間潜航（水中演出）
                this.state = 'ASCENDING';
                this.stateTimer = 0;
                // プレイヤーのX座標付近へ急浮上移動
                if (game?.player) {
                    this.x = Math.max(20, Math.min(game.player.x - 32, 220));
                }
            }
        } else if (this.state === 'ASCENDING') {
            if (this.stateTimer === 1) {
                // 浮上時に周囲へ全方位弾幕
                this.shootRingPattern(game, 16);
            }
            if (this.stateTimer > 30) {
                this.state = 'NORMAL';
                this.stateTimer = 0;
            }
        } else {
            // NORMAL時の基本移動（8の字浮遊）
            this.angle += 0.03;
            this.x = 112 + Math.sin(this.angle) * 60;
            this.y = 50 + Math.sin(this.angle * 2) * 20;

            // 定期射撃
            if (this.stateTimer % 40 === 0) {
                this.shoot(game);
            }
        }
    }

    takeDamage(amount) {
        // 潜航（DIVING）中は水中に潜っているため攻撃が届かない（完全無敵）
        if (this.state === 'DIVING') return false;
        return super.takeDamage(amount);
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        if (this.state === 'DIVING') {
            // 水中潜航時の演出（フィルターによる青調・ブラー効果）
            ctx.filter = 'blur(2px) brightness(0.7) hue-rotate(180deg)';
            ctx.globalAlpha = 0.5;
        }

        super.draw(ctx);
        ctx.restore();
    }

    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_02(game, x, y, data.hp || 150, data.timeLimit, data.timeMultiplier);
    }
}

// ==========================================
// 3. ENEMY_REGISTRY への自動登録
// ==========================================

ENEMY_REGISTRY.set('aquajet', AquaJetEnemy);
ENEMY_REGISTRY.set('wavespreader', WaveSpreaderEnemy);
ENEMY_REGISTRY.set('bubblemine', BubbleMineEnemy);
ENEMY_REGISTRY.set('vortexdiver', VortexDiverEnemy);
ENEMY_REGISTRY.set('boss_02', BossEnemy_02);