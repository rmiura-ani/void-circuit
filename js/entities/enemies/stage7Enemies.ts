/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage7Enemies.ts - STAGE-7 (Absolute Core) 固有敵クラス群 & ラストボス
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

export interface Stage7GameContext extends EnemyGameContext {
    player?: {
        x: number;
        y: number;
        width: number;
        height: number;
        alive?: boolean;
    } | null;
}

// ==========================================
// 1. STAGE-7 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 1. CircuitWalker: 背景の電子グリッドに沿うようにカクカクと90度直角に曲がりながら迫る電子プログラム機
 */
export class CircuitWalkerEnemy extends Enemy {
    public vx: number = 0;
    public vy: number = 2.0;
    public timer: number = 0;
    public turnInterval: number = 60; // 60Fごとに直角ターン

    public override get imageName(): string { return "enemy_circuit_walker.webp"; }

    constructor(game: Stage7GameContext, bulletType: BulletType = 'none', hp: number = 2) {
        super(game, bulletType, hp);
    }

    public override update(game: Stage7GameContext): void {
        if (!this.active) return;
        this.timer++;

        this.x += this.vx;
        this.y += this.vy;

        // グリッド線に沿うように90度直角ターンを繰り返す
        if (this.timer % this.turnInterval === 0) {
            if (this.vy !== 0) {
                this.vy = 0;
                this.vx = this.x < game.width / 2 ? 2.5 : -2.5; // 画面中央方向へ曲がる
            } else {
                this.vx = 0;
                this.vy = 2.5; // 再び下降
                this.shoot(game);
            }
        }
    }

    public static override create(
        game: Stage7GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): CircuitWalkerEnemy {
        return new CircuitWalkerEnemy(game, bType, hp || 2);
    }
}

/**
 * 2. VoidBit: 自機の周囲を円軌道で周回しながら中心に向けて高密度射撃を行う電子ビット機
 */
export class VoidBitEnemy extends Enemy {
    public angle: number = 0;
    public radius: number = 120; // 自機からの周回半径
    public timer: number = 0;
    public baseShootInterval: number = 50;

    public override get imageName(): string { return "enemy_void_bit.webp"; }

    constructor(game: Stage7GameContext, bulletType: BulletType = 'aim', hp: number = 1) {
        super(game, bulletType, hp);
        this.width = 24;
        this.height = 24;
        this.angle = game.random.angle();
    }

    public override update(game: Stage7GameContext): void {
        if (!this.active) return;
        this.timer++;
        this.angle += 0.04; // 円周運動

        // 自機が存在すれば、自機を中心に円運動を行う
        if (game.player?.alive) {
            const px = game.player.x + game.player.width / 2;
            const py = game.player.y + game.player.height / 2;
            this.x = px + Math.cos(this.angle) * this.radius - this.width / 2;
            this.y = py + Math.sin(this.angle) * this.radius - this.height / 2;
        } else {
            this.y += 2.0;
        }

        super.update(game);

        // 4秒経過（240F）で消滅
        if (this.timer >= 240) {
            this.active = false;
        }
    }

    public static override create(
        game: Stage7GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): VoidBitEnemy {
        return new VoidBitEnemy(game, bType, hp);
    }
}

/**
 * 3. GateKeeper: 画面中央を左右に陣取り、格子状（レーザー）の弾幕の壁を作る中型要塞防衛機
 */
export class GateKeeperEnemy extends Enemy {
    public speedX: number = 1.5;
    public baseShootInterval: number = 30;

    public override get imageName(): string { return "enemy_gate_keeper.webp"; }

    constructor(game: Stage7GameContext, bulletType: BulletType = 'eight-way', hp: number = 8) {
        super(game, bulletType, hp);
        this.width = (528 / 312) * 48;
        this.height = 48;
    }

    public override update(game: Stage7GameContext): void {
        if (!this.active) return;

        this.y += 0.3; // 非常にゆっくり下降
        this.x += this.speedX;

        if (this.x < 30 || this.x > game.width - 30 - this.width) {
            this.speedX = -this.speedX; // 画面端で反転
        }

        super.update(game);
    }

    public static override create(
        game: Stage7GameContext,
        bType?: BulletType,
        hp?: number,
        _data: EnemySpawnData = {}
    ): GateKeeperEnemy {
        return new GateKeeperEnemy(game, bType || 'eight-way', hp || 8);
    }
}

// ==========================================
// 2. STAGE-7 最終ボス実体（第1形態 / 第2形態 トランスフォーム）
// ==========================================

/**
 * STAGE-7 ボス: 最終要塞機械心臓（Absolute Core / BossEnemy_07）
 * 特徴: HP50%以下で変形演出に入り【第2形態（Overlord）】へと覚醒・変身するラストボス
 */
