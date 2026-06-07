/**
 * PROJECT: VOID-CIRCUIT
 * 
 * entities/enemies/stage1Enemies.js - STAGE-1 (Iron Vein) 固有敵クラス群 & ボス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
"use strict";

// ========================================================
// BossEnemy_01 (アイアン・ヴェイン防衛コア)
// ========================================================
class BossEnemy_01 extends BossEnemy {
    constructor(game, x, y, hp = 500, timeLimit = 1800, timeMultiplier = 100) {
        // BossEnemy(game, x, y, hp, timeLimit, timeMultiplier) を呼び出し
        super(game, x, y, hp, timeLimit, timeMultiplier);
        
        this.width = 96;
        this.height = 80;
        this.stopY = 90;
        this.state = "ENTRANCE"; // ENTRANCE, BATTLE, ESCAPE
        this.frame = 0;
        this.startX = x;
    }

    /** ボス用画像のファイル名指定 */
    get imageName() { 
        return "enemy_boss_01.webp"; 
    }

    update(game) {
        this.frame++;

        // 1. 登場フェーズ
        if (this.state === "ENTRANCE") {
            if (this.y < this.stopY) {
                this.y += 1.5;
            } else {
                this.state = "BATTLE";
            }
            return;
        }

        // 2. 戦闘フェーズ（左右移動 ＋ 周期弾幕）
        if (this.state === "BATTLE") {
            // 左上原点基準で左右にゆらゆら揺れる
            this.x = (GAME_CONFIG.WIDTH / 2 - this.width / 2) + Math.sin(this.frame * 0.02) * 60;

            // 弾幕パターンA (120フレーム毎に全方位8方向弾)
            if (this.frame % 120 === 0) {
                const bx = this.x + this.width / 2;
                const by = this.y + this.height / 2;
                for (let i = 0; i < 8; i++) {
                    const a = (Math.PI * 2 / 8) * i;
                    game.entities.push(new EnemyBullet(bx, by, Math.cos(a) * 3, Math.sin(a) * 3));
                }
            }

            // 弾幕パターンB (HP 50%未満で自機狙い2連射)
            if (this.hp < this.maxHp * 0.5 && this.frame % 40 === 0 && game.player) {
                const bx = this.x + this.width / 2;
                const by = this.y + this.height / 2;
                
                // 自機への角度計算
                const targetX = game.player.x + game.player.width / 2;
                const targetY = game.player.y + game.player.height / 2;
                const angle = Math.atan2(targetY - by, targetX - bx);

                game.entities.push(new EnemyBullet(bx - 20, by, Math.cos(angle) * 4, Math.sin(angle) * 4));
                game.entities.push(new EnemyBullet(bx + 20, by, Math.cos(angle) * 4, Math.sin(angle) * 4));
            }

            // 制限時間切れチェック
            if (this.frame >= this.timeLimit) {
                this.state = "ESCAPE";
            }
        }

        // 3. 撤退フェーズ
        if (this.state === "ESCAPE") {
            this.y -= 3.0;
            if (this.y < -100) {
                this.active = false; // 現行の消滅フラグ
            }
        }
    }

    /** 
     * 静的ファクトリメソッド (createEnemyInstance から呼ばれる)
     */
    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_01(
            game, 
            x, 
            y, 
            data.hp || 500, 
            data.timeLimit || 1800, 
            data.timeMultiplier || 100
        );
    }
}

// ========================================================
// ENEMY_REGISTRY へのボス登録
// ========================================================
if (typeof ENEMY_REGISTRY !== "undefined") {
    ENEMY_REGISTRY.set("boss_01", BossEnemy_01);
    ENEMY_REGISTRY.set("BOSS_01", BossEnemy_01); // 大文字小文字両対応
}