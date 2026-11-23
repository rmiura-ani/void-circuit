/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage4Enemies.ts - STAGE-4 (Ancient Logic) 固有敵クラス群 & ボス
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
    type EnemySpawnData
} from '../enemy.js';

export type Stage4GameContext = EnemyGameContext;

export interface WormHistoryPoint {
    x: number;
    y: number;
    angle: number;
    isSubmerged: boolean;
}

export interface PatrolPoint {
    x: number;
    y: number;
}

// ==========================================
// 1. STAGE-4 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 1. DustScout: 画面下部（砂塵の中から）逆噴射で「下から上へ」上昇してくる逆スクロール偵察機
 */
export class DustScoutEnemy extends Enemy {
    public speedY: number = -2.5;
    public hasShot: boolean = false;

    public override get imageName(): string { return "enemy_dust_scout.webp"; }

    constructor(game: Stage4GameContext, bulletType: BulletType = 'aim', hp: number = 1) {
        super(game, bulletType, hp);
    }

    public override update(game: Stage4GameContext): void {
        if (!this.active) return;

        this.y += this.speedY;

        if (this.y <= game.height / 2 && !this.hasShot) {
            this.shoot(game);
            this.hasShot = true;
        }

        if (this.y < -50) {
            this.active = false;
        }
    }

    public static override create(
        game: Stage4GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): DustScoutEnemy {
        return new DustScoutEnemy(game, bType, hp);
    }
}

/**
 * 2. RelicPrism: 八角形の古代パーツ。一定位置で静止・回転しながら幾何学的な格子状クロス弾幕を生成
 */
export class RelicPrismEnemy extends Enemy {
    public stopY: number = 120;
    public timer: number = 0;
    public rotationAngle: number = 0;
    public state: 'MOVE_IN' | 'ROTATE_FIRE' | 'RETREAT' = 'MOVE_IN';
    public baseShootInterval: number = 50;

    public override get imageName(): string { return "enemy_relic_prism.webp"; }

    constructor(game: Stage4GameContext, bulletType: BulletType = 'cross', hp: number = 3) {
        super(game, bulletType, hp);
        this.width = 80;
        this.height = 80;
    }

    public override update(game: Stage4GameContext): void {
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

                // 自動射撃＆画面内判定を親クラスに一任
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

    public static override create(
        game: Stage4GameContext,
        bType?: BulletType,
        hp?: number,
        data: EnemySpawnData = {}
    ): RelicPrismEnemy {
        const enemy = new RelicPrismEnemy(game, bType, hp);
        if (typeof data.stopY === 'number') enemy.stopY = data.stopY;
        return enemy;
    }
}

/**
 * 3. MirageCrawler: 砂漠の蜃気楼（ラスタスクロール波形）のようにX軸がブレながらゆっくり降下する機体
 */
export class MirageCrawlerEnemy extends Enemy {
    public speedY: number = 1.0;
    public timer: number = 0;
    public baseShootInterval: number = 80;

    public override get imageName(): string { return "enemy_mirage_crawler.webp"; }

    constructor(game: Stage4GameContext, bulletType: BulletType = 'aim', hp: number = 2) {
        super(game, bulletType, hp);
        this.timer = game.random.range(0, 100);
    }

    public override update(game: Stage4GameContext): void {
        if (!this.active) return;
        this.timer += 0.1;

        this.y += this.speedY;
        this.x = this.startX + Math.sin(this.timer) * 35;

        super.update(game);
    }

    public static override create(
        game: Stage4GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): MirageCrawlerEnemy {
        return new MirageCrawlerEnemy(game, bType, hp);
    }
}

/**
 * 4. SandPillar: 縦長柱状の防壁構造。前面からの通常弾を大幅軽減/跳ね返す無効化ガードを持つ
 */
export class SandPillarEnemy extends Enemy {
    public speedY: number = 0.5;
    public hitFlashTimer: number = 0;

    public override get imageName(): string { return "enemy_sand_pillar.webp"; }

    constructor(game: Stage4GameContext, bulletType: BulletType = 'none', hp: number = 5) {
        super(game, bulletType, hp);
        this.width = 64;
        this.height = (467 / 394) * 64;
    }

    public override update(_game: Stage4GameContext): void {
        if (!this.active) return;

        this.y += this.speedY;

        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer--;
        }
    }

    public override takeDamage(game: Stage4GameContext, amount: number): boolean {
        const reducedAmount = Math.max(1, Math.floor(amount * 0.5));
        this.hitFlashTimer = 5;
        return super.takeDamage(game, reducedAmount);
    }

