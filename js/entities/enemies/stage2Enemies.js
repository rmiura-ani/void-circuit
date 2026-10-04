/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage2Enemies.js - STAGE-2 (Emerald Aqua) 固有敵クラス群 & ボス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
"use strict";

import { Enemy, BossEnemy, EnemyBullet, ENEMY_REGISTRY } from '../enemy.js';

// ==========================================
// 1. STAGE-2 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 1. AquaJet: 画面上部から急降下し、滑らかなS字軌道（水流）を描いて離脱する高速機
 */
export class AquaJetEnemy extends Enemy {
    speed = 3.8;
    timer = 0;
    amplitude = 60; // S字の振り幅

    get imageName() { return "enemy_aqua_jet.webp"; }

    constructor(game, bulletType = 'aim', hp = 1) {
        super(game, bulletType, hp);
        this.width = (541 / 1247) * 32;
        this.height = 40;
    }

    setStartPosition(x, y) {
        super.setStartPosition(x, y);
        this.baseX = x;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += this.speed;
        // 水流に乗るような滑らかなS字サイン波移動
        const bx = this.baseX ?? this.startX;
        this.x = bx + Math.sin(this.timer * 0.08) * this.amplitude;

        // 一定ライン通過時に自機狙い弾をサッと1発残す
        if (this.timer === 30) {
            this.shoot(game);
        }

        if (this.isOutOfBounds(50, true)) {
            this.active = false;
        }
    }

    static create(game, bType, hp, data = {}) {
        return new AquaJetEnemy(game, bType , hp);
    }
}

/**
 * 2. WaveSpreader: 画面中央に滞留し、水面の波紋（サイン波）のように広がる波状弾幕を放射する砲台機
 */
export class WaveSpreaderEnemy extends Enemy {
    stopY = 110;
    timer = 0;
    state = 'MOVE_IN'; // MOVE_IN, SPREAD_ATTACK, RETREAT

    get imageName() { return "enemy_wave_spreader.webp"; }

    constructor(game, bulletType = 'triple', hp = 3) {
        super(game, bulletType, hp);
        this.width = (1408 / 768) * 32;
        this.height = 32;
        this.baseShootInterval = 40;
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'MOVE_IN':
                this.y += 2.0;
                if (this.y >= this.stopY) {
                    this.state = 'SPREAD_ATTACK';
                }
                break;

            case 'SPREAD_ATTACK':
                this.timer++;
                // 水面でゆらゆら揺れる機械振動
                this.x += Math.cos(this.timer * 0.1) * 0.8;

                // 40F周期で波紋状の3方向弾を発射
                const interval = Math.max(1, Math.floor(this.baseShootInterval / (this.fireRateMultiplier || 1)));
                if (this.timer % interval === 0) {
                    this.shootWaveBullet(game);
                }

                if (this.timer >= 240) { // 約4秒間滞留後に退避
                    this.state = 'RETREAT';
                }
                break;

            case 'RETREAT':
                this.y -= 2.5;
                if (this.isOutOfBounds(50, true)) {
                    this.active = false;
                }
                break;
        }
    }

    /** 波紋（Wave）を模した拡散弾 */
    shootWaveBullet(game) {
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;
        const baseAngle = Math.PI / 2; // 真下方向

        [-0.4, 0, 0.4].forEach(offset => {
            const angle = baseAngle + offset + Math.sin(this.timer * 0.2) * 0.15;
            const vx = Math.cos(angle) * 2.8;
            const vy = Math.sin(angle) * 2.8;
            game.entities.push(new EnemyBullet(bx, by, vx, vy));
        });
    }

    static create(game, bType, hp, data = {}) {
        const enemy = new WaveSpreaderEnemy(game, bType || 'triple', hp || 3);
        if (data.stopY !== undefined) enemy.stopY = data.stopY;
        return enemy;
    }
}

/**
 * 3. BubbleMine: ふわふわ降下する水泡トラップ。被弾・撃破時に「小さな泡（8方向拡散）」を発散する
 */
export class BubbleMineEnemy extends Enemy {
    speedY = 0.8; // 水中に漂うような非常にゆっくりとした降下
    timer = game.random.range(0, 100)


    get imageName() { return "enemy_bubble_mine.webp"; }

    constructor(game, bulletType = 'none', hp = 1) {
        super(game, bulletType, hp);
    }

    setStartPosition(x, y) {
        super.setStartPosition(x, y);
        this.baseX = x;
    }

    update(game) {
        if (!this.active) return;
        this.timer += 0.05;

        this.y += this.speedY;
        // 水泡特有のゆらゆら揺れる横揺れ
        const bx = this.baseX ?? this.startX;
        this.x = bx + Math.sin(this.timer) * 15;

        if (this.isOutOfBounds(50, true)) {
            this.active = false;
        }
    }

    /** 破壊時に泡（弾）を周囲に飛び散らせる */
    takeDamage(game, amount) {
        const isDead = super.takeDamage(game, amount);
        if (isDead && game) {
            this.popBubbleCluster(game);
        }
        return isDead;
    }