export class BossEnemy_07 extends BossEnemy {
    public state: 'APPEAR' | 'CORE_PHASE_1' | 'TRANSFORM' | 'FINAL_OVERLORD' = 'APPEAR';
    public timer: number = 0;
    public formPhase: 1 | 2 = 1;
    public override isInvincible: boolean = false;
    public baseX?: number;

    // 形態に応じて自動的に画像パスを切り替え
    public override get imageName(): string {
        return this.formPhase === 2 ? "enemy_boss_07_phase2.webp" : "enemy_boss_07_phase1.webp";
    }

    constructor(
        game: Stage7GameContext,
        hp: number = 150,
        timeLimit?: number,
        timeMultiplier?: number
    ) {
        super(game, hp, timeLimit, timeMultiplier);
        this.isBoss = true;
        this.width = (747 / 312) * 120;
        this.height = 120;
        this.hitWidth = 270;
        this.hitHeight = 100;
    }

    public override setStartPosition(x: number, y: number): void {
        super.setStartPosition(x, y);
        this.baseX = x;
    }

    public override update(game: Stage7GameContext): void {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.5;
                if (this.y >= 35) {
                    this.state = 'CORE_PHASE_1';
                    this.timer = 0;
                }
                break;

            case 'CORE_PHASE_1': {
                const bx1 = this.baseX ?? this.startX;
                this.x = bx1 + Math.sin(this.timer * 0.01) * 35;

                const intEight = Math.max(1, Math.floor(40 / (this.fireRateMultiplier || 1)));
                if (this.timer % intEight === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }

                const intAim = Math.max(1, Math.floor(25 / (this.fireRateMultiplier || 1)));
                if (this.timer % intAim === 0) {
                    this.bulletType = 'aim';
                    this.shoot(game);
                }

                // ギミック：HPが50%を切ると第2形態変形演出を発動
                if (this.hp < this.maxHp / 2) {
                    this.formPhase = 2;
                    this.state = 'TRANSFORM';
                    this.timer = 0;
                }
                break;
            }

            case 'TRANSFORM': {
                // 変形中の2秒間（120F）は無敵状態
                this.isInvincible = true;
                const bx2 = this.baseX ?? this.startX;
                this.x = bx2 + Math.sin(this.timer * 0.6) * 6; // 超高速振動

                // 最初の1フレーム目で第2形態画像をバックグラウンドロード開始
                if (this.timer === 1 && game?.assets) {
                    game.assets.get("enemy_boss_07_phase2.webp");
                }

                if (this.timer > 120) {
                    this.isInvincible = false; // 無敵解除
                    this.state = 'FINAL_OVERLORD';
                    this.timer = 0;
                }
                break;
            }

            case 'FINAL_OVERLORD': {
                // 最終暴走状態の移動と攻撃
                const bx3 = this.baseX ?? this.startX;
                this.x = bx3 + Math.sin(this.timer * 0.04) * 80;
                this.y = 35 + Math.cos(this.timer * 0.03) * 15;

                if (this.timer % 15 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                if (this.timer % 10 === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }
                break;
            }
        }
    }

    /** 変形演出中（isInvincible = true）はすべての被ダメージを無効化 */
    public override takeDamage(game: Stage7GameContext, amount: number): boolean {
        if (this.isInvincible) return false;
        return super.takeDamage(game, amount);
    }

    public override draw(ctx: CanvasRenderingContext2D, isDebug: boolean = false): void {
        ctx.save();

        if (this.state === 'TRANSFORM') {
            const flash = 2.0 + Math.sin(this.timer * 0.8) * 1.5;
            ctx.filter = `contrast(3) brightness(${flash})`;
        } else if (this.formPhase === 2) {
            ctx.filter = 'saturate(3) contrast(1.4) drop-shadow(0px 0px 18px #FF0055)';
        }

        super.draw(ctx, isDebug);
        ctx.restore();
    }

    public static override create(
        game: Stage7GameContext,
        _bType?: BulletType,
        hp?: number,
        data: EnemySpawnData = {}
    ): BossEnemy_07 {
        return new BossEnemy_07(
            game,
            hp || 150,
            typeof data.timeLimit === 'number' ? data.timeLimit : undefined,
            typeof data.timeMultiplier === 'number' ? data.timeMultiplier : undefined
        );
    }
}

// ==========================================
// 3. ENEMY_REGISTRY への自動登録
// ==========================================

ENEMY_REGISTRY.set('circuit_walker', CircuitWalkerEnemy);
ENEMY_REGISTRY.set('void_bit', VoidBitEnemy);
ENEMY_REGISTRY.set('gate_keeper', GateKeeperEnemy);
ENEMY_REGISTRY.set('boss_07', BossEnemy_07);