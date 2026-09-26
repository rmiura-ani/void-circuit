/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage5Enemies.js - STAGE-5 (Planetary Pulse) 固有敵クラス群 & ボス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import { Enemy, BossEnemy, EnemyBullet, ENEMY_REGISTRY } from '../enemy.js';

// ==========================================
// 1. STAGE-5 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 分裂時に飛び散る小型細胞クラス（CellMitosisEnemy等から自動生成される）
 */
export class CellMiniEnemy extends Enemy {
    get imageName() { return "enemy_cell_mini.webp"; }

    constructor(game, x, y, vx, vy) {
        super(game, x, y, 'aim', 1); // HP = 1
        this.vx = vx;
        this.vy = vy;
        this.width = 20;  // 小型化
        this.height = 20;
    }

    update(game) {
        if (!this.active) return;
        this.x += this.vx;
        this.y += this.vy;

        // 慣性で徐々に真下への降下軌道にシフト
        this.vy = Math.min(2.5, this.vy + 0.05);

    }

    static create(game, x, y, bType, data = {}) {
        return new CellMiniEnemy(game, x, y, data.vx || 0, data.vy || 2);
    }
}

/**
 * 1. CellMitosis: 降下中に被弾（撃破）すると左右に2つの小型細胞（CellMini）に分裂して飛び散る増殖機
 */
export class CellMitosisEnemy extends Enemy {
    get imageName() { return "enemy_cell_mitosis.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); // HP = 2
        this.speedY = 1.2;
        this.width = (220/111)*32;
        this.height = 32;
    }

    update(game) {
        if (!this.active) return;
        this.y += this.speedY;
    }

    /** 撃破時に2体に「細胞分裂」して左右へ弾き出す */
    takeDamage(amount) {
        const isDead = super.takeDamage(amount);
        if (isDead && this.game) {
            const bx = this.x + this.width / 2;
            const by = this.y + this.height / 2;

            // 左右斜め下へ飛び散る分裂細胞をエンティティリストへ追加
            const leftMini = new CellMiniEnemy(this.game, bx - 10, by, -2.0, -1.0);
            const rightMini = new CellMiniEnemy(this.game, bx + 10, by, 2.0, -1.0);
            this.game.entities.push(leftMini, rightMini);
        }
        return isDead;
    }

    static create(game, x, y, bType, data = {}) {
        return new CellMitosisEnemy(game, x, y, bType);
    }
}

/**
 * 2. PulseSpore: BGMの脈動（パルス）と同調して「膨張・縮小」を繰り返し、最大膨張時に全方位弾を解放するビート同期機
 */
export class PulseSporeEnemy extends Enemy {
    get imageName() { return "enemy_pulse_spore.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 1); // HP = 1
        this.speedY = 0.8;
        this.timer = Math.random() * 60;
        this.scale = 1.0;
        this.hasPulsed = false;
    }

    update(game) {
        if (!this.active) return;
        this.timer += 0.08;
        this.y += this.speedY;

        // 心臓の鼓動のようにスケールが0.8〜1.5倍に伸縮
        this.scale = 1.15 + Math.sin(this.timer) * 0.35;

        // ピーク（最大膨張時）で全方位拡散弾を発射
        if (this.scale >= 1.45 && !this.hasPulsed) {
            this.bulletType = 'eight-way';
            this.shoot(game);
            this.hasPulsed = true;
        } else if (this.scale < 1.2) {
            this.hasPulsed = false; // 次の膨張ピークに向けてフラグリセット
        }
    }

    draw(ctx) {
        ctx.save();
        // 脈動に合わせて画像の描画スケールを動的に変更
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.scale(this.scale, this.scale);
        ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));

        super.draw(ctx);
        ctx.restore();
    }

    static create(game, x, y, bType, data = {}) {
        return new PulseSporeEnemy(game, x, y, bType);
    }
}

/**
 * 3. BioTentacle: 画面端から滑らかなベジェ曲線運動（ウネウネ動き）で画面中央に触手を伸ばす生体機
 */
export class BioTentacleEnemy extends Enemy {
    get imageName() { return "enemy_bio_tentacle.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 4); // HP = 4
        this.width = (461/133)*32;
        this.height = 32;
        this.baseX = x;
        this.timer = 0;
        this.speedY = 1.0;
    }

    update(game) {
        if (!this.active) return;
        this.timer += 0.05;

        this.y += this.speedY;
        // ベジェ曲線を模した大きなうねりの複合サイン波運動
        this.x = this.baseX + Math.sin(this.timer) * 60 + Math.cos(this.timer * 2.0) * 20;

        if (Math.floor(this.timer * 20) % 60 === 0) {
            this.bulletType = 'aim';
            this.shoot(game);
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new BioTentacleEnemy(game, x, y, bType);
    }
}

/**
 * 4. LeechParasite: 自機に向かって超低速で寄生飛行。
 */
export class LeechParasiteEnemy extends Enemy {
    get imageName() { return "enemy_leech_parasite.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 1); // HP = 1
        this.width = (250/123)*32;
        this.height = 32;
        this.speed = 1.2;
        this.isParasite = true; // 衝突判定側でデバフ処理を分岐するためのフラグ例
    }