    popBubbleCluster(game) {
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;

        // 撃破時に6方向へ「弾速の遅い泡弾」を撒き散らす（トラップ演出）
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            const vx = Math.cos(angle) * 1.8;
            const vy = Math.sin(angle) * 1.8;
            game.entities.push(new EnemyBullet(bx, by, vx, vy));
        }
    }

    static create(game, bType, hp, data = {}) {
        return new BubbleMineEnemy(game, bType, hp || 1);
    }
}

/**
 * 4. VortexDiver: 自機を目掛けて斜め急降下し、画面下部で旋回（Vortex）して上昇離脱する中型機
 */
export class VortexDiverEnemy extends Enemy {
    state = 'DIVE';
    vx = 0;
    vy = 4.0;
    timer = 0;
    swirlAngle = 0;
    swirlCenterX = 0;
    swirlCenterY = 0;
    flipScaleY = 1.0; // アニメーション用のスケール変数 (1.0 = 通常, -1.0 = 完全反転)

    get imageName() { return "enemy_vortex_diver.webp"; }

    constructor(game, bulletType = 'straight', hp = 2) {
        super(game, bulletType, hp);
        this.baseShootInterval = 20;
    }

    setStartPosition(x, y) {
        super.setStartPosition(x, y);
        this.swirlCenterX = x;
        this.swirlCenterY = y;
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'DIVE':
                this.x += this.vx;
                this.y += this.vy;

                if (this.y >= game.player.y - 100) {
                    this.state = 'SWIRL';
                    this.swirlCenterX = this.x;
                    this.swirlCenterY = this.y;
                    this.swirlAngle = Math.atan2(this.vy, this.vx);
                }
                break;

            case 'SWIRL':
                this.timer++;
                this.swirlAngle += 0.12;
                const radius = 45;
                this.x = this.swirlCenterX + Math.cos(this.swirlAngle) * radius;
                this.y = this.swirlCenterY + Math.sin(this.swirlAngle) * radius - (this.timer * 0.5);

                // 【アニメーション処理】10フレームかけて 1.0 から -1.0 までなめらかに補間してひっくり返す
                if (this.flipScaleY > -1.0) {
                    this.flipScaleY -= 0.2;
                    if (this.flipScaleY < -1.0) this.flipScaleY = -1.0;
                }

                if (this.timer % 20 === 0) {
                    this.shoot(game);
                }

                if (this.timer >= 45) {
                    this.state = 'ESCAPE';
                }
                break;

            case 'ESCAPE':
                this.y -= 5.0;
                if (this.y < -50) this.active = false;
                break;
        }
    }

    draw(ctx, isDebug = false) {
        if (!this.active) return;

        ctx.save();
        
        // 1. 敵の中心点へ移動して反転スケールをかける
        ctx.translate(this.x, this.y);
        ctx.scale(1, this.flipScaleY);

        // 2. スケール適用後の中心点（0, 0）を描画の基準にするため原点を戻す
        ctx.translate(-this.x, -this.y);

        // 3. 親クラスの描画処理をそのまま実行
        super.draw(ctx, isDebug);

        ctx.restore();
    }

    static create(game, bType, hp, data = {}) {
        return new VortexDiverEnemy(game, bType || 'straight', hp || 2);
    }
}

/**
 * 5. CoralShield: サンゴの堅牢な外殻を持つ高耐久機。真下へ太い自機狙い連続弾を射出しながらゆっくり降下
 */
export class CoralShieldEnemy extends Enemy {
    speed = 0.5; // 超鈍重
    timer = 0;

    get imageName() { return "enemy_coral_shield.webp"; }

    constructor(game, bulletType = 'straight', hp = 6) {
        super(game, bulletType, hp);
        this.width = 48;
        this.height = (1408 / 768) * 48;
        this.baseShootInterval = 60;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += this.speed;

        // 60F（約1秒）ごとに正面真下へ強力な連続直線弾
        const interval = Math.max(1, Math.floor(this.baseShootInterval / (this.fireRateMultiplier || 1)));
        if (this.timer % interval === 0) {
            const bx = this.x + this.width / 2;
            const by = this.y + this.height;
            game.entities.push(new EnemyBullet(bx, by, 0, 4.5));
            game.entities.push(new EnemyBullet(bx - 10, by - 5, 0, 4.0));
            game.entities.push(new EnemyBullet(bx + 10, by - 5, 0, 4.0));
        }

        if (this.isOutOfBounds(60, true)) {
            this.active = false;
        }
    }

    static create(game, bType, hp, data = {}) {
        return new CoralShieldEnemy(game, bType || 'straight', hp || 6);
    }
}

/**
 * MineDebrisEnemy: 完全無敵の浮遊障害物（破壊不可）
 */
export class MineDebrisEnemy extends Enemy {
    static DEFAULT_SPEED_Y = 1.2;
    speedY = MineDebrisEnemy.DEFAULT_SPEED_Y;

    get imageName() { return "enemy_mine_debris.webp"; }

    constructor(game, bulletType = 'none', hp = Infinity) {
        super(game, 'none', Infinity);
    }

    update(game) {
        if (!this.active) return;
        this.y += this.speedY;
    }

