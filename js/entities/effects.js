/*
 * PROJECT: VOID-CIRCUIT
 *
 * effects.js - 演出専用エンティティ（パーティクル、スコア表示、ボス前警告）
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import { Entity } from './base.js';

/**
 * 演出用パーティクル
 */
export class Particle extends Entity {
    constructor(x, y, type = 'enemy') {
        super(x, y, 2, 2);
        this.type = type;
        const angle = Math.random() * Math.PI * 2;
        const speed = (type === 'player') ? Math.random() * 8 + 2 : Math.random() * 6;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = (type === 'player') ? 100 : 20;
        this.maxLife = this.life;
        this.size = (type === 'player') ? Math.random() * 4 + 2 : 2;
    }

    update(game) {
        this.x += this.vx;
        this.y += this.vy;
        if (this.type === 'player') {
            this.vx *= 0.96; 
            this.vy *= 0.96; 
            this.size *= 0.98;
        }
        this.life--;
        if (this.life <= 0) {
            this.active = false;
        }
    }

    /** パーティクルを描画する */
    draw(ctx) {
        const ratio = this.life / this.maxLife;
        ctx.save();
        
        if (this.type === 'player') {
            ctx.fillStyle = `rgba(255, ${Math.floor(255 * ratio)}, ${Math.floor(100 * ratio)}, ${ratio})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'boss') {
            ctx.shadowBlur = 10 * ratio;
            ctx.shadowColor = '#0FF';
            ctx.fillStyle = `rgba(${Math.floor(100 + 155 * (1 - ratio))}, 255, 255, ${ratio})`;
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size * 1.5, this.size * 1.5);
        } else {
            ctx.fillStyle = `rgba(255, 255, 100, ${ratio})`;
            ctx.fillRect(this.x, this.y, this.size, this.size);
        }
        
        ctx.restore();
    }
}

/**
 * スコアテキスト：画面上に浮かび上がる得点演出（Entity継承クラス）
 */
export class ScoreText extends Entity {
    constructor(x, y, score, color = "#fff") {
        super(x, y, 0, 0);
        this.opacity = 1.0;

        const rawLines = Array.isArray(score) ? score : [score];
        this.lines = rawLines.map(line => 
            (typeof line === 'number') ? line.toLocaleString() : String(line)
        );

        const flatScore = this.lines.join(" ");
        const numScore = typeof score === 'number' ? score : 0;

        let displayType = "NORMAL";
        if (flatScore.includes("BONUS")) {
            displayType = "BONUS";
        } else if (numScore >= 500000) {
            displayType = "BOSS_KILLED";
        } else if (numScore >= 10000) {
            displayType = "MEDIUM_KILLED";
        }

        switch (displayType) {
            case "BONUS":
                this.color = "#0FF";
                this.fontSize = 16;
                this.maxLife = 120;
                this.speed = 0.8;
                this.isBonus = true;
                break;

            case "BOSS_KILLED":
                this.color = "#ff0";
                this.fontSize = 16;
                this.maxLife = 120;
                this.speed = 0.8;
                this.isBonus = false;
                break;

            case "MEDIUM_KILLED":
                this.color = "#f0f";
                this.fontSize = 11;
                this.maxLife = 60;
                this.speed = 0.5;
                this.isBonus = false;
                break;

            default: // NORMAL
                this.color = color;
                this.fontSize = 8;
                this.maxLife = 60;
                this.speed = 0.5;
                this.isBonus = false;
                break;
        }

        this.life = this.maxLife;
        this.isBig = (displayType === "BONUS" || displayType === "BOSS_KILLED");
    }

    update(game) {
        this.y -= this.speed;        
        this.life--;
        this.opacity = Math.max(0, this.life / this.maxLife);
        
        if (this.life <= 0) {
            this.active = false;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;

        ctx.font = `${this.fontSize}px 'Press Start 2P'`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle"; 
        
        ctx.strokeStyle = "#000";
        ctx.lineWidth = (this.isBig || this.isBonus) ? 4 : 2;
        ctx.fillStyle = this.color;

        const lineHeight = this.fontSize * 1.4;

        this.lines.forEach((text, index) => {
            const drawY = this.y + (index - (this.lines.length - 1) / 2) * lineHeight;
            ctx.strokeText(text, this.x, drawY);
            ctx.fillText(text, this.x, drawY);
        });

        ctx.restore();
    }
}

/**
 * 画面全体にWARNING警告演出を表示する演出専用エンティティ
 */
export class WarningEffect extends Entity {
    /**
     * @param {Game} game 
     * @param {number} x 
     * @param {number} y 
     * @param {Object} data - YAMLからのパラメータ
     */
    constructor(game, x, y, data = {}) {
        // 1. 親クラス(Entity)のコンストラクタに合わせて引数を渡す
        const width = game ? game.width : 0;
        const height = game ? game.height : 0;
        super(x, y, width, height);

        // 2. 演出用パラメータの設定
        this.duration = data.duration || 120; // デフォルト2秒 (120frame)
        this.frame = 0;

        // 3. Entityとしてのプロパティ設定
        this.active = true;
        this.hp = Infinity; // 破壊不能

        // 4. SE
        game.sc.audio?.playSiren();

    }

    /**
     * フレーム更新処理
     * @param {Game} game 
     */
    update(game) {
        if (super.update) {
            super.update(game);
        }

        this.frame++;

        // 指定時間を過ぎたら非アクティブ化（game.entities から自動削除される）
        if (this.frame >= this.duration) {
            this.active = false;
        }
    }

    /**
     * 描画処理
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        if (!this.active) return;

        const width = typeof GAME_CONFIG !== 'undefined' ? game.width : this.width;
        const height = typeof GAME_CONFIG !== 'undefined' ? game.height : this.height;
        const barHeight = 20; // 上下の警告バーの太さ

        ctx.save();

        // ----------------------------------------------------
        // 1. 上下のハザードバー（黄×黒の斜めストライプ）
        // ----------------------------------------------------
        const drawHazardBar = (y) => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, y, width, barHeight);
            ctx.clip(); // バーの範囲内に描画領域を制限

            // ベースの黄色背景
            ctx.fillStyle = "#ffd700";
            ctx.fillRect(0, y, width, barHeight);

            // 斜めの黒ストライプを描画
            ctx.fillStyle = "#000000";
            ctx.stripeWidth = 15;
            const stripeWidth = 15;
            
            for (let x = -barHeight; x < width + barHeight; x += stripeWidth * 2) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + stripeWidth, y);
                ctx.lineTo(x + stripeWidth - barHeight, y + barHeight);
                ctx.lineTo(x - barHeight, y + barHeight);
                ctx.closePath();
                ctx.fill();
            }

            // 赤色の上下枠線で引き締める
            ctx.strokeStyle = "#ff0000";
            ctx.lineWidth = 2;
            ctx.strokeRect(0, y, width, barHeight);

            ctx.restore();
        };

        // 画面の最上部と最下部に描画
        drawHazardBar(0);
        drawHazardBar(height - barHeight);

        // ----------------------------------------------------
        // 2. 画面上部への WARNING テキスト表示
        // ----------------------------------------------------
        // 点滅アニメーション（12フレームごと）
        if (Math.floor(this.frame / 12) % 2 === 0) {
            ctx.fillStyle = "#ff2222";
            ctx.font = '16px "Press Start 2P", cursive';
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // ネオン風の発光効果
            ctx.shadowColor = "#ff0000";
            ctx.shadowBlur = 10;

            // 画面上部（Y = 45px 付近、UIやスコア表示と重ならない位置）
            ctx.fillText("WARNING", width / 2, 45);
        }

        ctx.restore();
    }
}