    update(game) {
        if (!this.active) return;

        // 常に自機の中心をジワジワ狙う誘導移動
        if (game.player && game.player.alive) {
            const dx = (game.player.x + game.player.width / 2) - (this.x + this.width / 2);
            const dy = (game.player.y + game.player.height / 2) - (this.y + this.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        } else {
            this.y += this.speed;
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new LeechParasiteEnemy(game, x, y, bType);
    }
}

/**
 * 5. HeartNucleus: 周囲の小型雑魚を一定周期で吸引・自己回復（HP加算）を行う中型生体コア
 */
export class HeartNucleusEnemy extends Enemy {
    get imageName() { return "enemy_heart_nucleus.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 7); // HP = 7
        this.width = 48;
        this.height = 48;
        this.speedY = 0.4; // 非常にゆったり降下
        this.timer = 0;
        this.suctionParticles = [];
        const particleCount = 20; // 線の本数

        for (let i = 0; i < particleCount; i++) {
            this.suctionParticles.push({
                angle: Math.random() * Math.PI * 2,    // 360度ランダムな方向
                distance: 30 + Math.random() * 120,    // 敵中心からの初期距離（半径）
                speed: 2 + Math.random() * 3,          // 吸い込まれるスピード
                length: 10 + Math.random() * 15        // 集中線の長さ
            });
        }
    }

    // 吸い込みを行う敵の update(game) などの中で呼び出す
    _applySuctionToPlayer() {
        // 敵中心とプレイヤー中心の距離を計算
        const enemyCenterX = this.x + this.width / 2;
        const enemyCenterY = this.y + this.height / 2;
        const playerCenterX = this.game.player.x + this.game.player.width / 2;
        const playerCenterY = this.game.player.y + this.game.player.height / 2;

        const dx = enemyCenterX - playerCenterX;
        const dy = enemyCenterY - playerCenterY;
        const distance = Math.hypot(dx, dy);

        // 吸い込みの有効範囲（例: 200px以内）
        const suctionRadius = 600;

        if (distance < suctionRadius && distance > 0) {
            // 近いほど強く吸い込まれる（強さの調整：2.5〜4.0程度がおすすめ）
            const force = (1 - distance / suctionRadius) * 2.5;

            // ベクトルを正規化して吸い込み力を設定
            this.game.player.suctionForceX += (dx / distance) * force;
            this.game.player.suctionForceY += (dy / distance) * force;
        }
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += this.speedY;
        this._applySuctionToPlayer();

        // 120F（約2秒）ごとに周囲のエネルギーを吸い上げてHPを1回復（最大HPは超えない）
        if (this.timer % 120 === 0 && this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + 1);
        }

        // 射撃は高密度の全方位弾（1未満にならないように保護）
        const interval = Math.max(1, Math.floor(80 / (this.fireRateMultiplier || 1)));
        if (this.timer % interval === 0) {
            this.bulletType = 'eight-way';
            this.shoot(game);
        }
    }

    draw(ctx) {
        super.draw(ctx); // 本体描画

        // 🌀 吸い込み状態（例: BLACK_HOLE や SUCTION 状態）の時だけ描画
        ctx.save();
        ctx.strokeStyle = 'rgba(220, 180, 255, 0.6)'; // 紫/ピンクがかったうっすら光る線
        ctx.lineWidth = 1.5;

        // 敵の中心座標を取得
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        for (const p of this.suctionParticles) {
            // 1. 中心に向かって距離を縮める
            p.distance -= p.speed;

            // 2. 中心（または一定の半径）まで到達したら外側にリスポーン
            if (p.distance <= 10) {
                p.distance = 120 + Math.random() * 30; // 再び外側から発生
                p.angle = Math.random() * Math.PI * 2; // 新しい角度にランダム配置
            }

            // 3. 始点（線の外側）と終点（線の中央寄り）の位置を三角関数（Math.cos / Math.sin）で計算
            const startX = centerX + Math.cos(p.angle) * p.distance;
            const startY = centerY + Math.sin(p.angle) * p.distance;

            // 線の末尾は、中心に向かって少し短く伸ばす
            const endX = centerX + Math.cos(p.angle) * (p.distance - p.length);
            const endY = centerY + Math.sin(p.angle) * (p.distance - p.length);

            // 4. 集中線を描画
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        ctx.restore();
    }

    static create(game, x, y, bType, data = {}) {
        const enemy = new HeartNucleusEnemy(game, x, y, bType);
        if (data.hp) enemy.hp = data.hp;
        return enemy;
    }
}


// ==========================================
// 2. STAGE-5 ボス実体
// ==========================================

/**
 * STAGE-5 ボス: 生体DNAコア（Planetary Pulse / BossEnemy_05）
 * 特徴: バイオレットのパルス明滅と、HP50%未満での細胞分裂・暴走（発射速度倍増＆脈動巨大化）を行うボス
 */
export class BossEnemy_05 extends BossEnemy {
    get imageName() { return "enemy_boss_05.webp"; }

    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        const startY = (y !== undefined && y !== null) ? y : -128;
        super(game, x, startY, hp, timeLimit, timeMultiplier);
        
        this.isBoss = true;
        this.width = (818/291)*110;
        this.height = 110;
        this.hitWidth = 90;
        this.hitHeight = 90;

        this.state = 'APPEAR';
        this.timer = 0;
        this.baseX = x;
        this.hasSplit = false;
        this.shotCount = 0;
    }

    /**
     * 部位ごとの判定領域とダメージ倍率（マルチヒットボックス）
     * 配列の先頭（HEAD）から判定評価を行うことで、頭と本体が重なる領域でも頭の判定が優先されます。
     */
    getHitboxes() {
            // 🎯 弱点: 目玉 (被弾ダメージ 2倍)
        const headW = 70;
        const headH = 120;
        const headX = this.x + (this.width - headW) / 2;
        const headY = this.y + this.height - headH; // 下端に合わせて飛び出させる

            // 🛡️ 通常: サイド (被弾ダメージ 1倍)
        const bodyW = 290;
        const bodyH = 70;
        const bodyX = this.x + (this.width - bodyW) / 2;
        const bodyY = this.y + 10;

        return [
            // 🎯 弱点: 目玉 (被弾ダメージ 2倍)
            {
                part: 'HEAD',
                multiplier: 2.0,
                x: headX,
                y: headY,
                width: headW,
                height: headH
            },
            // 🛡️ 通常: サイド (被弾ダメージ 1倍)
            {
                part: 'BODY',
                multiplier: 1.0,
                x: bodyX,
                y: bodyY,
                width: bodyW,
                height: bodyH
            }
        ];
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.6;
                if (this.y >= 60) {
                    this.state = 'PULSE_WAVE';
                    this.timer = 0;
                    // 🎯 到着したその時点のX位置を基準点として確定
                    this.baseX = this.x;
                }
                break;

            case 'PULSE_WAVE':
                // 呼吸するようにゆったり浮遊
                this.x = this.baseX + Math.sin(this.timer * 0.02) * 60;
                // 🎯 timer=0 の時 cos(0)=1 となるため、(1 - cos) にして y=60 から滑らかに下降・スタートさせる
                this.y = 60 + (1 - Math.cos(this.timer * 0.04)) * 20;

                // 粘着質なシンセアルペジオと同調した自機狙い連射弾（ゼロ除算保護）
                const interval = Math.max(1, Math.floor(15 / (this.fireRateMultiplier || 1)));
                if (this.timer % interval === 0) {
                    // 🎯 10発中2発のタイミングで発射をスキップ
                    if (this.shotCount % 10 < 8) {
                        this.bulletType = 'aim';
                        this.shoot(game);
                    }
                    this.shotCount++; // カウントを進める
                }

                // 🧬 ギミック: HPが1/3を切ると、おぞましい細胞分裂とともに弾幕が常時激化
                if (!this.hasSplit && this.hp < this.maxHp / 3) {
                    this.hasSplit = true;
                    this.fireRateMultiplier = 2.0; // 攻撃速度が2倍へ昇華
                }

                if (this.hasSplit && this.timer % 40 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                break;
        }
    }

    draw(ctx) {
        ctx.save();
        // 分裂（暴走）後は不気味な紫色に輝き、激しく脈動（スケール変化）する
        if (this.hasSplit) {
            const scale = 1.0 + Math.sin(this.timer * 0.2) * 0.08;
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            
            // 🎯 中小中心で安全に拡大縮小適用
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
            
            ctx.filter = 'hue-rotate(280deg) saturate(2.5) brightness(1.1)';
        }
        super.draw(ctx);
        ctx.restore();
    }

    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_05(
            game, x, y, 
            data.hp || 90, 
            data.timeLimit || 1800, 
            data.timeMultiplier || 100
        );
    }
}

// ==========================================
// 3. ENEMY_REGISTRY への自動登録
// ==========================================

ENEMY_REGISTRY.set('cell_mini', CellMiniEnemy);
ENEMY_REGISTRY.set('cell_mitosis', CellMitosisEnemy);
ENEMY_REGISTRY.set('pulse_spore', PulseSporeEnemy);
ENEMY_REGISTRY.set('bio_tentacle', BioTentacleEnemy);
ENEMY_REGISTRY.set('leech_parasite', LeechParasiteEnemy);
ENEMY_REGISTRY.set('heart_nucleus', HeartNucleusEnemy);
ENEMY_REGISTRY.set('boss_05', BossEnemy_05);