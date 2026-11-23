/*
 * PROJECT: VOID-CIRCUIT
 *
 * effects.ts - 演出専用エンティティ（パーティクル、スコア表示、ボス前警告）
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import { Entity, type GameContext } from './base.js';

export type ParticleType = 'enemy' | 'player' | 'boss' | (string & {});

/**
 * 演出用パーティクル
 */
export class Particle extends Entity {
    public type: ParticleType;
    public vx: number;
    public vy: number;
    public life: number;
    public maxLife: number;
    public size: number;

    constructor(x: number, y: number, type: ParticleType = 'enemy') {
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

    public override update(): void {
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
    public override draw(ctx: CanvasRenderingContext2D): void {
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
    public opacity: number;
    public lines: string[];
    public color: string;
    public fontSize: number;
    public maxLife: number;
    public speed: number;
    public isBonus: boolean;
    public life: number;
    public isBig: boolean;

    constructor(x: number, y: number, score: number | string | Array<number | string>, color: string = "#fff") {
        super(x, y, 0, 0);
        this.opacity = 1.0;

        const rawLines = Array.isArray(score) ? score : [score];
        this.lines = rawLines.map(line =>
            (typeof line === 'number') ? line.toLocaleString() : String(line)
        );

        const flatScore = this.lines.join(" ");
        const numScore = typeof score === 'number' ? score : 0;

        let displayType: "NORMAL" | "BONUS" | "BOSS_KILLED" | "MEDIUM_KILLED" = "NORMAL";
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

    public override update(): void {
        this.y -= this.speed;
        this.life--;
        this.opacity = Math.max(0, this.life / this.maxLife);

        if (this.life <= 0) {
            this.active = false;
        }
    }

    public override draw(ctx: CanvasRenderingContext2D): void {
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
    public duration: number;
    public frame: number;
    public soundPlayed: boolean;

    constructor() {
        super(0, 0, 0, 0);

        this.duration = 120;
        this.frame = 0;
        this.active = true;
        this.soundPlayed = false;
    }

    /**
     * フレーム更新処理
     */
    public override update(game: GameContext): void {
        super.update(game);

        // 初回フレームでサイレンSEを再生
        if (!this.soundPlayed) {
            game.sc.audio.playSiren();
            this.soundPlayed = true;
        }

        this.frame++;

        if (this.frame >= this.duration) {
            this.active = false;
        }
    }

    /**
     * 描画処理
     */
    public override draw(ctx: CanvasRenderingContext2D): void {
        if (!this.active) return;

        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const barHeight = 20;

        ctx.save();

        // 1. 上下のハザードバー（黄×黒の斜めストライプ）
        const drawHazardBar = (y: number): void => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, y, width, barHeight);
            ctx.clip();

            ctx.fillStyle = "#ffd700";
            ctx.fillRect(0, y, width, barHeight);

            ctx.fillStyle = "#000000";
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

            ctx.strokeStyle = "#ff0000";
            ctx.lineWidth = 2;
            ctx.strokeRect(0, y, width, barHeight);

            ctx.restore();
        };

        drawHazardBar(0);
        drawHazardBar(height - barHeight);

        // 2. 画面上部への WARNING テキスト表示
        if (Math.floor(this.frame / 12) % 2 === 0) {
            ctx.fillStyle = "#ff2222";
            ctx.font = '16px "Press Start 2P", cursive';
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.shadowColor = "#ff0000";
            ctx.shadowBlur = 10;

            ctx.fillText("WARNING", width / 2, 45);
        }

        ctx.restore();
    }
}