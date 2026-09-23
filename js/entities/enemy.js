/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemy.js - 敵クラス・ボス基底クラス & レジストリシステム
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
"use strict";

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
        this.shootTimer = Math.random() * 60;
        this.baseShootInterval = 120; 
        this.fireRateMultiplier = 1.0;
        
        if (game && game.assets) {
            this.image = game.assets.get(this.imageName);
            this.isLoaded = !!this.image; 
            this.loadError = !this.isLoaded;
            if (this.loadError) {
                console.warn(`[Asset Error] Failed to find: ${this.imageName}`);
            }
        } else {
            this.isLoaded = false;
            this.loadError = true;
        }
    }

    get imageName() { return "enemy_straight.webp"; }

    update(game) {
        this.y += this.speed;
        if (this.isOutOfBounds(50, true)) { 
            this.active = false; 
            return; 
        }

        if (this.active) {
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
    }

    shoot(game) {
        if (!game || !game.player) return;

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

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.active = false;
            return true;
        }
        return false;
    }

    draw(ctx, isInvincibleCheat = false) {
        ctx.save();

        const isHeaderArea = typeof GAME_CONFIG !== 'undefined' ? GAME_CONFIG.UI_HEADER_HEIGHT : 40;
        const gameWidth = typeof GAME_CONFIG !== 'undefined' ? GAME_CONFIG.WIDTH : 320;
        const gameHeight = typeof GAME_CONFIG !== 'undefined' ? GAME_CONFIG.HEIGHT : 480;

        if (
            this.y + this.height < isHeaderArea ||
            this.y >= gameHeight ||
            this.x + this.width <= 0 ||
            this.x >= gameWidth
        ) {
            ctx.globalAlpha = (Math.floor(Date.now() / 33) % 2 === 0) ? 0.15 : 0.60;
        }

        if (this.isLoaded && !this.loadError) {
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

        if (isInvincibleCheat) {
            ctx.strokeStyle = 'lime';
            const hw = this.hitWidth || this.width;
            const hh = this.hitHeight || this.height;
            ctx.strokeRect(
                this.x + (this.width - hw) / 2, 
                this.y + (this.height - hh) / 2, 
                hw, hh
            );
        }

        ctx.restore();
    }

    onDie(game, soundoff = false) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        if (game && game.collisions) {
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
        if (this.isOutOfBounds(50)) {
            this.active = false;
        }
    }

    /** 敵弾を描画する */
    draw(ctx) {
        ctx.fillStyle = '#F0F';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.renderRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}