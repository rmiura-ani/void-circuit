/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage4Enemies.js - STAGE-4 (Ancient Logic) 固有敵クラス群 & ボス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import { Enemy, BossEnemy, EnemyBullet, ENEMY_REGISTRY } from '../enemy.js';

// ==========================================
// 1. STAGE-4 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 1. DustScout: 画面下部（砂塵の中から）逆噴射で「下から上へ」上昇してくる逆スクロール偵察機
 */
export class DustScoutEnemy extends Enemy {
    get imageName() { return "enemy_dust_scout.webp"; }

    constructor(game, x, y, bulletType) {
        // yは利用せず、画面最下部からスポーン
        const spawnY = game.height + 32;
        super(game, x, spawnY, bulletType, 1); // HP = 1
        this.speedY = -2.5; // 上昇移動
        this.hasShot = false;
    }

    update(game) {
        if (!this.active) return;

        this.y += this.speedY;

        // 画面の中央高度に差し掛かった瞬間に狙い撃ち弾を放つ
        if (this.y <= game.height / 2 && !this.hasShot) {
            this.shoot(game);
            this.hasShot = true;
        }

        if (this.y < -50) {
            this.active = false;
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new DustScoutEnemy(game, x, y, bType);
    }
}

/**
 * 2. RelicPrism: 八角形の古代パーツ。一定位置で静止・回転しながら幾何学的な格子状クロス弾幕を生成
 */
export class RelicPrismEnemy extends Enemy {
    get imageName() { return "enemy_relic_prism.webp"; }

    constructor(game, x, y, bulletType, stopY = 120) {
        super(game, x, y, bulletType, 3); // HP = 3
        this.width = 80;
        this.height = 80;
        this.stopY = stopY;
        this.timer = 0;
        this.rotationAngle = 0;
        this.state = 'MOVE_IN'; // MOVE_IN, ROTATE_FIRE, RETREAT
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'MOVE_IN':
                this.y += 2.0;
                if (this.y >= this.stopY) {
                    this.state = 'ROTATE_FIRE';
                }
                break;

            case 'ROTATE_FIRE':
                this.timer++;
                this.rotationAngle += 0.05; // 幾何学的な回転

                // 連射間隔がゼロ以下にならないよう Math.max(1, ...) で保護
                const interval = Math.max(1, Math.floor(50 / (this.fireRateMultiplier || 1)));
                if (this.timer % interval === 0) {
                    this.shootCrossBullet(game);
                }

                if (this.timer >= 250) {
                    this.state = 'RETREAT';
                }
                break;

            case 'RETREAT':
                this.y -= 2.0;
                break;
        }
    }

    shootCrossBullet(game) {
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;

        for (let i = 0; i < 4; i++) {
            const angle = this.rotationAngle + (Math.PI / 2) * i;
            const vx = Math.cos(angle) * 3.0;
            const vy = Math.sin(angle) * 3.0;
            game.entities.push(new EnemyBullet(bx, by, vx, vy));
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new RelicPrismEnemy(game, x, y, bType, data.stopY || 120);
    }
}

/**
 * 3. MirageCrawler: 砂漠の蜃気楼（ラスタスクロール波形）のようにX軸がブレながらゆっくり降下する機体
 */
export class MirageCrawlerEnemy extends Enemy {
    get imageName() { return "enemy_mirage_crawler.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); // HP = 2
        this.baseX = x;
        this.speedY = 1.0;
        this.timer = Math.random() * 100;
    }

    update(game) {
        if (!this.active) return;
        this.timer += 0.1;

        this.y += this.speedY;
        // 蜃気楼特有の細かく歪むラスタ揺らぎ運動
        this.x = this.baseX + Math.sin(this.timer) * 35;

        if (Math.floor(this.timer * 10) % 80 === 0) {
            this.shoot(game);
        }

    }

    static create(game, x, y, bType, data = {}) {
        return new MirageCrawlerEnemy(game, x, y, bType);
    }
}

/**
 * 4. SandPillar: 縦長柱状の防壁構造。前面からの通常弾を大幅軽減/跳ね返す無効化ガードを持つ
 */
export class SandPillarEnemy extends Enemy {
    get imageName() { return "enemy_sand_pillar.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 5); // HP = 5
        this.width = 64;
        this.height = (467/394) * 64;
        this.speedY = 0.5;
    }

    update(game) {
        if (!this.active) return;

        this.y += this.speedY;

    }

    /** 砂の防壁：ダメージ軽減処理 */
    takeDamage(amount) {
        const reducedAmount = Math.max(1, Math.floor(amount * 0.5));
        return super.takeDamage(reducedAmount);
    }

