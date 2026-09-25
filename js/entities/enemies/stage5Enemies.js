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

import { Enemy, BossEnemy, EnemyBullet, ENEMY_REGISTRY } from '../enemy.js';

// ==========================================
// 1. STAGE-5 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 分裂時に飛び散る小型細胞クラス（CellMitosisEnemy等から自動生成される）
 */
export class CellMiniEnemy extends Enemy {
    get imageName() { return "enemy_cell_mini.webp"; }

    constructor(game, x, y, vx, vy) {
        super(game, x, y, 'aim', 1); // HP = 1
        this.vx = vx;
        this.vy = vy;
        this.width = 20;  // 小型化
        this.height = 20;
    }

    update(game) {
        if (!this.active) return;
        this.x += this.vx;
        this.y += this.vy;

        // 慣性で徐々に真下への降下軌道にシフト
        this.vy = Math.min(2.5, this.vy + 0.05);

    }

    static create(game, x, y, bType, data = {}) {
        return new CellMiniEnemy(game, x, y, data.vx || 0, data.vy || 2);
    }
}

/**
 * 1. CellMitosis: 降下中に被弾（撃破）すると左右に2つの小型細胞（CellMini）に分裂して飛び散る増殖機
 */
export class CellMitosisEnemy extends Enemy {
    get imageName() { return "enemy_cell_mitosis.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); // HP = 2
        this.speedY = 1.2;
    }

    update(game) {
        if (!this.active) return;
        this.y += this.speedY;
    }

    /** 撃破時に2体に「細胞分裂」して左右へ弾き出す */
    takeDamage(amount) {
        const isDead = super.takeDamage(amount);
        if (isDead && this.game) {
            const bx = this.x + this.width / 2;
            const by = this.y + this.height / 2;

            // 左右斜め下へ飛び散る分裂細胞をエンティティリストへ追加
            const leftMini = new CellMiniEnemy(this.game, bx - 10, by, -2.0, -1.0);
            const rightMini = new CellMiniEnemy(this.game, bx + 10, by, 2.0, -1.0);
            this.game.entities.push(leftMini, rightMini);
        }
        return isDead;
    }

    static create(game, x, y, bType, data = {}) {
        return new CellMitosisEnemy(game, x, y, bType);
    }
}

/**
 * 2. PulseSpore: BGMの脈動（パルス）と同調して「膨張・縮小」を繰り返し、最大膨張時に全方位弾を解放するビート同期機
 */
export class PulseSporeEnemy extends Enemy {
    get imageName() { return "enemy_pulse_spore.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 1); // HP = 1
        this.speedY = 0.8;
        this.timer = Math.random() * 60;
        this.scale = 1.0;
        this.hasPulsed = false;
    }

    update(game) {
        if (!this.active) return;
        this.timer += 0.08;
        this.y += this.speedY;

        // 心臓の鼓動のようにスケールが0.8〜1.5倍に伸縮
        this.scale = 1.15 + Math.sin(this.timer) * 0.35;

        // ピーク（最大膨張時）で全方位拡散弾を発射
        if (this.scale >= 1.45 && !this.hasPulsed) {
            this.bulletType = 'eight-way';
            this.shoot(game);
            this.hasPulsed = true;
        } else if (this.scale < 1.2) {
            this.hasPulsed = false; // 次の膨張ピークに向けてフラグリセット
        }
    }

    draw(ctx) {
        ctx.save();
        // 脈動に合わせて画像の描画スケールを動的に変更
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.scale(this.scale, this.scale);
        ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));

        super.draw(ctx);
        ctx.restore();
    }

    static create(game, x, y, bType, data = {}) {
        return new PulseSporeEnemy(game, x, y, bType);
    }
}

/**
 * 3. BioTentacle: 画面端から滑らかなベジェ曲線運動（ウネウネ動き）で画面中央に触手を伸ばす生体機
 */
export class BioTentacleEnemy extends Enemy {
    get imageName() { return "enemy_bio_tentacle.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 4); // HP = 4
        this.baseX = x;
        this.timer = 0;
        this.speedY = 1.0;
    }

    update(game) {
        if (!this.active) return;
        this.timer += 0.05;

        this.y += this.speedY;
        // ベジェ曲線を模した大きなうねりの複合サイン波運動
        this.x = this.baseX + Math.sin(this.timer) * 60 + Math.cos(this.timer * 2.0) * 20;

        if (Math.floor(this.timer * 20) % 60 === 0) {
            this.bulletType = 'aim';
            this.shoot(game);
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new BioTentacleEnemy(game, x, y, bType);
    }
}

/**
 * 4. LeechParasite: 自機に向かって超低速で寄生飛行。
 */
export class LeechParasiteEnemy extends Enemy {
    get imageName() { return "enemy_leech_parasite.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 1); // HP = 1
        this.speed = 1.2;
        this.isParasite = true; // 衝突判定側でデバフ処理を分岐するためのフラグ例
    }

