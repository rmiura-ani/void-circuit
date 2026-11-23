/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage5Enemies.ts - STAGE-5 (Planetary Pulse) 固有敵クラス群 & ボス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import {
    Enemy,
    BossEnemy,
    ENEMY_REGISTRY,
    type BulletType,
    type EnemyGameContext,
    type EnemySpawnData,
    type BossHitboxPart
} from '../enemy.js';

export interface Stage5PlayerLike {
    x: number;
    y: number;
    width: number;
    height: number;
    alive?: boolean;
    suctionForceX?: number;
    suctionForceY?: number;
}

export interface Stage5GameContext extends EnemyGameContext {
    player?: Stage5PlayerLike | null;
}

interface SuctionParticle {
    angle: number;
    maxDistance: number;
    distance: number;
    baseSpeed: number;
    length: number;
    alpha: number;
}

interface HealPulse {
    radius: number;
    maxRadius: number;
    speed: number;
    alpha: number;
}

// ==========================================
// 1. STAGE-5 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 分裂時に飛び散る小型細胞クラス（CellMitosisEnemy等から自動生成される）
 */
export class CellMiniEnemy extends Enemy {
    public vx: number = 0;
    public vy: number = 2;

    public override get imageName(): string { return "enemy_cell_mini.webp"; }

    constructor(game: Stage5GameContext, bulletType: BulletType = 'none', hp: number = 1) {
        super(game, bulletType, hp);
        this.width = 20;
        this.height = 20;
    }

    public override update(_game: Stage5GameContext): void {
        if (!this.active) return;
        this.x += this.vx;
        this.y += this.vy;

        // 慣性で徐々に真下への降下軌道にシフト
        this.vy = Math.min(2.5, this.vy + 0.05);
    }

    public static override create(
        game: Stage5GameContext,
        bType?: BulletType,
        hp?: number,
        data: EnemySpawnData = {}
    ): CellMiniEnemy {
        const enemy = new CellMiniEnemy(game, bType, hp || 1);
        if (typeof data.vx === 'number') enemy.vx = data.vx;
        if (typeof data.vy === 'number') enemy.vy = data.vy;
        return enemy;
    }
}

/**
 * 1. CellMitosis: 降下中に被弾（撃破）すると左右に2つの小型細胞（CellMini）に分裂して飛び散る増殖機
 */
export class CellMitosisEnemy extends Enemy {
    public speedY: number = 1.2;

    public override get imageName(): string { return "enemy_cell_mitosis.webp"; }

    constructor(game: Stage5GameContext, bulletType: BulletType = 'none', hp: number = 2) {
        super(game, bulletType, hp);
        this.width = (220 / 111) * 32;
        this.height = 32;
    }

    public override update(_game: Stage5GameContext): void {
        if (!this.active) return;
        this.y += this.speedY;
    }

    /** 撃破時に2体に「細胞分裂」して左右へ弾き出す */
    public override takeDamage(game: Stage5GameContext, amount: number): boolean {
        if (!this.active) return false;

        // ダメージを受けて死亡する前の正確な中心座標をあらかじめ保持
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;

        // 親クラスの被弾・撃破処理を実行
        const isDead = super.takeDamage(game, amount);

        // 撃破された場合のみ分裂体を生成
        if (isDead && game) {
            const leftMini = CellMiniEnemy.create(game, 'none', 1, { vx: -2.0, vy: -1.0 });
            leftMini.setStartPosition(bx - 10, by);

            const rightMini = CellMiniEnemy.create(game, 'none', 1, { vx: 2.0, vy: -1.0 });
            rightMini.setStartPosition(bx + 10, by);

            game.entities.push(leftMini, rightMini);
        }

        return isDead;
    }

    public static override create(
        game: Stage5GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): CellMitosisEnemy {
        return new CellMitosisEnemy(game, bType, hp || 2);
    }
}

/**
 * 2. PulseSpore: BGMの脈動（パルス）と同調して「膨張・縮小」を繰り返し、最大膨張時に全方位弾を解放するビート同期機
 */
export class PulseSporeEnemy extends Enemy {
    public speedY: number = 0.8;
    public timer: number = 0;
    public scale: number = 1.0;
    public hasPulsed: boolean = false;

    public override get imageName(): string { return "enemy_pulse_spore.webp"; }

