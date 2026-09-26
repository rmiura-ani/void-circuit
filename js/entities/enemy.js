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
import { WarningEffect } from './effects.js';

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
    constructor(game, x, y, bulletType, hp = 1) {
        super(x, y, 32, 32);
        this.game = game;
        this.bulletType = bulletType || 'aim';
        this.speed = 2;
        this.hp = hp;
        this.maxHp = hp;
        this.isEnemy = true; // 敵判定用フラグ

        // 射撃共通タイマー
        this.shootTimer = Math.random() * 60;
        this.baseShootInterval = 120; 
        this.fireRateMultiplier = 1.0;
        
        // アセット読み込み
        this._loadAsset(game);
    }

    get imageName() { return "enemy_straight.webp"; }

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
     * 共通の画面外判定（弾や通常エフェクト用）
     * @param {number} margin 許容マージン
     */
    isOutOfBounds(margin = 64) {
        // NaN ガードは親クラスのものを利用
        if (Number.isNaN(this.x) || Number.isNaN(this.y)) return true;

        const gameWidth = typeof GAME_CONFIG !== 'undefined' ? game.width : 800;
        const gameHeight = typeof GAME_CONFIG !== 'undefined' ? game.height : 600;

        // 1. 下方向に画面外へ抜けたら削除（シューティングの敵の基本）
        if (this.y > gameHeight + margin) return true;

        // 2. 画面上・左右へ逃げる敵のための判定（一度画面内に入ったかどうかで切り替えると安全）
        if (this.hasEnteredScreen) {
            // 一度画面内に入った後、画面外へ大きく離脱したら削除
            return (
                this.x < -margin * 2 ||
                this.x > gameWidth + margin * 2 ||
                this.y < -margin * 2
            );
        } else {
            // まだ画面に出ていない（画面外から登場中）：出現限界を超えたら削除
            const ABSOLUTE_LIMIT = 2000;
            return (
                this.x < -ABSOLUTE_LIMIT || 
                this.x > ABSOLUTE_LIMIT || 
                this.y < -ABSOLUTE_LIMIT
            );
        }
    }

    /** 
     * 共通の更新処理（メインルーチン） 
     * 基本敵の移動・画面外削除・射撃判定をすべて1つに統合。
     * サブクラスで特有の移動や射撃パターンを持つ場合は update(game) 全体をオーバーライドします。
     */
    update(game) {
        if (!this.active) return;

        // 1. 基本移動（直進下降）
        this.y += this.speed;

        // 2. 基本射撃判定（画面内かつ生存時のみ）
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
        if (!game?.player) return;

        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2; 
        const targetX = game.player.x + game.player.width / 2;
        const targetY = game.player.y + game.player.height / 2;
        const angle = Math.atan2(targetY - by, targetX - bx);

        const spawn = (vx, vy) => game.entities.push(new EnemyBullet(bx, by, vx, vy));

        switch (this.bulletType) {
            case 'eight-way':
                for (let i = 0; i < 8; i++) {
                    const a = (Math.PI * 2 / 8) * i;
                    spawn(Math.cos(a) * 3, Math.sin(a) * 3);
                }
                break;
            case 'straight':
                spawn(0, 4);
                break;
            case 'triple':
                [-0.3, 0, 0.3].forEach(off => 
                    spawn(Math.cos(angle + off) * 3, Math.sin(angle + off) * 3)
                );
                break;
            case 'aim':
            default:
                spawn(Math.cos(angle) * 4, Math.sin(angle) * 4);
                break;
        }
    }

    /**
     * 被ダメージ処理（外部およびサブクラスから呼ばれる必須処理）
     * @param {number} amount ダメージ量
     * @returns {boolean} 撃破されたかどうか (true: 死亡, false: 生存)
     */
    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.active = false;
            return true;
        }
        return false;
    }
    
    draw(ctx) {
        ctx.save();

        const isHeaderArea = typeof GAME_CONFIG !== 'undefined' ? game.uiHeaderHeight : 40;
        const gameWidth = typeof GAME_CONFIG !== 'undefined' ? game.width : 320;
        const gameHeight = typeof GAME_CONFIG !== 'undefined' ? game.height : 480;

        if (
            this.y + this.height < isHeaderArea ||
            this.y >= gameHeight ||
            this.x + this.width <= 0 ||
            this.x >= gameWidth
        ) {
            ctx.globalAlpha = (Math.floor(Date.now() / 33) % 2 === 0) ? 0.15 : 0.60;
        }

        // 💡 画像が存在し、読み込みが完了しており、かつ破損していない (naturalWidth > 0) ことを直接確認
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

        // 🎯 デバッグ枠（ヒットボックス）の表示制御
        if (this.game.isInvincibleCheat) {
            ctx.lineWidth = 1.5;

            // 💡 1. ボスなどマルチヒットボックス(getHitboxes)を持っている場合
            if (typeof this.getHitboxes === 'function') {
                const hitboxes = this.getHitboxes();

                for (const box of hitboxes) {
                    // 弱点（ダメージ倍率 > 1.0）は赤〜ピンク、通常部分は緑で色分け
                    const isWeakSpot = box.multiplier && box.multiplier > 1.0;
                    ctx.strokeStyle = isWeakSpot ? '#FF0055' : 'lime';
                    ctx.fillStyle = isWeakSpot ? 'rgba(255, 0, 85, 0.2)' : 'rgba(0, 255, 0, 0.1)';

                    // 塗りつぶしと枠線を描画
                    ctx.fillRect(box.x, box.y, box.width, box.height);
                    ctx.strokeRect(box.x, box.y, box.width, box.height);

                    // 部位名・倍率のテキスト表示（※不要な場合は削除可）
                    if (box.part) {
                        ctx.fillStyle = ctx.strokeStyle;
                        ctx.font = 'bold 9px sans-serif';
                        ctx.fillText(`${box.part} (x${box.multiplier || 1})`, box.x + 2, box.y + 10);
                    }
                }
            } 
            // 💡 2. 従来の単一ヒットボックス（雑魚敵など）
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
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        if (game?.collisions) {
            game.collisions.createExplosion(centerX, centerY, this, soundoff);
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new Enemy(game, x, y, bType, data.hp || 1);
    }
}

// ==========================================
// 3. ボスキャラクター抽象基底クラス (BossEnemy)
// ==========================================

export class BossEnemy extends Enemy {
    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        const bulletType = "aim";
        super(game, x, y, bulletType, hp);
        this.timeLimit = timeLimit || 1800;
        this.timeMultiplier = timeMultiplier || 100;
        this.isBoss = true;
    }
    
    onDie(game, soundoff = false) {
        super.onDie(game, soundoff);

        // 【修正3】ボス死亡時の連鎖爆発演出
        const explosionCount = 8;
        const intervalMs = 150;

        for (let i = 0; i < explosionCount; i++) {
            setTimeout(() => {
                // ゲームインスタンスや衝突判定クラスが生存しているかチェック
                if (!game?.collisions) return;

                // 連鎖爆発のSEは、最初・中間・最後など数回だけに抑えて音割れを防ぐ
                const shouldPlaySound = !soundoff && (i === 0 || i === 3 || i === 7);

                game.collisions.createExplosion(
                    this.x + Math.random() * this.width, 
                    this.y + Math.random() * this.height, 
                    this,
                    !shouldPlaySound // soundoff フラグを制御
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
export function createEnemyInstance(type, game, x, y, bType, data = {}) {
    if (type === 'BOSS_TRIGGER') {
        return new WarningEffect(game, x, y, data);
    }
    const EnemyClass = ENEMY_REGISTRY.get(type);

    if (EnemyClass) {
        return EnemyClass.create(game, x, y, bType, data);
    }

    console.warn(`[Enemy Registry Warning] Unknown enemy type: '${type}'. Falling back to default 'straight'.`);
    const FallbackClass = ENEMY_REGISTRY.get('straight');
    if (FallbackClass) {
        return FallbackClass.create(game, x, y, bType, data);
    }

    return new Enemy(game, x, y, bType, data.hp || 1);
}

/**
 * 敵の弾クラス
 */
export class EnemyBullet extends Entity {
    constructor(x, y, vx, vy) {
        super(x, y, 4, 4); // 判定は 4x4
        this.vx = vx;
        this.vy = vy;
        this.renderRadius = 3; // 見た目の半径は 3（直径6）
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