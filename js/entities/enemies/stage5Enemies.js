/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage5Enemies.js - STAGE-5 (Planetary Pulse) 固有敵クラス群 & ボス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
"use strict";

import { Enemy, BossEnemy, ENEMY_REGISTRY } from '../enemy.js';

// ==========================================
// 1. STAGE-5 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 分裂時に飛び散る小型細胞クラス（CellMitosisEnemy等から自動生成される）
 */
export class CellMiniEnemy extends Enemy {
    vx = 0;
    vy = 2;

    get imageName() { return "enemy_cell_mini.webp"; }

    constructor(game, bulletType = 'none', hp = 1) {
        super(game, bulletType, hp);
        this.width = 20;  // 小型化
        this.height = 20;
    }

    setStartPosition(x, y) {
        super.setStartPosition(x, y);
    }

    update(game) {
        if (!this.active) return;
        this.x += this.vx;
        this.y += this.vy;

        // 慣性で徐々に真下への降下軌道にシフト
        this.vy = Math.min(2.5, this.vy + 0.05);
    }

    static create(game, bType, hp, data = {}) {
        const enemy = new CellMiniEnemy(game, bType, hp || 1);
        if (data.vx !== undefined) enemy.vx = data.vx;
        if (data.vy !== undefined) enemy.vy = data.vy;
        return enemy;
    }
}

/**
 * 1. CellMitosis: 降下中に被弾（撃破）すると左右に2つの小型細胞（CellMini）に分裂して飛び散る増殖機
 */
export class CellMitosisEnemy extends Enemy {
    speedY = 1.2;

    get imageName() { return "enemy_cell_mitosis.webp"; }

    constructor(game, bulletType = 'none', hp = 2) {
        super(game, bulletType, hp);
        this.width = (220 / 111) * 32;
        this.height = 32;
    }

    update(game) {
        if (!this.active) return;
        this.y += this.speedY;
    }

    /** 撃破時に2体に「細胞分裂」して左右へ弾き出す */
    takeDamage(game, amount) {
        if (!this.active) return false;

        // ⭕ ダメージを受けて死亡する前の「正確な中心座標」をあらかじめ保持しておく
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;

        // 親クラス（Enemy）の被弾・撃破（onDie）処理を実行
        const isDead = super.takeDamage(game, amount);

        // 撃破された場合のみ分裂体を生成
        if (isDead && game) {
            // 保存しておいた正確な座標に CellMiniEnemy を配置
            const leftMini = CellMiniEnemy.create(game, 'none', 1, { vx: -2.0, vy: -1.0 });
            leftMini.setStartPosition(bx - 10, by);

            const rightMini = CellMiniEnemy.create(game, 'none', 1, { vx: 2.0, vy: -1.0 });
            rightMini.setStartPosition(bx + 10, by);

            // ゲームのエンティティ配列へ追加
            game.entities.push(leftMini, rightMini);
        }

        return isDead;
    }

    static create(game, bType, hp, data = {}) {
        return new CellMitosisEnemy(game, bType, hp || 2);
    }
}

/**
 * 2. PulseSpore: BGMの脈動（パルス）と同調して「膨張・縮小」を繰り返し、最大膨張時に全方位弾を解放するビート同期機
 */
export class PulseSporeEnemy extends Enemy {
    speedY = 0.8;
    timer = game.random.range(0, 60);
    scale = 1.0;
    hasPulsed = false;

    get imageName() { return "enemy_pulse_spore.webp"; }

    constructor(game, bulletType = 'eight-way', hp = 1) {
        super(game, bulletType, hp);
    }

    update(game) {
        if (!this.active) return;
        this.timer += 0.08;
        this.y += this.speedY;

        // 心臓の鼓動のようにスケールが0.8〜1.5倍に伸縮
        this.scale = 1.15 + Math.sin(this.timer) * 0.35;

        // ピーク（最大膨張時）で全方位拡散弾を発射
        if (this.scale >= 1.45 && !this.hasPulsed) {
            this.shoot(game);
            this.hasPulsed = true;
        } else if (this.scale < 1.2) {
            this.hasPulsed = false; // 次の膨張ピークに向けてフラグリセット
        }
    }

