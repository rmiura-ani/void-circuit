/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemy.js - 敵クラス・ボス基底クラス & レジストリシステム
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import { Entity } from './base.js';

// ==========================================
// 1. 全敵クラス動的自動登録レジストリ (ENEMY_REGISTRY)
// ==========================================

/**
 * 敵タイプ名（'straight', 'boss_01' 等）とクラス定義を1対1でマッピングするグローバルマップ
 */
export const ENEMY_REGISTRY = new Map();


// ==========================================
// 2. 敵キャラクター抽象基底クラス (Enemy)
// ==========================================

export class Enemy extends Entity {
    // x, y を引数から外し、一旦 0 で初期化する
    constructor(game, bulletType, hp = 1) {
        super(0, 0, 32, 32); // 親クラス(Entity)には仮の0を渡しておく

        this.bulletType = bulletType;
        this.speed = 2;
        this.hp = hp;
        this.maxHp = hp;

        // 🎯 初期位置記憶用プロパティ
        this.startX = 0;
        this.startY = 0;

        // 画面内侵入フラグ（下・横からの出現に対応するための重要フラグ）
        this.hasEnteredScreen = false;

        // 射撃共通タイマー
        this.shootTimer = game.random.range(0, 60);
        this.baseShootInterval = 120; 
        this.fireRateMultiplier = 1.0;
        this.bulletSpeedMultiplier = 1.0;
        this.wayBonus = 0;
        
        // アセット読み込み
        this._loadAsset(game);
    }

    /**
     * 🎯 生成・配置システム（spawnEnemy等）から呼び出して初期座標を設定・記憶する関数
     * @param {number} x 初期X座標
     * @param {number} y 初期Y座標
     */
    setStartPosition(x, y) {
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
    }

    /** アセット読み込みの共通化 */
    _loadAsset(game) {
        if (game?.assets) {
            this.image = game.assets.get(this.imageName);
            this.isLoaded = !!this.image; 
            this.loadError = !this.isLoaded;
            if (this.loadError) console.warn(`[Asset Error] Failed to find: ${this.imageName}`);
        } else {
            this.isLoaded = false;
            this.loadError = true;
        }
    }

    /**
     * 画面外削除判定（上・下・左右の全出現方向に対応）
     * @param {number} margin 許容マージン
     */
    isOutOfBounds(game, margin = 64) {
        // NaN ガードは親クラスのものを利用
        if (Number.isNaN(this.x) || Number.isNaN(this.y)) return true;

        // 1. 一度画面内に入った後の消滅判定（上・下・左・右の画面外へ出たら削除）
        if (this.hasEnteredScreen) {
            return (
                this.x < -margin ||
                this.x > game.width + margin ||
                this.y < -margin ||
                this.y > game.height + margin
            );
        }

        // 2. まだ画面内に入っていない（画面外からの登場待ち状態）：極端な暴走ガード
        const ABSOLUTE_LIMIT = 2000;
        return (
            this.x < -ABSOLUTE_LIMIT || 
            this.x > ABSOLUTE_LIMIT || 
            this.y < -ABSOLUTE_LIMIT ||
            this.y > ABSOLUTE_LIMIT
        );
    }