    takeDamage(game, _amount) {
        // 完全無敵
        return false;
    }

    static create(game, bType, hp, data = {}) {
        const enemy = new MineDebrisEnemy(game, 'none', Infinity);
        if (data.speedY !== undefined) enemy.speedY = data.speedY;
        return enemy;
    }
}

// ==========================================
// 2. STAGE-2 ボス実体
// ==========================================

/**
 * STAGE-2 ボス: 碧琥珀の潜航母艦（BossEnemy_02）
 * 特徴: 潜航（水没・半透明化＆無敵）と浮上（全方位弾幕）を繰り返すトリッキーな水棲母艦ボス
 */
export class BossEnemy_02 extends BossEnemy {
    state = 'APPEAR';
    timer = 0;
    alpha = 1.0;

    get imageName() { return "enemy_boss_02.webp"; }

    constructor(game, hp = 50, timeLimit, timeMultiplier) {
        super(game, hp, timeLimit, timeMultiplier);
        this.isBoss = true;
        this.width = 140;
        this.height = 96;
        this.hitWidth = 110;
        this.hitHeight = 70;
    }

    setStartPosition(x, y) {
        const startY = -128; // 上部画面外から進入
        super.setStartPosition(x, startY);
        this.baseX = this.startX;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.8;
                if (this.y >= 50) {
                    this.state = 'ATTACK_NORMAL';
                    this.timer = 0;
                    // 🎯 到着した時点のX座標をベース位置として確定
                    this.baseX = this.x;
                }
                break;

            case 'ATTACK_NORMAL':
                // 水面を揺蕩うような大きなゆったり横移動
                const bx1 = this.baseX ?? this.startX;
                this.x = bx1 + Math.sin(this.timer * 0.03) * 80;

                if (this.timer % 30 === 0) {
                    this.bulletType = 'aim';
                    this.shoot(game);
                }

                // 300F（約5秒）攻撃したら潜航（水没）フェーズへ
                if (this.timer > 300) {
                    this.state = 'DIVE';
                    this.timer = 0;
                }
                break;

            case 'DIVE':
                // 1. 徐々に透明になりながら水中へ潜る
                this.alpha -= 0.02;
                if (this.alpha <= 0) { // 🎯 0まで完全に消えてから水中移動させる
                    this.alpha = 0;
                    this.isInvincible = true; // 完全潜航で無敵化
                    
                    // 完全透明になった後で安全にワープ移動
                    const padding = 50;
                    this.x = padding + game.random.next() * (game.width - this.width - padding * 2);
                    this.baseX = this.x; // 🎯 移動先を新しい揺れ中心点にする

                    // 次のステートへ移動してタイマーリセット
                    this.state = 'SURFACE';
                    this.timer = 0;
                }
                break;

            case 'SURFACE':
                // 2. 120フレーム（2秒間）は水中で潜航維持（タイマーカウント）
                if (this.timer < 120) {
                    break;
                }

                // 3. 2秒経ったら浮上開始（徐々にくっきり表示）
                this.alpha += 0.03;

                // 4. くっきり表示されたら完全浮上完了
                if (this.alpha >= 1.0) {
                    this.alpha = 1.0;
                    this.isInvincible = false; // 無敵解除
                    this.state = 'ATTACK_NORMAL';
                    this.timer = 0;
                    // 🎯 浮上完了時の位置をベース位置にセットして横揺れを再始動
                    this.baseX = this.x; 
                    
                    // 浮上した瞬間のカウンター8方向全方位弾幕
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                break;
        }
    }

    draw(ctx, isDebug = false) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        
        // 潜航（無敵）中はCanvas Filterで水中の青いブラー演出を動的にかける
        if (this.isInvincible) {
            ctx.filter = 'blur(3px) brightness(0.6) saturate(0.5) hue-rotate(200deg)';
        }
        super.draw(ctx, isDebug);
        ctx.restore();
    }

    onDie(game) {
        // 水中母艦が水圧と爆破で崩壊していく連鎖大爆発演出
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                game.collisions.createExplosion(
                    this.x + game.random.range(0, this.width) , 
                    this.y + game.random.range(0, this.height) ,
                    { maxHp: 80 }
                );
            }, i * 150);
        }
    }

    static create(game, bType, hp, data = {}) {
        return new BossEnemy_02(
            game, 
            hp || 50, 
            data.timeLimit, 
            data.timeMultiplier
        );
    }
}

// ==========================================
// 3. ENEMY_REGISTRY への自動登録
// ==========================================

ENEMY_REGISTRY.set('aqua_jet', AquaJetEnemy);
ENEMY_REGISTRY.set('wave_spreader', WaveSpreaderEnemy);
ENEMY_REGISTRY.set('bubble_mine', BubbleMineEnemy);
ENEMY_REGISTRY.set('vortex_diver', VortexDiverEnemy);
ENEMY_REGISTRY.set('coral_shield', CoralShieldEnemy);
ENEMY_REGISTRY.set('debris', MineDebrisEnemy);
ENEMY_REGISTRY.set('boss_02', BossEnemy_02);