    public override draw(ctx: CanvasRenderingContext2D, isDebug: boolean = false): void {
        ctx.save();
        if (this.hitFlashTimer > 0) {
            ctx.filter = 'brightness(3.0) contrast(1.5)';
        }
        super.draw(ctx, isDebug);
        ctx.restore();
    }

    public static override create(
        game: Stage4GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): SandPillarEnemy {
        return new SandPillarEnemy(game, bType, hp);
    }
}

/**
 * 5. GigaOrb: エネルギーチャージ（フラッシュ前兆）を行い、直線状に太い弾幕を一気に射出する高耐久コア
 */
export class GigaOrbEnemy extends Enemy {
    public state: 'CHARGE' | 'FIRE' | 'RETREAT' = 'CHARGE';
    public timer: number = 0;

    public override get imageName(): string { return "enemy_giga_orb.webp"; }

    constructor(game: Stage4GameContext, bulletType: BulletType = 'twin', hp: number = 10) {
        super(game, bulletType, hp);
        this.width = (510 / 440) * 48;
        this.height = 48;
    }

    public override update(game: Stage4GameContext): void {
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

                // 親クラスの bulletType='twin' 射撃を呼び出し
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

    public override draw(ctx: CanvasRenderingContext2D, isDebug: boolean = false): void {
        ctx.save();
        if (this.state === 'CHARGE') {
            const glow = Math.sin(this.timer * 0.3) * 0.5 + 0.5;
            ctx.filter = `brightness(${1.0 + glow * 1.5}) saturate(${1.0 + glow * 2.0})`;
        }
        super.draw(ctx, isDebug);
        ctx.restore();
    }

    public static override create(
        game: Stage4GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): GigaOrbEnemy {
        return new GigaOrbEnemy(game, bType, hp);
    }
}

/**
 * 6. RockEnemy: 超高速で垂直落下してくるデブリ・岩石型トラップ
 */
export class RockEnemy extends Enemy {
    public static readonly DEFAULT_SPEED_Y = 6.0;

    public speedX: number = -0.5;
    public speedY: number = RockEnemy.DEFAULT_SPEED_Y;

    public override get imageName(): string { return "enemy_rock.webp"; }

    constructor(game: Stage4GameContext, bulletType: BulletType = 'none', hp: number = 1) {
        super(game, bulletType, hp);
    }

    public override update(_game: Stage4GameContext): void {
        if (!this.active) return;
        this.x += this.speedX;
        this.y += this.speedY;
    }

    public static override create(
        game: Stage4GameContext,
        bType?: BulletType,
        hp?: number,
        data: EnemySpawnData = {}
    ): RockEnemy {
        const enemy = new RockEnemy(game, bType, hp);
        if (typeof data.speedY === 'number') enemy.speedY = data.speedY;
        return enemy;
    }
}

/**
 * 7. WormSegment: 連結エネミー（多関節）の胴体・尻尾パーツ
 */
export class WormSegment extends Enemy {
    public static readonly SEGMENT_SPACING = 20;

    public head: WormEnemy;
    public index: number;
    public isTail: boolean;
    public customImageKey: string;
    public angle: number = 0;
    public isSubmerged: boolean = false;

    constructor(game: Stage4GameContext, head: WormEnemy, index: number, isTail: boolean = false) {
        const imageKey = isTail ? "stage-4/enemy_worm_tail.webp" : "stage-4/enemy_worm_body.webp";
        super(game, 'none', 1);

        this.head = head;
        this.index = index;
        this.isTail = isTail;
        this.customImageKey = imageKey;

        this.image = game.assets?.get(imageKey);

        this.width = head.width || 24;
        this.height = head.height || 24;
    }

    public override get imageName(): string {
        return this.customImageKey || (this.isTail ? "stage-4/enemy_worm_tail.webp" : "stage-4/enemy_worm_body.webp");
    }

