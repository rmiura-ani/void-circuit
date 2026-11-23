/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage6Enemies.ts - STAGE-6 (Burning Orbit) 固有敵クラス群 & ボス
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

export interface Stage6GameContext extends EnemyGameContext {
    player?: {
        x: number;
        y: number;
        width: number;
        height: number;
        alive?: boolean;
    } | null;
}

// ==========================================
// 1. STAGE-6 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 1. OrbitInterceptor: 大気圏突入（赤熱エフェクト）後、急ブレーキをかけてミサイルを放ち上空へ離脱する邀撃機
 */
export class OrbitInterceptorEnemy extends Enemy {
    public speedY: number = 6.0;
    public state: 'ENTRY' | 'BRAKE' | 'RETREAT' = 'ENTRY';
    public stateTimer: number = 0;

    public override get imageName(): string { return "enemy_orbit_interceptor.webp"; }

    constructor(game: Stage6GameContext, bulletType: BulletType = 'triple', hp: number = 2) {
        super(game, bulletType, hp);
    }

    public override update(game: Stage6GameContext): void {
        if (!this.active) return;
        this.stateTimer++;

        switch (this.state) {
            case 'ENTRY':
                this.y += this.speedY;
                if (this.y >= 140) {
                    this.state = 'BRAKE';
                    this.stateTimer = 0; // 状態遷移時にタイマーリセット
                    this.shoot(game);
                }
                break;

            case 'BRAKE':
                this.y += 0.5;
                if (this.stateTimer >= 90) { // ブレーキ状態を確実に90F維持
                    this.state = 'RETREAT';
                    this.stateTimer = 0;
                }
                break;

            case 'RETREAT':
                this.y -= 4.0;
                break;
        }
    }

    public override draw(ctx: CanvasRenderingContext2D, isDebug: boolean = false): void {
        ctx.save();
        if (this.state === 'ENTRY') {
            ctx.filter = 'brightness(1.8) saturate(2) drop-shadow(0px 0px 8px #FF4500)';
        }
        super.draw(ctx, isDebug);
        ctx.restore();
    }

    public static override create(
        game: Stage6GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): OrbitInterceptorEnemy {
        return new OrbitInterceptorEnemy(game, bType || 'triple', hp || 2);
    }
}

/**
 * 2. HeatArmor: 正面装甲（真下からの攻撃）を完全無効化する重装甲機
 */
export class HeatArmorEnemy extends Enemy {
    public speedY: number = 0.6;
    public override baseShootInterval: number = 70;

    public override get imageName(): string { return "enemy_heat_armor.webp"; }

    constructor(game: Stage6GameContext, bulletType: BulletType = 'straight', hp: number = 6) {
        super(game, bulletType, hp);
    }

    public override update(game: Stage6GameContext): void {
        if (!this.active) return;
        this.y += this.speedY;

        super.update(game);
    }

    /** 正面耐熱装甲：自機が正面（幅±20px以内）から攻撃した場合は無効化 */
    public override takeDamage(game: Stage6GameContext, amount: number): boolean {
        if (game.player) {
            const playerX = game.player.x + game.player.width / 2;
            const myX = this.x + this.width / 2;
            if (Math.abs(playerX - myX) < 20) {
                return false;
            }
        }
        return super.takeDamage(game, amount);
    }

    public static override create(
        game: Stage6GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): HeatArmorEnemy {
        return new HeatArmorEnemy(game, bType || 'straight', hp || 6);
    }
}

/**
 * 3. HomingPod: プレイヤーを追尾する弾を一定間隔で射出するポッド機
 */
export class HomingPodEnemy extends Enemy {
    public speedY: number = 0.8;
    public override baseShootInterval: number = 80;

    public override get imageName(): string { return "enemy_homing_pod.webp"; }

    constructor(game: Stage6GameContext, bulletType: BulletType = 'aim', hp: number = 2) {
        super(game, bulletType, hp);
    }

    public override update(game: Stage6GameContext): void {
        if (!this.active) return;
        this.y += this.speedY;

        super.update(game);
    }

    public static override create(
        game: Stage6GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): HomingPodEnemy {
        return new HomingPodEnemy(game, bType, hp);
    }
}

/**
 * 4. BeamCruiser: 高耐久・拡散弾放射の中型巡洋艦
 */
export class BeamCruiserEnemy extends Enemy {
    public speedY: number = 0.4;
    public override baseShootInterval: number = 40;

    public override get imageName(): string { return "enemy_beam_cruiser.webp"; }

    constructor(game: Stage6GameContext, bulletType: BulletType = 'triple', hp: number = 8) {
        super(game, bulletType, hp);
        this.width = 80;
        this.height = 48;
    }