    constructor(game: Stage5GameContext, bulletType: BulletType = 'eight-way', hp: number = 1) {
        super(game, bulletType, hp);
        this.timer = game.random.range(0, 60);
    }

    public override update(game: Stage5GameContext): void {
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
            this.hasPulsed = false;
        }
    }

    public override draw(ctx: CanvasRenderingContext2D, isDebug: boolean = false): void {
        ctx.save();
        // 脈動に合わせて画像の描画スケールを動的に変更
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.scale(this.scale, this.scale);
        ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));

        super.draw(ctx, isDebug);
        ctx.restore();
    }

    public static override create(
        game: Stage5GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): PulseSporeEnemy {
        return new PulseSporeEnemy(game, bType || 'eight-way', hp || 1);
    }
}

/**
 * 3. BioTentacle: 画面端から滑らかなベジェ曲線運動（ウネウネ動き）で画面中央に触手を伸ばす生体機
 */
export class BioTentacleEnemy extends Enemy {
    public speedY: number = 1.0;
    public timer: number = 0;
    public baseX?: number;
    public baseShootInterval: number = 60;

    public override get imageName(): string { return "enemy_bio_tentacle.webp"; }

    constructor(game: Stage5GameContext, bulletType: BulletType = 'aim', hp: number = 4) {
        super(game, bulletType, hp);
        this.width = (461 / 133) * 32;
        this.height = 32;
    }

    public override setStartPosition(x: number, y: number): void {
        super.setStartPosition(x, y);
        this.baseX = x;
    }

    public override update(game: Stage5GameContext): void {
        if (!this.active) return;
        this.timer += 0.05;

        this.y += this.speedY;
        // ベジェ曲線を模した大きなうねりの複合サイン波運動
        const bx = this.baseX ?? this.startX;
        this.x = bx + Math.sin(this.timer) * 60 + Math.cos(this.timer * 2.0) * 20;

        super.update(game);
    }

    public static override create(
        game: Stage5GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): BioTentacleEnemy {
        return new BioTentacleEnemy(game, bType, hp);
    }
}

/**
 * 4. LeechParasite: 自機に向かって超低速で寄生飛行。
 */
export class LeechParasiteEnemy extends Enemy {
    public speed: number = 1.2;
    public isParasite: boolean = true;

    public override get imageName(): string { return "enemy_leech_parasite.webp"; }

    constructor(game: Stage5GameContext, bulletType: BulletType = 'none', hp: number = 1) {
        super(game, bulletType, hp);
        this.width = (250 / 123) * 32;
        this.height = 32;
    }

    public override update(game: Stage5GameContext): void {
        if (!this.active) return;

        // 常に自機の中心をジワジワ狙う誘導移動
        if (game.player?.alive) {
            const dx = game.player.x + game.player.width / 2 - (this.x + this.width / 2);
            const dy = game.player.y + game.player.height / 2 - (this.y + this.height / 2);
            const dist = Math.hypot(dx, dy) || 1;

            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        } else {
            this.y += this.speed;
        }
    }

    public static override create(
        game: Stage5GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): LeechParasiteEnemy {
        return new LeechParasiteEnemy(game, bType, hp || 1);
    }
}

/**
 * 5. HeartNucleus: 周囲の小型雑魚や自機を一定周期で吸引・自己回復（HP加算）を行う中型生体コア
 */
export class HeartNucleusEnemy extends Enemy {
    public speedY: number = 0.4;
    public timer: number = 0;
    public baseShootInterval: number = 80;
    public suctionParticles: SuctionParticle[] = [];
    public healPulses: HealPulse[] = [];

    public override get imageName(): string { return "enemy_heart_nucleus.webp"; }