    public override update(_game: Stage4GameContext): void {
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
                this.y = this.head.y - this.index * WormSegment.SEGMENT_SPACING;
                this.angle = this.head.angle || 0;
            }
        } else {
            this.active = false;
        }
    }

    public override takeDamage(game: Stage4GameContext, amount: number): boolean {
        if (this.isSubmerged) return false;
        const isDead = super.takeDamage(game, amount);
        if (isDead && this.head) {
            this.head.removeSegment(this);
        }
        return isDead;
    }

    public override draw(ctx: CanvasRenderingContext2D, isDebug: boolean = false): void {
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
    public static readonly DEFAULT_LENGTH = 6;

    public speedY: number = 1.8;
    public moveDirectionY: number = 1;
    public timer: number = 0;
    public angle: number = 0;
    public isSubmerged: boolean = false;
    public history: WormHistoryPoint[] = [];
    public maxHistory: number;
    public segments: WormSegment[] = [];
    public baseX: number = 0;

    public override get imageName(): string { return "stage-4/enemy_worm_head.webp"; }

    constructor(
        game: Stage4GameContext,
        bulletType: BulletType = 'aim',
        hp: number = 5,
        length: number = WormEnemy.DEFAULT_LENGTH
    ) {
        super(game, bulletType, hp);

        if (game?.assets) {
            game.assets.get("stage-4/enemy_worm_body.webp");
            game.assets.get("stage-4/enemy_worm_tail.webp");
        }

        this.timer = game.random.range(0, 100);
        this.maxHistory = length * 10;

        if (game?.entities) {
            for (let i = 1; i < length; i++) {
                const isTail = i === length - 1;
                const seg = new WormSegment(game, this, i, isTail);
                this.segments.push(seg);
                game.entities.push(seg);
            }
        }
    }

    public override setStartPosition(x: number, y: number): void {
        super.setStartPosition(x, y);
        this.baseX = x;
    }

    public override update(game: Stage4GameContext): void {
        if (!this.active) return;
        this.timer += 0.04;

        const upperThreshold = game.height * 0.25;
        const lowerThreshold = game.height * 0.66;

        if (this.y >= lowerThreshold && this.moveDirectionY > 0) {
            this.moveDirectionY = -1;
            this.baseX = Math.max(80, Math.min(game.width - 80, this.baseX + (game.random.next() - 0.5) * 120));
        }

        if (this.y <= upperThreshold && this.moveDirectionY < 0) {
            this.moveDirectionY = 1;
            this.baseX = Math.max(80, Math.min(game.width - 80, this.baseX + (game.random.next() - 0.5) * 120));
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

        if (!this.isSubmerged && game.random.next() < 0.025) {
            this.shoot(game);
        }
    }

    public override takeDamage(game: Stage4GameContext, amount: number): boolean {
        if (this.isSubmerged) return false;
        return super.takeDamage(game, amount);
    }

    public override draw(ctx: CanvasRenderingContext2D, isDebug: boolean = false): void {
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

    public removeSegment(seg: WormSegment): void {
        const idx = this.segments.indexOf(seg);
        if (idx !== -1) {
            this.segments.splice(idx, 1);
            this.segments.forEach((s, i) => {
                s.index = i + 1;
            });
        }
    }

    public static override create(
        game: Stage4GameContext,
        bType?: BulletType,
        hp?: number,
        data: EnemySpawnData = {}
    ): WormEnemy {
        const len = typeof data.length === 'number' ? data.length : WormEnemy.DEFAULT_LENGTH;
        return new WormEnemy(game, bType, hp || 5, len);
    }
}

// ==========================================
// 2. STAGE-4 ボス実体
// ==========================================

/**
 * STAGE-4 ボス: 地上絵守護神（Ancient Golem / BossEnemy_04）
 */
export class BossEnemy_04 extends BossEnemy {
    public state: 'APPEAR' | 'PATROL_PATTERN' = 'APPEAR';
    public timer: number = 0;
    public targetPointIndex: number = 0;
    public points?: PatrolPoint[];

    public override get imageName(): string { return "enemy_boss_04.webp"; }

    constructor(
        game: Stage4GameContext,
        hp: number = 800,
        timeLimit?: number,
        timeMultiplier?: number
    ) {
        super(game, hp, timeLimit, timeMultiplier);

        this.isBoss = true;
        this.width = 128;
        this.height = 128;
        this.hitWidth = 100;
        this.hitHeight = 100;
    }

    public override setStartPosition(x: number, y: number): void {
        super.setStartPosition(x, y);
        this.points = [
            { x: this.startX - 80, y: 50 },
            { x: this.startX + 80, y: 120 },
            { x: this.startX, y: 80 }
        ];
    }

    public override update(game: Stage4GameContext): void {
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

            case 'PATROL_PATTERN': {
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
    }

    public static override create(
        game: Stage4GameContext,
        _bType?: BulletType,
        hp?: number,
        data: EnemySpawnData = {}
    ): BossEnemy_04 {
        return new BossEnemy_04(
            game,
            hp || 800,
            typeof data.timeLimit === 'number' ? data.timeLimit : undefined,
            typeof data.timeMultiplier === 'number' ? data.timeMultiplier : undefined
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