    draw(ctx, isDebug = false) {
        ctx.save();
        // 脈動に合わせて画像の描画スケールを動的に変更
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.scale(this.scale, this.scale);
        ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));

        super.draw(ctx, isDebug);
        ctx.restore();
    }

    static create(game, bType, hp, data = {}) {
        return new PulseSporeEnemy(game, bType || 'eight-way', hp || 1);
    }
}

/**
 * 3. BioTentacle: 画面端から滑らかなベジェ曲線運動（ウネウネ動き）で画面中央に触手を伸ばす生体機
 */
export class BioTentacleEnemy extends Enemy {
    speedY = 1.0;
    timer = 0;

    get imageName() { return "enemy_bio_tentacle.webp"; }

    constructor(game, bulletType = 'aim', hp = 4) {
        super(game, bulletType, hp);
        this.width = (461 / 133) * 32;
        this.height = 32;
        this.baseShootInterval = 60;
    }

    setStartPosition(x, y) {
        super.setStartPosition(x, y);
        this.baseX = x;
    }

    update(game) {
        if (!this.active) return;
        this.timer += 0.05;

        this.y += this.speedY;
        // ベジェ曲線を模した大きなうねりの複合サイン波運動
        const bx = this.baseX ?? this.startX;
        this.x = bx + Math.sin(this.timer) * 60 + Math.cos(this.timer * 2.0) * 20;

        super.update(game);
    }

    static create(game, bType, hp, data = {}) {
        return new BioTentacleEnemy(game, bType , hp );
    }
}

/**
 * 4. LeechParasite: 自機に向かって超低速で寄生飛行。
 */
export class LeechParasiteEnemy extends Enemy {
    speed = 1.2;
    isParasite = true; // 衝突判定側でデバフ処理を分岐するためのフラグ例

    get imageName() { return "enemy_leech_parasite.webp"; }

    constructor(game, bulletType = 'none', hp = 1) {
        super(game, bulletType, hp);
        this.width = (250 / 123) * 32;
        this.height = 32;
    }

    update(game) {
        if (!this.active) return;

        // 常に自機の中心をジワジワ狙う誘導移動
        if (game.player.alive) {
            const dx = (game.player.x + game.player.width / 2) - (this.x + this.width / 2);
            const dy = (game.player.y + game.player.height / 2) - (this.y + this.height / 2);
            const dist = Math.hypot(dx, dy) || 1;

            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        } else {
            this.y += this.speed;
        }
    }

    static create(game, bType, hp, data = {}) {
        return new LeechParasiteEnemy(game, bType, hp || 1);
    }
}

/**
 * 5. HeartNucleus: 周囲の小型雑魚を一定周期で吸引・自己回復（HP加算）を行う中型生体コア
 */
export class HeartNucleusEnemy extends Enemy {
    speedY = 0.4;
    timer = 0;
    suctionParticles = [];

    get imageName() { return "enemy_heart_nucleus.webp"; }

    constructor(game, bulletType = 'eight-way', hp = 7) {
        super(game, bulletType, hp);
        this.width = 48;
        this.height = 48;
        this.baseShootInterval = 80;

        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            this.suctionParticles.push({
                angle: game.random.angle(),
                distance: game.random.range(120, 150),
                speed: game.random.range(2, 5),
                length: game.random.range(10, 25),
            });
        }
    }

    _applySuctionToPlayer(game) {
        const enemyCenterX = this.x + this.width / 2;
        const enemyCenterY = this.y + this.height / 2;
        const playerCenterX = game.player.x + game.player.width / 2;
        const playerCenterY = game.player.y + game.player.height / 2;

        const dx = enemyCenterX - playerCenterX;
        const dy = enemyCenterY - playerCenterY;
        const distance = Math.hypot(dx, dy);

        const suctionRadius = 600;

        if (distance < suctionRadius && distance > 0) {
            const force = (1 - distance / suctionRadius) * 2.5;

            game.player.suctionForceX = (game.player.suctionForceX || 0) + (dx / distance) * force;
            game.player.suctionForceY = (game.player.suctionForceY || 0) + (dy / distance) * force;
        }
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += this.speedY;
        this._applySuctionToPlayer(game);

        // 120F（約2秒）ごとに周囲のエネルギーを吸い上げてHPを1回復（最大HPは超えない）
        if (this.timer % 120 === 0 && this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + 1);
        }

        super.update(game);
    }

    draw(ctx, isDebug = false) {
        super.draw(ctx, isDebug);

        ctx.save();
        ctx.strokeStyle = 'rgba(220, 180, 255, 0.6)';
        ctx.lineWidth = 1.5;

        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        for (const p of this.suctionParticles) {
            p.distance -= p.speed;

            if (p.distance <= 10) {
                p.distance =game.random.range(120, 150);
                p.angle = game.random.angle();
            }

            const startX = centerX + Math.cos(p.angle) * p.distance;
            const startY = centerY + Math.sin(p.angle) * p.distance;

            const endX = centerX + Math.cos(p.angle) * (p.distance - p.length);
            const endY = centerY + Math.sin(p.angle) * (p.distance - p.length);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        ctx.restore();
    }

    static create(game, bType, hp, data = {}) {
        return new HeartNucleusEnemy(game, bType || 'eight-way', hp || 7);
    }
}

