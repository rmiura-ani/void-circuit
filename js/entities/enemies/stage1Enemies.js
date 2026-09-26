/*
 * PROJECT: VOID-CIRCUIT
 * 
 * entities/enemies/stage1Enemies.js - STAGE-1 (Iron Vein) 固有敵クラス群 & ボス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import { Enemy, BossEnemy, EnemyBullet, ENEMY_REGISTRY } from '../enemy.js';

// ==========================================
// 1. STAGE-1 固有のザコ・中型敵クラス群
// ==========================================
/**
 * ScoutEnemy: 画面外からUの字を描いて索敵し、弾を撒いて上部へ去っていく偵察型
 */
export class ScoutEnemy extends Enemy {
    get imageName() { return "enemy_scout.webp"; }

    constructor(game, x, y, bulletType, isLeft = true) {
        super(game, x, y, bulletType, 1);
        this.timer = 0;
        this.isLeft = isLeft;
        this.x = isLeft ? -32 : (game?.width ?? 640) + 32; 
        this.hasShot = false;
    }

    update(game) {
        if (!this.active) return;

        this.timer += 0.04;
        this.x += this.isLeft ? 3.5 : -3.5;
        this.y = 80 + Math.sin(this.timer) * 120;

        // U字最下点付近で1回だけ射撃
        if (Math.abs(this.timer - Math.PI / 2) < 0.05 && !this.hasShot) {
            this.shoot(game); 
            this.hasShot = true;
        }
    }

    static create(game, x, y, bType, data = {}) {
        const isLeft = data.isLeft ?? true;
        return new ScoutEnemy(game, x, y, bType, isLeft);
    }
}


/// ==========================================
// 2. STAGE-1 ボス実体
// ==========================================
/**
 * STAGE-3 ボス: アイアン・ヴェイン防衛コア（BossEnemy_01）
 */
export class BossEnemy_01 extends BossEnemy {
    get imageName() { return "enemy_boss_01.webp"; }

    /**
     * @param {Object} game - ゲームインスタンス
     * @param {number} x - 初期X座標
     * @param {number} y - 初期Y座標
     * @param {number} hp - 耐久力
     */
    constructor(game, x, y, hp = 500) {
        super(game, x, y, hp);
        
        this.width = 96;
        this.height = 80;
        
        // 移動・演出関連
        this.stopY = 90;
        this.state = 'ENTRANCE'; // ENTRANCE, BATTLE
        this.frame = 0;
        this.startX = x;
        this.entranceSpeed = 1.5;
        this.swingWidth = 60;   // 左右の揺れ幅
        this.swingSpeed = 0.02; // 左右の揺れ速度

        // 🎯 基準点となるX座標を追加
        this.baseX = x;
    }

    /** ボスの中心X座標 */
    get centerX() {
        return this.x + this.width / 2;
    }

    /** ボスの中心Y座標 */
    get centerY() {
        return this.y + this.height / 2;
    }

    /**
     * メイン更新処理
     */
    update(game) {
        this.frame++;

        switch (this.state) {
            case 'ENTRANCE':
                this.updateEntrance();
                break;

            case 'BATTLE':
                this.updateBattle(game);
                break;

            default:
                break;
        }
    }

    /**
     * 1. 登場フェーズ更新
     */
    updateEntrance() {
        if (this.y < this.stopY) {
            this.y += this.entranceSpeed;
        } else {
            this.state = 'BATTLE';
            // 🎯 BATTLE移行時にタイマーを0リセットし、登場完了時のX座標を基準位置に設定
            this.frame = 0;
            this.baseX = this.x;
        }
    }

    /**
     * 2. 戦闘フェーズ更新（移動＋攻撃）
     */
    updateBattle(game) {
        // 🎯 到着位置(baseX)から滑らかに横揺れを開始 (frame=0から始まるため Math.sin(0)=0 でずれない)
        this.x = this.baseX + Math.sin(this.frame * this.swingSpeed) * this.swingWidth;

        // 弾幕パターンA: 120フレーム毎 全方位8方向弾
        if (this.frame % 120 === 0) {
            this.fireRingBullets(game, 8, 3);
        }

        // 弾幕パターンB: HP 50%未満かつ40フレーム毎 自機狙い2連射
        const isSecondPhase = this.hp < this.maxHp * 0.5;
        if (isSecondPhase && this.frame % 40 === 0 && game.player) {
            this.fireTargetedDualBullets(game, game.player, 4, 20);
        }
    }

    /**
     * 【弾幕A】 全方位リング弾を発射
     * @param {Object} game - ゲームインスタンス
     * @param {number} count - 弾数
     * @param {number} speed - 弾速
     */
    fireRingBullets(game, count = 8, speed = 3) {
        const cx = this.centerX;
        const cy = this.centerY;
        const step = (Math.PI * 2) / count;

        for (let i = 0; i < count; i++) {
            const angle = step * i;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            game.entities.push(new EnemyBullet(cx, cy, vx, vy));
        }
    }

    /**
     * 【弾幕B】 自機を狙った左右並列2連射
     * @param {Object} game - ゲームインスタンス
     * @param {Object} target - ターゲット（プレイヤー）
     * @param {number} speed - 弾速
     * @param {number} offsetX - X方向のオフセット間隔
     */
    fireTargetedDualBullets(game, target, speed = 4, offsetX = 20) {
        const cx = this.centerX;
        const cy = this.centerY;

        const targetCx = target.x + target.width / 2;
        const targetCy = target.y + target.height / 2;
        
        const angle = Math.atan2(targetCy - cy, targetCx - cx);
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        // 左右2箇所から発射
        game.entities.push(new EnemyBullet(cx - offsetX, cy, vx, vy));
        game.entities.push(new EnemyBullet(cx + offsetX, cy, vx, vy));
    }

    /** 
     * 静的ファクトリメソッド (createEnemyInstance から呼ばれる)
     */
    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_01(
            game, 
            x, 
            y, 
            data.hp ?? 500
        );
    }
}

// ========================================================
// ENEMY_REGISTRY へのボス登録
// ========================================================
ENEMY_REGISTRY.set('scout', ScoutEnemy);
ENEMY_REGISTRY.set("boss_01", BossEnemy_01);
