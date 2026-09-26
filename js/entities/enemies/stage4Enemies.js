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

        // 💡 フラッシュ用タイマー（フレーム数）
        this.hitFlashTimer = 0;
    }

    update(game) {
        if (!this.active) return;

        this.y += this.speedY;

        // 💡 被弾フラッシュのタイマー更新
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer--;
        }
    }

    /** 砂の防壁：ダメージ軽減処理 */
    takeDamage(amount) {
        const reducedAmount = Math.max(1, Math.floor(amount * 0.5));

        // 💡 被弾時にフラッシュタイマーをセット（例: 5フレーム間光る）
        this.hitFlashTimer = 5;

        return super.takeDamage(reducedAmount);
    }

    /** 💡 被弾時に発光させる描画処理 */
    draw(ctx) {
        ctx.save();

        if (this.hitFlashTimer > 0) {
            // 方法1: 明度とコントラストを大きく上げて全体を白く輝かせる（おすすめ）
            ctx.filter = 'brightness(3.0) contrast(1.5)';
            
            // （参考）もし黄色やオレンジっぽくシールド風に光らせたい場合はこちら：
            // ctx.filter = 'brightness(2.0) drop-shadow(0px 0px 10px #FFD700)';
        }

        super.draw(ctx);
        ctx.restore();
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


/**
 * RockEnemy: 超高速で垂直落下してくるデブリ・岩石型トラップ
 */
export class RockEnemy extends Enemy {
    static DEFAULT_SPEED_Y = 6.0;

    get imageName() { return "enemy_rock.webp"; }

    constructor(game, x, y, bulletType, speedY = RockEnemy.DEFAULT_SPEED_Y) {
        super(game, x, y, 'none', 1);
        this.speedX = -0.5
        this.speedY = speedY;
    }

    update(game) {
        if (!this.active) return;
        this.x += this.speedX;
        this.y += this.speedY;
    }

    static create(game, x, y, bType, data = {}) {
        return new RockEnemy(game, x, y, bType, data.speedY ?? RockEnemy.DEFAULT_SPEED_Y);
    }
}

/**
 * WormSegment: 連結エネミー（多関節）の胴体・尻尾パーツ
 */
export class WormSegment extends Enemy {
    static SEGMENT_SPACING = 20;

    constructor(game, head, index, isTail = false) {
        // 1. super 呼び出し前に画像キーを特定
        const imageKey = isTail ? "stage-4/enemy_worm_tail.webp" : "stage-4/enemy_worm_body.webp";

        // 2. 親クラス Enemy の初期化（第4引数は画像キーまたはbulletTypeとして親の仕様に合わせる）
        super(game, head.x, head.y - index * WormSegment.SEGMENT_SPACING, 'none', 1);

        this.head = head;
        this.index = index;
        this.isTail = isTail;
        this.customImageKey = imageKey;

        // 3. 正しいアセットの割り当て
        if (game?.assets) {
            this.image = game.assets.get(imageKey);
        }

        // サイズの初期化
        this.width = head.width || 24;
        this.height = head.height || 24;
    }

    // Enemy クラスが imageName を参照する場合のフォールバック
    get imageName() {
        return this.customImageKey || (this.isTail ? "stage-4/enemy_worm_tail.webp" : "stage-4/enemy_worm_body.webp");
    }

    update(game) {
        if (!this.active) return;

        if (this.head?.active) {
            const targetIndex = this.index * 6;
            const history = this.head.history;

            if (history && history.length > targetIndex) {
                const pos = history[targetIndex];
                this.x = pos.x;
                this.y = pos.y;
                this.angle = pos.angle;
                this.isSubmerged = pos.isSubmerged;
            } else {
                this.x = this.head.x;
                this.y = this.head.y - (this.index * WormSegment.SEGMENT_SPACING);
                this.angle = this.head.angle || 0;
            }
        } else {
            this.active = false;
        }
    }

    takeDamage(amount) {
        if (this.isSubmerged) return false;
        const isDead = super.takeDamage(amount);
        if (isDead && this.head) {
            this.head.removeSegment(this);
        }
        return isDead;
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        if (this.isSubmerged) {
            ctx.globalAlpha = 0.3;
        }

        // 進行方向に応じた回転
        if (this.angle !== undefined) {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate(this.angle - Math.PI / 2);
            ctx.translate(-centerX, -centerY);
        }

        // 描画自体は Enemy の共通処理（super.draw）に任せる
        super.draw(ctx);
        ctx.restore();
    }

    forceDestroy() {
        this.active = false;
        this.onDie(this.game, true);
    }
}

/**
 * WormEnemy: 連結エネミー（頭部）
 */
export class WormEnemy extends Enemy {
    static DEFAULT_LENGTH = 6;

    get imageName() { return "stage-4/enemy_worm_head.webp"; }

    constructor(game, x, y, bulletType, length = WormEnemy.DEFAULT_LENGTH, hp = 5) {
        super(game, x, y, bulletType, hp);

        // 胴体・尻尾パーツの画像を確実にプリロードしておく
        if (game?.assets) {
            game.assets.get("stage-4/enemy_worm_body.webp");
            game.assets.get("stage-4/enemy_worm_tail.webp");
        }

        this.baseX = x;
        this.speedY = 1.8;
        this.moveDirectionY = 1;
        this.timer = Math.random() * 100;

        this.angle = 0;
        this.isSubmerged = false;

        this.history = [];
        this.maxHistory = length * 10;

        this.segments = [];
        if (game?.entities) {
            for (let i = 1; i < length; i++) {
                const isTail = (i === length - 1);
                const seg = new WormSegment(game, this, i, isTail);
                this.segments.push(seg);
                game.entities.push(seg);
            }
        }
    }

    update(game) {
        if (!this.active) return;
        this.timer += 0.04;

        const gameHeight = game?.height || 600;
        const upperThreshold = gameHeight * 0.25;
        const lowerThreshold = gameHeight * 0.66;

        if (this.y >= lowerThreshold && this.moveDirectionY > 0) {
            this.moveDirectionY = -1;
            this.baseX = Math.max(80, Math.min(game.width - 80, this.baseX + (Math.random() - 0.5) * 120));
        }

        if (this.y <= upperThreshold && this.moveDirectionY < 0) {
            this.moveDirectionY = 1;
            this.baseX = Math.max(80, Math.min(game.width - 80, this.baseX + (Math.random() - 0.5) * 120));
        }

        const prevX = this.x;
        const prevY = this.y;

        this.y += this.speedY * this.moveDirectionY;
        this.x = this.baseX + Math.sin(this.timer * 1.5) * 80;

        const dx = this.x - prevX;
        const dy = this.y - prevY;
        this.angle = Math.atan2(dy, dx);

        const wave = Math.sin(this.timer * 2.5);
        this.isSubmerged = wave > 0.2;

        this.history.unshift({
            x: this.x,
            y: this.y,
            angle: this.angle,
            isSubmerged: this.isSubmerged
        });

        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }

        if (!this.isSubmerged && Math.random() < 0.025) {
            this.shoot(game);
        }
    }

    takeDamage(amount) {
        if (this.isSubmerged) return false;
        return super.takeDamage(amount);
    }

    draw(ctx) {
        ctx.save();
        if (this.isSubmerged) {
            ctx.globalAlpha = 0.3;
        }

        if (this.angle !== undefined) {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate(this.angle - Math.PI / 2);
            ctx.translate(-centerX, -centerY);
        }

        super.draw(ctx);
        ctx.restore();
    }

    removeSegment(seg) {
        const idx = this.segments.indexOf(seg);
        if (idx !== -1) {
            this.segments.splice(idx, 1);
            this.segments.forEach((s, i) => {
                s.index = i + 1;
            });
        }
    }

    takeDamageAndCheckDeath(amount) {
        const isDead = super.takeDamage(amount);
        if (isDead) {
            this.segments.forEach((seg, i) => {
                setTimeout(() => {
                    seg.forceDestroy();
                }, (i + 1) * 80);
            });
        }
        return isDead;
    }

    static create(game, x, y, bType, data = {}) {
        return new WormEnemy(game, x, y, bType, data.length ?? WormEnemy.DEFAULT_LENGTH, data.hp ?? 5);
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
ENEMY_REGISTRY.set('worm', WormEnemy);
ENEMY_REGISTRY.set('rock', RockEnemy);
ENEMY_REGISTRY.set('boss_04', BossEnemy_04);