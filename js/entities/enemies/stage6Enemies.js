/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/enemies/stage6Enemies.js - STAGE-6 (Burning Orbit) 固有敵クラス群 & ボス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

// ==========================================
// 1. STAGE-6 固有のザコ・中型敵クラス群
// ==========================================

/**
 * 1. OrbitInterceptor: 画面奥から大気圏突入（赤熱エフェクト）とともに超高速進入し、急ブレーキ後ミサイルを撒く邀撃機
 */
class OrbitInterceptorEnemy extends Enemy {
    get imageName() { return "enemy_orbit_interceptor.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); // HP = 2
        this.speedY = 6.0; // 超高速急降下
        this.timer = 0;
        this.state = 'ENTRY'; // ENTRY, BRAKE, RETREAT
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'ENTRY':
                this.y += this.speedY;
                // 一定高度（y=140）まで進入したらブレーキ
                if (this.y >= 140) {
                    this.state = 'BRAKE';
                    this.bulletType = 'triple';
                    this.shoot(game); // 急ブレーキと同時に3方向弾射出
                }
                break;

            case 'BRAKE':
                this.y += 0.5; // 進入時の勢いで微速降下
                if (this.timer >= 90) {
                    this.state = 'RETREAT';
                }
                break;

            case 'RETREAT':
                this.y -= 4.0; // 上空へ急高速離脱
                if (this.isOutOfBounds(50, true)) {
                    this.active = false;
                }
                break;
        }
    }

    draw(ctx, isInvincibleCheat = false) {
        ctx.save();
        // 突入フェーズ時は大気圏摩擦を思わせる高輝度の赤熱フィルター
        if (this.state === 'ENTRY') {
            ctx.filter = 'brightness(1.8) saturate(2) drop-shadow(0px 0px 8px #FF4500)';
        }
        super.draw(ctx, isInvincibleCheat);
        ctx.restore();
    }

    static create(game, x, y, bType, data) {
        return new OrbitInterceptorEnemy(game, x, y, bType);
    }
}

/**
 * 2. HeatArmor: 正面装甲が完全耐熱加工されており、正面からの攻撃によるダメージを「0」に抑え込む重装甲機
 */
class HeatArmorEnemy extends Enemy {
    get imageName() { return "enemy_heat_armor.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 6); // HP = 6
        this.speedY = 0.6; // 鈍重な進行
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += this.speedY;

        if (this.timer % Math.floor(70 / this.fireRateMultiplier) === 0) {
            this.bulletType = 'straight';
            this.shoot(game);
        }

        if (this.isOutOfBounds(60, true)) {
            this.active = false;
        }
    }

    /** 💡 正面耐熱装甲：自機が真下（正面）にいる状態での攻撃ダメージを無効化（0）にする */
    takeDamage(amount) {
        if (this.game && this.game.player) {
            const playerX = this.game.player.x + this.game.player.width / 2;
            const myX = this.x + this.width / 2;
            // 自機のX座標が正面（幅±20px以内）から撃たれた場合は装甲で無効化
            if (Math.abs(playerX - myX) < 20) {
                return false; // ダメージ不成立（弾かれる）
            }
        }
        return super.takeDamage(amount);
    }

    static create(game, x, y, bType, data) {
        return new HeatArmorEnemy(game, x, y, bType);
    }
}

/**
 * 3. HomingPod: 自機を執拗に低速追尾するホーミングミサイル弾（HomingBullet）を射出するポッド機
 */
class HomingPodEnemy extends Enemy {
    get imageName() { return "enemy_homing_pod.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 2); // HP = 2
        this.speedY = 0.8;
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += this.speedY;

        // 80Fごとに自機追尾型の誘導弾を発射
        if (this.timer % Math.floor(80 / this.fireRateMultiplier) === 0) {
            this.shootHomingBullet(game);
        }

        if (this.isOutOfBounds(50, true)) {
            this.active = false;
        }
    }

    shootHomingBullet(game) {
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;

        if (game.player && game.player.alive) {
            const dx = (game.player.x + game.player.width / 2) - bx;
            const dy = (game.player.y + game.player.height / 2) - by;
            const angle = Math.atan2(dy, dx);
            const speed = 2.5;
            game.entities.push(new EnemyBullet(bx, by, Math.cos(angle) * speed, Math.sin(angle) * speed));
        }
    }

    static create(game, x, y, bType, data) {
        return new LeechParasiteEnemy(game, x, y, bType);
    }
}

/**
 * 4. BeamCruiser: 画面横から巨大戦艦のパーツとしてスライド出現。画面左/右半分を薙ぎ払う極太ビーム前兆攻撃を行う
 */
class BeamCruiserEnemy extends Enemy {
    get imageName() { return "enemy_beam_cruiser.webp"; }

    constructor(game, x, y, bulletType) {
        super(game, x, y, bulletType, 8); // 高耐久 HP = 8
        this.width = 80;
        this.height = 48;
        this.speedY = 0.4;
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += this.speedY;

        // 40F周期で強力な3WAY拡散弾を放射
        if (this.timer % Math.floor(40 / this.fireRateMultiplier) === 0) {
            this.bulletType = 'triple';
            this.shoot(game);
        }

        if (this.isOutOfBounds(70, true)) {
            this.active = false;
        }
    }

