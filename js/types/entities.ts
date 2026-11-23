/*
 * PROJECT: VOID-CIRCUIT
 *
 * types/entities.ts - エンティティ・敵・当たり判定関連の型・契約インターフェース定義
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import type { AssetManager, Entity } from '../entities/base.js';
import type { Enemy } from '../entities/enemy.js';
import type { Bullet, Player } from '../entities/player.js';
import type { AudioManager } from '../systems/audio.js';
import type { InputManager } from '../systems/input.js';
import type { Random } from '../systems/random.js';
import type { ReplayManager } from '../systems/replayManager.js';

// ==========================================
// 1. 基本コンテキスト・入力型
// ==========================================

export interface BoundsContext {
    width: number;
    height: number;
}

export interface PlayerInputState {
    isTouching?: boolean;
    touchX?: number;
    touchY?: number;
    isRightClick?: boolean;
    isDoubleTap?: boolean;
    isCanvasOutClick?: boolean;
    isFiring?: boolean;
}

/**
 * 全エンティティが参照する Game の標準インターフェース
 */
export interface GameContext extends BoundsContext {
    isRunning: boolean;
    weaponMode: 'STRAIGHT' | 'WIDE';
    currentInputState?: PlayerInputState;
    random: Random;
    entities: Entity[];
    replay?: ReplayManager | null;
    stats: {
        shotsFired: number;
        enemiesSpawned: number;
    };
    sc: {
        assetBase: string;
        audio: AudioManager;
        input: InputManager;
        assets: AssetManager;
    };
}

// ==========================================
// 2. 敵・弾・スポーン関連型
// ==========================================

export type BulletType =
    | 'none'
    | 'straight'
    | 'twin'
    | 'triple'
    | 'parallel-3'
    | 'ring-6'
    | 'eight-way'
    | 'ring-8'
    | 'ring-12'
    | 'cross'
    | 'wave'
    | 'aim'
    | 'ring'
    | 'cluster'
    | (string & {});

export interface EnemySpawnData {
    frame?: number;
    type?: string;
    from?: string;
    dir?: string;
    x?: number;
    y?: number;
    hp?: number;
    bulletType?: BulletType;
    timeLimit?: number;
    timeMultiplier?: number;
    [key: string]: unknown;
}

export interface BossTargetLike {
    x: number;
    y: number;
    width?: number;
    height?: number;
    alive?: boolean;
}

/** 爆発エフェクト生成時に参照する最小限の敵情報 */
export interface ExplosionTargetLike {
    maxHp?: number;
    isBoss?: boolean;
}

/** Enemy / BossEnemy が参照する Game のインターフェース */
export interface EnemyGameContext extends GameContext {
    bulletSpeedMultiplier?: number;
    assets?: GameContext['sc']['assets'];
    player?: {
        x: number;
        y: number;
        width: number;
        height: number;
        alive: boolean;
        suctionForceX: number;
        suctionForceY: number;
        windForceX?: number;
    } | null;
    collisions?: {
        createExplosion(x: number, y: number, enemy: ExplosionTargetLike, soundoff?: boolean): void;
    };
}

/** レジストリに登録される敵クラスのコンストラクタ型 */
export interface EnemyConstructor {
    create(game: EnemyGameContext, bType?: BulletType, hp?: number, data?: EnemySpawnData): Enemy;
}

// ==========================================
// 3. 当たり判定・部位ヒットボックス関連型
// ==========================================

export type HitboxPartName = 'HEAD' | 'BODY' | 'CORE' | 'ARM' | (string & {});

export interface Hitbox {
    x: number;
    y: number;
    width: number;
    height: number;
    multiplier: number;
    part: HitboxPartName;
}

export type BossHitboxPart = Hitbox;

export interface HitResult {
    hit: boolean;
    multiplier: number;
    part?: HitboxPartName;
}

export interface CollidableRect {
    x: number;
    y: number;
    width: number;
    height: number;
    hitWidth?: number;
    hitHeight?: number;
}

export interface PlayerBulletLike extends Bullet {
    damage?: number;
    hitWidth?: number;
    hitHeight?: number;
}

export interface EnemyLike extends Entity {
    isInvincible?: boolean;
    isBoss?: boolean;
    maxHp?: number;
    timeLimit?: number;
    hitWidth?: number;
    hitHeight?: number;
    getHitboxes?: () => Hitbox[];
    takeDamage(game: GameCollisionContext, damage: number): boolean;
    onDie?: (game: GameCollisionContext, silent?: boolean) => void;
}

/** GameCollisionManager が参照する Game のインターフェース */
export interface GameCollisionContext extends GameContext {
    player: Player;
    uiHeaderHeight: number;
    score: number;
    frame: number;
    bossStartTime: number;
    stats: {
        shotsFired: number;
        shotsHit: number;
        enemiesSpawned: number;
        enemiesKilled: number;
    };
    scenario: {
        skipToAfterLoop(): void;
    };
    sc: GameContext['sc'] & {
        audio: GameContext['sc']['audio'] & {
            playCriticalHit?: () => void;
            playHitSound(): void;
            playExplosion(): void;
        };
    };
    onPlayerMiss(): void;
}