    public override update(game: Stage6GameContext): void {
        if (!this.active) return;
        this.y += this.speedY;

        super.update(game);
    }

    public static override create(
        game: Stage6GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): BeamCruiserEnemy {
        return new BeamCruiserEnemy(game, bType || 'triple', hp || 8);
    }
}

/**
 * 5. BurnerDrone: 画面下部から上昇しながら弾を突き上げるバーナー機
 */
export class BurnerDroneEnemy extends Enemy {
    public speedY: number = -1.8;
    public override baseShootInterval: number = 20;
    public baseX?: number;

    public override get imageName(): string { return "enemy_burner_drone.webp"; }

    constructor(game: Stage6GameContext, bulletType: BulletType = 'straight', hp: number = 3) {
        super(game, bulletType, hp);
    }

    public override setStartPosition(x: number, y: number): void {
        super.setStartPosition(x, y);
        this.baseX = x;
    }

    public override update(game: Stage6GameContext): void {
        if (!this.active) return;
        this.y += this.speedY;

        super.update(game);

        if (this.y < -50) {
            this.active = false;
        }
    }

    public static override create(
        game: Stage6GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): BurnerDroneEnemy {
        return new BurnerDroneEnemy(game, bType || 'straight', hp || 3);
    }
}

// ==========================================
// 2. STAGE-6 ボス実体
// ==========================================

/**
 * STAGE-6 ボス: 超巨大空中戦艦（Burning Dread / BossEnemy_06）
 */
export class BossEnemy_06 extends BossEnemy {
    public state: 'APPEAR' | 'HEAVY_BOMBARD' | 'OVERDRIVE' = 'APPEAR';
    public override timer: number = 0;
    public baseX?: number;

    public override get imageName(): string { return "enemy_boss_06.webp"; }

    constructor(
        game: Stage6GameContext,
        hp: number = 120,
        timeLimit?: number,
        timeMultiplier?: number
    ) {
        super(game, hp, timeLimit, timeMultiplier);

        this.isBoss = true;
        this.width = (802 / 322) * 100;
        this.height = 100;
        this.hitWidth = 220;
        this.hitHeight = 80;
    }

    public override setStartPosition(x: number, y: number): void {
        super.setStartPosition(x, y);
        this.baseX = x;
    }

    public override update(game: Stage6GameContext): void {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.4;
                if (this.y >= 20) {
                    this.state = 'HEAVY_BOMBARD';
                    this.timer = 0;
                }
                break;

            case 'HEAVY_BOMBARD': {
                const bx1 = this.baseX ?? this.startX;
                this.x = bx1 + Math.sin(this.timer * 0.1) * 15;

                if (this.timer % 30 === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }

                // HP50%以下で過熱発狂モードへ
                if (this.hp < this.maxHp * 0.5) {
                    this.state = 'OVERDRIVE';
                    this.timer = 0;
                }
                break;
            }

            case 'OVERDRIVE': {
                const bx2 = this.baseX ?? this.startX;
                this.x = bx2 + Math.sin(this.timer * 0.2) * 30;

                if (this.timer % 12 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                if (this.timer % 20 === 0) {
                    this.bulletType = 'straight';
                    this.shoot(game);
                }
                break;
            }
        }
    }

    public override draw(ctx: CanvasRenderingContext2D, isDebug: boolean = false): void {
        ctx.save();
        if (this.state === 'OVERDRIVE') {
            ctx.filter = 'saturate(3) contrast(1.5) brightness(1.3)';
        }
        super.draw(ctx, isDebug);
        ctx.restore();
    }

    public static override create(
        game: Stage6GameContext,
        _bType?: BulletType,
        hp?: number,
        data: EnemySpawnData = {}
    ): BossEnemy_06 {
        return new BossEnemy_06(
            game,
            hp || 120,
            typeof data.timeLimit === 'number' ? data.timeLimit : undefined,
            typeof data.timeMultiplier === 'number' ? data.timeMultiplier : undefined
        );
    }
}

// ==========================================
// 3. ENEMY_REGISTRY への自動登録
// ==========================================

ENEMY_REGISTRY.set('orbit_interceptor', OrbitInterceptorEnemy);
ENEMY_REGISTRY.set('heat_armor', HeatArmorEnemy);
ENEMY_REGISTRY.set('homing_pod', HomingPodEnemy);
ENEMY_REGISTRY.set('beam_cruiser', BeamCruiserEnemy);
ENEMY_REGISTRY.set('burner_drone', BurnerDroneEnemy);
ENEMY_REGISTRY.set('boss_06', BossEnemy_06);