    static create(game, x, y, bType, data) {
        const enemy = new BeamCruiserEnemy(game, x, y, bType);
        if (data.hp) enemy.hp = data.hp;
        return enemy;
    }
}

/**
 * 5. BurnerDrone: 画面下部から高熱バーナーを突き上げながら上昇してくるバーナー機
 */
class BurnerDroneEnemy extends Enemy {
    get imageName() { return "enemy_burner_drone.webp"; }

    constructor(game, x, y, bulletType) {
        // 画面下部から出現
        const startY = game.height + 32;
        super(game, x, startY, bulletType, 3); // HP = 3
        this.speedY = -1.8; // 上昇
        this.timer = 0;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        this.y += this.speedY;

        // 上昇しながら前方に高速連射（突き上げる火炎）
        if (this.timer % Math.floor(20 / this.fireRateMultiplier) === 0) {
            const bx = this.x + this.width / 2;
            const by = this.y;
            game.entities.push(new EnemyBullet(bx, by, 0, -4.0)); // 上向き発射
        }

        if (this.y < -50) {
            this.active = false;
        }
    }

    static create(game, x, y, bType, data) {
        return new BurnerDroneEnemy(game, x, y, bType);
    }
}


// ==========================================
// 2. STAGE-6 ボス実体
// ==========================================

/**
 * STAGE-6 ボス: 超巨大空中戦艦（Burning Dread / BossEnemy_06）
 * 特徴: 画面上部をほぼ占拠する要塞級巨大ボディ。反動を伴う砲撃と、HP30%以下での赤熱発狂モード
 */
class BossEnemy_06 extends BossEnemy {
    get imageName() { return "enemy_boss_06.webp"; }

    constructor(game, x, y, hp, timeLimit, timeMultiplier) {
        y = -180;
        super(game, x, y, hp, timeLimit, timeMultiplier);
        this.isBoss = true;
        this.width = 240; // 圧倒的巨体
        this.height = 140;
        this.hitWidth = 200;
        this.hitHeight = 100;

        this.state = 'APPEAR';
        this.timer = 0;
        this.baseX = x - 50; // 中心調整
        this.x = this.baseX;
    }

    update(game) {
        if (!this.active) return;
        this.timer++;

        switch (this.state) {
            case 'APPEAR':
                this.y += 0.4; // 重々しく進入
                if (this.y >= 20) {
                    this.state = 'HEAVY_BOMBARD';
                    this.timer = 0;
                }
                break;

            case 'HEAVY_BOMBARD':
                // 重厚な大口径砲の反動を模した微震動
                this.x = this.baseX + Math.sin(this.timer * 0.1) * 15;

                if (this.timer % 30 === 0) {
                    this.bulletType = 'triple';
                    this.shoot(game);
                }

                // HPが30%以下になると熱暴走（対空全開発狂モード）
                if (this.hp < this.maxHp * 0.3) {
                    this.state = 'OVERDRIVE';
                }
                break;

            case 'OVERDRIVE':
                this.x = this.baseX + Math.sin(this.timer * 0.2) * 30; // 激しい狂い揺れ
                if (this.timer % 12 === 0) {
                    this.bulletType = 'eight-way';
                    this.shoot(game);
                }
                if (this.timer % 20 === 0) {
                    this.bulletType = 'straight';
                    this.shoot(game);
                }
                break;
        }
    }

    draw(ctx, isInvincibleCheat = false) {
        ctx.save();
        if (this.state === 'OVERDRIVE') {
            ctx.filter = 'saturate(3) contrast(1.5) brightness(1.3)'; // 炎上・過熱エフェクト
        }
        super.draw(ctx, isInvincibleCheat);
        ctx.restore();
    }

    onDie(game) {
        for (let i = 0; i < 24; i++) {
            setTimeout(() => {
                game.collisions.createExplosion(
                    this.x + Math.random() * this.width, 
                    this.y + Math.random() * this.height, 
                    { maxHp: 150 }
                );
            }, i * 80);
        }
    }

    static create(game, x, y, bType, data) {
        return new BossEnemy_06(
            game, x, y, 
            data.hp || 120, 
            data.timeLimit || 1800, 
            data.timeMultiplier || 100
        );
    }
}


// ==========================================
// 3. ENEMY_REGISTRY への自動登録
// ==========================================

if (typeof ENEMY_REGISTRY !== 'undefined') {
    ENEMY_REGISTRY.set('orbit_interceptor', OrbitInterceptorEnemy);
    ENEMY_REGISTRY.set('heat_armor', HeatArmorEnemy);
    ENEMY_REGISTRY.set('homing_pod', HomingPodEnemy);
    ENEMY_REGISTRY.set('beam_cruiser', BeamCruiserEnemy);
    ENEMY_REGISTRY.set('burner_drone', BurnerDroneEnemy);
    ENEMY_REGISTRY.set('boss_06', BossEnemy_06);
} else {
    console.error('[Enemy Registry Error] ENEMY_REGISTRY is not defined. Make sure EnemyBase.js is loaded first.');
}