    static create(game, x, y, bType, data = {}) {
        return new SandPillarEnemy(game, x, y, bType);
    }
}

/**
 * 5. GigaOrb: エネルギーチャージ（フラッシュ前兆）を行い、直線状に太い弾幕を一気に射出する高耐久コア
 */
export class GigaOrbEnemy extends Enemy {
    get imageName() { return "enemy_giga_orb.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 10); // HP = 10
        this.width = (510/440) * 48;
        this.height = 48;
        this.state = 'CHARGE'; // CHARGE, FIRE, RETREAT
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;

        switch (this.state) {
            case 'CHARGE':
                this.y += 0.8;
                this.timer++;

                // チャージ完了（約2秒）で極太バースト発射フェーズへ
                if (this.timer >= 120) {
                    this.state = 'FIRE';
                    this.timer = 0;
                }
                break;

            case 'FIRE':
                this.timer++;

                // 5F刻みで真下に連続高密度高速射撃（擬似極太ビーム）
                if (this.timer % 5 === 0) {
                    const bx = this.x + this.width / 2;
                    const by = this.y + this.height;
                    game.entities.push(new EnemyBullet(bx - 8, by, 0, 6.0));
                    game.entities.push(new EnemyBullet(bx + 8, by, 0, 6.0));
                }

                if (this.timer >= 60) { // 1秒間連射後退避
                    this.state = 'RETREAT';
                }
                break;

            case 'RETREAT':
                this.y -= 2.0;
                break;
        }
    }

    draw(ctx) {
        ctx.save();
        // チャージ中は激しく赤黄色に点滅発光する演出
        if (this.state === 'CHARGE') {
            const glow = Math.sin(this.timer * 0.3) * 0.5 + 0.5;
            ctx.filter = `brightness(${1.0 + glow * 1.5}) saturate(${1.0 + glow * 2.0})`;
        }
        super.draw(ctx);
        ctx.restore();
    }

    static create(game, x, y, bType, data = {}) {
        const enemy = new GigaOrbEnemy(game, x, y, bType);
        if (data.hp) enemy.hp = data.hp;
        return enemy;
    }
}


// ==========================================
// 2. STAGE-4 ボス実体
// ==========================================

/**
 * STAGE-4 ボス: 地上絵守護神（Ancient Golem / BossEnemy_04）
 * 特徴: 幾何学的な遺跡の地上絵をなぞるように多角形移動し、ポイント毎にサークル弾幕を展開する石像守護神
 */
export class BossEnemy_04 extends BossEnemy {
    get imageName() { return "enemy_boss_04.webp"; }

    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        // 出現位置は引数の y または画面外上部 (-128)
        const startY = (y !== undefined && y !== null) ? y : -128;
        super(game, x, startY, hp, timeLimit, timeMultiplier);
        
        this.isBoss = true;
        this.width = 128;
        this.height = 128;
        this.hitWidth = 100;
        this.hitHeight = 100;

        this.state = 'APPEAR';
        this.timer = 0;
        this.baseX = x;
        // 地上絵（三角形〜ひし形）を描く目標チェックポイント
        this.points = [
            { x: x - 80, y: 50 },
            { x: x + 80, y: 120 },
            { x: x, y: 80 }
        ];
        this.targetPointIndex = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.8;
                if (this.y >= 50) {
                    this.state = 'PATROL_PATTERN';
                    this.timer = 0;
                }
                break;

            case 'PATROL_PATTERN':
                const target = this.points[this.targetPointIndex];
                const dx = target.x - this.x;
                const dy = target.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // ポイントへ向けて幾何学的に一直線に直線移動
                if (dist > 4) {
                    this.x += (dx / dist) * 2.2;
                    this.y += (dy / dist) * 2.2;
                } else {
                    // 到着時に全方位8方向弾発射＆次の目標へ切り替え
                    this.targetPointIndex = (this.targetPointIndex + 1) % this.points.length;
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }

                // 移動中も定期的に狙い撃ち3WAY弾幕
                if (this.timer % 35 === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }
                break;
        }
    }

    static create(game, x, y, bType, data = {}) {
        return new BossEnemy_04(
            game, x, y, 
            data.hp || 80, 
            data.timeLimit || 1800, 
            data.timeMultiplier || 100
        );
    }
}


// ==========================================
// 3. ENEMY_REGISTRY への自動登録
// ==========================================

ENEMY_REGISTRY.set('dust_scout', DustScoutEnemy);
ENEMY_REGISTRY.set('relic_prism', RelicPrismEnemy);
ENEMY_REGISTRY.set('mirage_crawler', MirageCrawlerEnemy);
ENEMY_REGISTRY.set('sand_pillar', SandPillarEnemy);
ENEMY_REGISTRY.set('giga_orb', GigaOrbEnemy);
ENEMY_REGISTRY.set('boss_04', BossEnemy_04);