    update(game) {
        if (!this.active) return;

        // 常に自機の中心をジワジワ狙う誘導移動
        if (game.player && game.player.alive) {
            const dx = (game.player.x + game.player.width / 2) - (this.x + this.width / 2);
            const dy = (game.player.y + game.player.height / 2) - (this.y + this.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        } else {
            this.y += this.speed;
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new LeechParasiteEnemy(game, x, y, bType);
    }
}

/**
 * 5. HeartNucleus: 周囲の小型雑魚を一定周期で吸引・自己回復（HP加算）を行う中型生体コア
 */
export class HeartNucleusEnemy extends Enemy {
    get imageName() { return "enemy_heart_nucleus.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 7); // HP = 7
        this.width = 48;
        this.height = 48;
        this.speedY = 0.4; // 非常にゆったり降下
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += this.speedY;

        // 120F（約2秒）ごとに周囲のエネルギーを吸い上げてHPを1回復（最大HPは超えない）
        if (this.timer % 120 === 0 && this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + 1);
        }

        // 射撃は高密度の全方位弾（1未満にならないように保護）
        const interval = Math.max(1, Math.floor(80 / (this.fireRateMultiplier || 1)));
        if (this.timer % interval === 0) {
            this.bulletType = 'eight-way';
            this.shoot(game);
        }
    }

    static create(game, x, y, bType, data = {}) {
        const enemy = new HeartNucleusEnemy(game, x, y, bType);
        if (data.hp) enemy.hp = data.hp;
        return enemy;
    }
}


// ==========================================
// 2. STAGE-5 ボス実体
// ==========================================

/**
 * STAGE-5 ボス: 生体DNAコア（Planetary Pulse / BossEnemy_05）
 * 特徴: バイオレットのパルス明滅と、HP50%未満での細胞分裂・暴走（発射速度倍増＆脈動巨大化）を行うボス
 */
export class BossEnemy_05 extends BossEnemy {
    get imageName() { return "enemy_boss_05.webp"; }

    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        const startY = (y !== undefined && y !== null) ? y : -128;
        super(game, x, startY, hp, timeLimit, timeMultiplier);
        
        this.isBoss = true;
        this.width = 110;
        this.height = 110;
        this.hitWidth = 90;
        this.hitHeight = 90;

        this.state = 'APPEAR';
        this.timer = 0;
        this.baseX = x;
        this.hasSplit = false;
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
                }
                break;

            case 'PULSE_WAVE':
                // 呼吸するようにゆったり浮遊
                this.x = this.baseX + Math.sin(this.timer * 0.02) * 60;
                this.y = 60 + Math.cos(this.timer * 0.04) * 20;

                // 粘着質なシンセアルペジオと同調した自機狙い連射弾（ゼロ除算保護）
                const interval = Math.max(1, Math.floor(15 / (this.fireRateMultiplier || 1)));
                if (this.timer % interval === 0) {
                    this.bulletType = 'aim';
                    this.shoot(game);
                }

                // 🧬 ギミック: HPが半分を切ると、おぞましい細胞分裂とともに弾幕が常時激化
                if (!this.hasSplit && this.hp < this.maxHp / 2) {
                    this.hasSplit = true;
                    this.fireRateMultiplier = 2.0; // 攻撃速度が2倍へ昇華
                }

                if (this.hasSplit && this.timer % 40 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                break;
        }
    }

    draw(ctx) {
        ctx.save();
        // 分裂（暴走）後は不気味な紫色に輝き、激しく脈動（スケール変化）する
        if (this.hasSplit) {
            const scale = 1.0 + Math.sin(this.timer * 0.2) * 0.08;
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.scale(scale, scale);
            ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
            ctx.filter = 'hue-rotate(280deg) saturate(2.5) brightness(1.1)';
        }
        super.draw(ctx);
        ctx.restore();
    }

    onDie(game) {
        if (game.collisions) {
            for (let i = 0; i < 14; i++) {
                setTimeout(() => {
                    game.collisions.createExplosion(
                        this.x + Math.random() * this.width, 
                        this.y + Math.random() * this.height, 
                        { maxHp: 110 }
                    );
                }, i * 90);
            }
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_05(
            game, x, y, 
            data.hp || 90, 
            data.timeLimit || 1800, 
            data.timeMultiplier || 100
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