    /** 
     * 共通の更新処理（メインルーチン） 
     */
    update(game) {
        if (!this.active) return;

        // 【見直しポイント】画面内に入ったかどうかをチェックしてフラグを立てる
        if (!this.hasEnteredScreen) {
            if (
                this.x + this.width > 0 &&
                this.x < game.width &&
                this.y + this.height > 0 &&
                this.y < game.height
            ) {
                this.hasEnteredScreen = true;
            }
        }

        // 基本射撃判定（画面内かつ生存時のみ）
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

    shoot(game) {
        if (!game) return;

        // 難易度パラメータの取得（デフォルト1.0 / 0）
        const bSpeedMult = this.bulletSpeedMultiplier ?? 1.0;
        const wayBonus = this.wayBonus ?? 0;

        // 発射位置の基本値
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2; 

        // 自機への角度計算（自機がいない場合は真下 Math.PI / 2）
        let angle = Math.PI / 2;
        if (game.player) {
            const targetX = game.player.x + game.player.width / 2;
            const targetY = game.player.y + game.player.height / 2;
            angle = Math.atan2(targetY - by, targetX - bx);
        }

        const spawn = (vx, vy, customX = bx, customY = by) => {
            // 弾速倍率を乗算して登録
            game.entities.push(new EnemyBullet(customX, customY, vx * bSpeedMult, vy * bSpeedMult));
        };

        switch (this.bulletType) {
            case 'none':
                break;

            case 'straight':
                spawn(0, 4);
                break;

            case 'twin': {
                // 2連並列弾
                const offsetX = 8;
                const speedY = 6.0;
                spawn(0, speedY, bx - offsetX, by);
                spawn(0, speedY, bx + offsetX, by);
                break;
            }

            case 'triple': {
                // wayBonusを反映した扇状拡散弾（基本3WAY -> EASY:2WAY / HARD:4WAY / VERY HARD:5WAY）
                const baseWays = 3;
                const totalWays = Math.max(1, baseWays + wayBonus);
                const spreadAngle = 0.6; // 拡散範囲（放射角）

                if (totalWays === 1) {
                    spawn(Math.cos(angle) * 3, Math.sin(angle) * 3);
                } else {
                    const startAngle = angle - spreadAngle / 2;
                    const step = spreadAngle / (totalWays - 1);
                    for (let i = 0; i < totalWays; i++) {
                        const a = startAngle + step * i;
                        spawn(Math.cos(a) * 3, Math.sin(a) * 3);
                    }
                }
                break;
            }

            case 'parallel-3': {
                // 正面真下に並列弾（wayBonusで左右に並列追加も可能）
                const spd = (this.bulletSpeed || 4.0);
                const spawnY = this.y + this.height; // 足元から発射
                spawn(0, spd + 0.5, bx, spawnY);
                spawn(0, spd, bx - 10, spawnY - 5);
                spawn(0, spd, bx + 10, spawnY - 5);

                // HARD以上（wayBonus > 0）なら外側に追加
                if (wayBonus > 0) {
                    spawn(0, spd - 0.5, bx - 20, spawnY - 10);
                    spawn(0, spd - 0.5, bx + 20, spawnY - 10);
                }
                break;
            }

            case 'ring-6':
                this.shootRing(game, 6 + wayBonus, 2.0);
                break;

            case 'eight-way':
            case 'ring-8':
                this.shootRing(game, 8 + wayBonus, 3.0);
                break;

            case 'ring-12':
                this.shootRing(game, 12 + wayBonus, 3.0);
                break;

            case 'cross': {
                // 回転角 (rotationAngle) を反映した4方向クロス弾
                const angleOffset = this.rotationAngle || 0;
                const speed = 3.0;
                for (let i = 0; i < 4; i++) {
                    const a = angleOffset + (Math.PI / 2) * i;
                    spawn(Math.cos(a) * speed, Math.sin(a) * speed);
                }
                break;
            }

            case 'wave': {
                // 波紋拡散弾（基本3WAY -> wayBonus反映）
                const baseAngle = Math.PI / 2; // 真下方向
                const timer = this.timer ?? this.frame ?? 0;
                const waveOffset = Math.sin(timer * 0.2) * 0.15;
                const totalWays = Math.max(1, 3 + wayBonus);
                const spreadAngle = 0.8;

                if (totalWays === 1) {
                    const a = baseAngle + waveOffset;
                    spawn(Math.cos(a) * 2.8, Math.sin(a) * 2.8);
                } else {
                    const start = baseAngle - spreadAngle / 2 + waveOffset;
                    const step = spreadAngle / (totalWays - 1);
                    for (let i = 0; i < totalWays; i++) {
                        const a = start + step * i;
                        spawn(Math.cos(a) * 2.8, Math.sin(a) * 2.8);
                    }
                }
                break;
            }

            case 'aim':
                spawn(Math.cos(angle) * 4, Math.sin(angle) * 4);
                break;

            default:
                spawn(Math.cos(angle) * 4, Math.sin(angle) * 4);
                console.log(`[System] Illigal bulletType frame: ${this.this.bulletType}`);
                break;

            }
    }
    
    shootRing(game, count, speed) {
        if (!game) return;

        const countFinal = Math.max(3, count); // 最低3方向は確保
        const bSpeedMult = game.bulletSpeedMultiplier ?? 1.0;
        const finalSpeed = speed * bSpeedMult;

        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;

        for (let i = 0; i < countFinal; i++) {
            const angle = (Math.PI * 2 / countFinal) * i;
            const vx = Math.cos(angle) * finalSpeed;
            const vy = Math.sin(angle) * finalSpeed;
            game.entities.push(new EnemyBullet(bx, by, vx, vy));
        }
    }

    /**
     * 被ダメージ処理
     */
    takeDamage(game, amount) {
        if (!this.active) return false;
        this.hp -= amount;

        if (this.hp <= 0) {
            this.active = false;
            
            // 🎯 撃破時特有の弾発散ロジックを親クラスで一括制御
            if (this.bulletType === 'ring' || this.bulletType === 'cluster') {
                this.burstBullets(game, 6, 1.8);
            }

            this.onDie(game);
            return true;
        }
        return false;
    }

    /**
     * 撃破時や特定イベントで周囲に全方位・リング状に弾を撒き散らす汎用メソッド
     */
    burstBullets(game, count = 6, speed = 2.0) {
        if (!game) return;
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            game.entities.push(new EnemyBullet(bx, by, vx, vy));
        }
    }
    