    constructor(game: Stage5GameContext, bulletType: BulletType = 'eight-way', hp: number = 7) {
        super(game, bulletType, hp);
        this.width = 48;
        this.height = 48;

        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            this.suctionParticles.push({
                angle: game.random.angle(),
                maxDistance: game.random.range(120, 150),
                distance: game.random.range(120, 150),
                baseSpeed: game.random.range(1.5, 3),
                length: game.random.range(12, 28),
                alpha: game.random.range(0.4, 0.9)
            });
        }
    }

    private _applySuctionToPlayer(game: Stage5GameContext): void {
        if (!game.player) return;

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

    public override update(game: Stage5GameContext): void {
        if (!this.active) return;
        this.timer++;

        this.y += this.speedY;
        this._applySuctionToPlayer(game);

        // 120FごとにHP回復 & 回復パルス波の発生
        if (this.timer % 120 === 0 && this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + 1);

            this.healPulses.push({
                radius: 10,
                maxRadius: 60,
                speed: 2.5,
                alpha: 1.0
            });
        }

        // 回復パルスの更新処理
        for (let i = this.healPulses.length - 1; i >= 0; i--) {
            const pulse = this.healPulses[i];
            pulse.radius += pulse.speed;
            pulse.alpha = 1 - pulse.radius / pulse.maxRadius;

            if (pulse.radius >= pulse.maxRadius) {
                this.healPulses.splice(i, 1);
            }
        }

        // パーティクルの更新処理（イージング）
        for (const p of this.suctionParticles) {
            const progress = 1 - Math.max(0, p.distance / p.maxDistance);
            const currentSpeed = p.baseSpeed + Math.pow(progress, 2) * 5;

            p.distance -= currentSpeed;

            if (p.distance <= 10) {
                const newDist = game.random.range(120, 150);
                p.maxDistance = newDist;
                p.distance = newDist;
                p.angle = game.random.angle();
                p.baseSpeed = game.random.range(1.5, 3);
                p.alpha = game.random.range(0.4, 0.9);
            }
        }

        super.update(game);
    }

    public override draw(ctx: CanvasRenderingContext2D, isDebug: boolean = false): void {
        super.draw(ctx, isDebug);

        ctx.save();
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        ctx.globalCompositeOperation = 'lighter';

        // 回復パルス（波紋）の描画
        for (const pulse of this.healPulses) {
            ctx.strokeStyle = `rgba(120, 255, 180, ${Math.max(0, pulse.alpha)})`;
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.arc(centerX, centerY, pulse.radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 吸引パーティクルの描画
        for (const p of this.suctionParticles) {
            const startX = centerX + Math.cos(p.angle) * p.distance;
            const startY = centerY + Math.sin(p.angle) * p.distance;

            const endX = centerX + Math.cos(p.angle) * (p.distance - p.length);
            const endY = centerY + Math.sin(p.angle) * (p.distance - p.length);

            const grad = ctx.createLinearGradient(startX, startY, endX, endY);
            grad.addColorStop(0, `rgba(180, 130, 255, 0)`);
            grad.addColorStop(0.5, `rgba(255, 120, 220, ${p.alpha})`);
            grad.addColorStop(1, `rgba(255, 230, 255, ${p.alpha})`);

            ctx.strokeStyle = grad;
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        ctx.restore();
    }

    public static override create(
        game: Stage5GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): HeartNucleusEnemy {
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
    public state: 'APPEAR' | 'PULSE_WAVE' = 'APPEAR';
    public timer: number = 0;
    public hasSplit: boolean = false;
    public shotCount: number = 0;
    public baseX?: number;

    public override get imageName(): string { return "enemy_boss_05.webp"; }

    constructor(
        game: Stage5GameContext,
        hp: number = 900,
        timeLimit?: number,
        timeMultiplier?: number
    ) {
        super(game, hp, timeLimit, timeMultiplier);

        this.isBoss = true;
        this.width = (818 / 291) * 110;
        this.height = 110;
        this.hitWidth = 90;
        this.hitHeight = 90;
    }

    public override setStartPosition(x: number, y: number): void {
        super.setStartPosition(x, y);
        this.baseX = this.startX;
    }

    public override getHitboxes(): BossHitboxPart[] {
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

    public override update(game: Stage5GameContext): void {
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

            case 'PULSE_WAVE': {
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
    }

    public override draw(ctx: CanvasRenderingContext2D, isDebug: boolean = false): void {
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

    public static override create(
        game: Stage5GameContext,
        _bType?: BulletType,
        hp?: number,
        data: EnemySpawnData = {}
    ): BossEnemy_05 {
        return new BossEnemy_05(
            game,
            hp || 900,
            typeof data.timeLimit === 'number' ? data.timeLimit : undefined,
            typeof data.timeMultiplier === 'number' ? data.timeMultiplier : undefined
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