// ==========================================
// 2. STAGE-5 ボス実体
// ==========================================

/**
 * STAGE-5 ボス: 生体DNAコア（Planetary Pulse / BossEnemy_05）
 */
export class BossEnemy_05 extends BossEnemy {
    state = 'APPEAR';
    timer = 0;
    hasSplit = false;
    shotCount = 0;

    get imageName() { return "enemy_boss_05.webp"; }

    constructor(game, hp = 900, timeLimit, timeMultiplier) {
        super(game, hp, timeLimit, timeMultiplier);
        
        this.isBoss = true;
        this.width = (818 / 291) * 110;
        this.height = 110;
        this.hitWidth = 90;
        this.hitHeight = 90;
    }

    setStartPosition(x, y) {
        super.setStartPosition(x, y);
        this.baseX = this.startX;
    }    

    getHitboxes() {
        const headW = 70;
        const headH = 120;
        const headX = this.x + (this.width - headW) / 2;
        const headY = this.y + this.height - headH;

        const bodyW = 290;
        const bodyH = 70;
        const bodyX = this.x + (this.width - bodyW) / 2;
        const bodyY = this.y + 10;

        return [
            {
                part: 'HEAD',
                multiplier: 2.0,
                x: headX,
                y: headY,
                width: headW,
                height: headH
            },
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
                this.y += 0.6;
                if (this.y >= 60) {
                    this.state = 'PULSE_WAVE';
                    this.timer = 0;
                    this.baseX = this.x;
                }
                break;

            case 'PULSE_WAVE':
                const bx = this.baseX ?? this.startX;
                this.x = bx + Math.sin(this.timer * 0.02) * 60;
                this.y = 60 + (1 - Math.cos(this.timer * 0.04)) * 20;

                const interval = Math.max(1, Math.floor(15 / (this.fireRateMultiplier || 1)));
                if (this.timer % interval === 0) {
                    if (this.shotCount % 10 < 8) {
                        this.bulletType = 'aim';
                        this.shoot(game);
                    }
                    this.shotCount++;
                }

                if (!this.hasSplit && this.hp < this.maxHp / 2) {
                    this.hasSplit = true;
                    this.fireRateMultiplier = 2.0;
                }

                if (this.hasSplit && this.timer % 40 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                break;
        }
    }

    draw(ctx, isDebug = false) {
        ctx.save();
        if (this.hasSplit) {
            const scale = 1.0 + Math.sin(this.timer * 0.2) * 0.08;
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
            
            ctx.filter = 'hue-rotate(280deg) saturate(2.5) brightness(1.1)';
        }
        super.draw(ctx, isDebug);
        ctx.restore();
    }

    static create(game, bType, hp, data = {}) {
        return new BossEnemy_05(
            game, 
            hp || 900, 
            data.timeLimit, 
            data.timeMultiplier
        );
    }
}

// ==========================================
// 3. ENEMY_REGISTRY への自動登録
// ==========================================

ENEMY_REGISTRY.set('cell_mini', CellMiniEnemy);
ENEMY_REGISTRY.set('cell_mitosis', CellMitosisEnemy);
ENEMY_REGISTRY.set('pulse_spore', PulseSporeEnemy);
ENEMY_REGISTRY.set('bio_tentacle', BioTentacleEnemy);
ENEMY_REGISTRY.set('leech_parasite', LeechParasiteEnemy);
ENEMY_REGISTRY.set('heart_nucleus', HeartNucleusEnemy);
ENEMY_REGISTRY.set('boss_05', BossEnemy_05);