    draw(ctx, isDebug = false) {
        ctx.save();

        const gameWidth = ctx.canvas.width;
        const gameHeight = ctx.canvas.height;
        const isHeaderArea = 32;

        if (
            this.y + this.height < isHeaderArea ||
            this.y >= gameHeight ||
            this.x + this.width <= 0 ||
            this.x >= gameWidth
        ) {
            ctx.globalAlpha = (Math.floor(Date.now() / 33) % 2 === 0) ? 0.15 : 0.60;
        }

        if (this.image && this.image.complete && this.image.naturalWidth > 0) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = this.loadError ? '#F00' : '#444';
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 2;
            
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeRect(this.x, this.y, this.width, this.height);

            if (this.loadError) {
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + this.width, this.y + this.height);
                ctx.moveTo(this.x + this.width, this.y);
                ctx.lineTo(this.x, this.y + this.height);
                ctx.stroke();
            }
        }

        // デバッグ枠（ヒットボックス）の表示制御
        if (isDebug) {
            ctx.lineWidth = 1.5;

            if (typeof this.getHitboxes === 'function') {
                const hitboxes = this.getHitboxes();

                for (const box of hitboxes) {
                    const isWeakSpot = box.multiplier && box.multiplier > 1.0;
                    ctx.strokeStyle = isWeakSpot ? '#FF0055' : 'lime';
                    ctx.fillStyle = isWeakSpot ? 'rgba(255, 0, 85, 0.2)' : 'rgba(0, 255, 0, 0.1)';

                    ctx.fillRect(box.x, box.y, box.width, box.height);
                    ctx.strokeRect(box.x, box.y, box.width, box.height);

                    if (box.part) {
                        ctx.fillStyle = ctx.strokeStyle;
                        ctx.font = 'bold 9px sans-serif';
                        ctx.fillText(`${box.part} (x${box.multiplier || 1})`, box.x + 2, box.y + 10);
                    }
                }
            } 
            else {
                ctx.strokeStyle = 'lime';
                const hw = this.hitWidth || this.width;
                const hh = this.hitHeight || this.height;
                ctx.strokeRect(
                    this.x + (this.width - hw) / 2, 
                    this.y + (this.height - hh) / 2, 
                    hw, hh
                );
            }
        }
        ctx.restore();
    }

    onDie(game, soundoff = false) {
        game.collisions.createExplosion(this.x + this.width / 2, this.y + this.height / 2, this, soundoff);
    }

    static create(game, bType, hp, data = {}) {
        return new Enemy(game, bType, hp);
    }
}

// ==========================================
// 3. ボスキャラクター抽象基底クラス (BossEnemy)
// ==========================================

export class BossEnemy extends Enemy {
    constructor(game, hp = 100, timeLimit = 1800, timeMultiplier = 100) {
        super(game, 'none', hp);    // ボスの弾は、各クラスで実装。
        this.timeLimit = timeLimit;
        this.timeMultiplier = timeMultiplier;
        this.isBoss = true;
    }
    
    onDie(game, soundoff = false) {
        super.onDie(game, soundoff);

        const bx = this.x;
        const by = this.y;
        const bw = this.width;
        const bh = this.height;

        const explosionCount = 8;
        const intervalMs = 150;

        for (let i = 0; i < explosionCount; i++) {
            setTimeout(() => {
                if (!game?.collisions) return;

                const shouldPlaySound = !soundoff && (i === 0 || i === 3 || i === 7);

                game.collisions.createExplosion(
                    bx + game.random.next() * bw, 
                    by + game.random.next() * bh, 
                    this,
                    !shouldPlaySound
                );
            }, i * intervalMs);
        }
    }
}

// ==========================================
// 4. データ駆動型ファクトリ関数 (createEnemyInstance)
// ==========================================

/**
 * レジストリを経由して動的に敵インスタンス（または演出）を生成する
 */
export function createEnemyInstance(game, type, bType, hp, data = {}) {
    const EnemyClass = ENEMY_REGISTRY.get(type);

    if (EnemyClass) {
        return EnemyClass.create(game, bType, hp, data);
    }

    console.warn(`[Enemy Registry Warning] Unknown enemy type: '${type}'. Falling back to default 'straight'.`);
    const FallbackClass = ENEMY_REGISTRY.get('straight');
    if (FallbackClass) {
        return FallbackClass.create(game, bType, hp, data);
    }

    return new Enemy(game, bType, hp);
}

/**
 * 敵の弾クラス
 */
export class EnemyBullet extends Entity {
    constructor(x, y, vx, vy) {
        super(x, y, 4, 4);
        this.vx = vx;
        this.vy = vy;
        this.renderRadius = 3;
    }

    /** 敵弾の移動更新と画面外判定 */
    update(game) {
        this.x += this.vx;
        this.y += this.vy;
    }

    /** 敵弾を描画する */
    draw(ctx) {
        ctx.fillStyle = '#F0F';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.renderRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}