/*
 * PROJECT: VOID-CIRCUIT
 *
 * 物理・衝突判定管理コンポーネント (game-collision.js)
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import { Player, Bullet } from './entities/player.js';
import { Enemy, EnemyBullet } from './entities/enemy.js';
import { ScoreText, Particle } from './entities/effects.js';

export class GameCollisionManager {
    constructor(game) {
        this.game = game;
    }

    check() {
        if (!this.game.player.alive) return;

        const enemies = [];
        const enemyBullets = [];
        const playerBullets = [];

        for (const e of this.game.entities) {
            if (!e.active) continue;
            if (e instanceof Enemy) enemies.push(e);
            else if (e instanceof EnemyBullet) enemyBullets.push(e);
            else if (e instanceof Bullet) playerBullets.push(e);
        }

        // 自機の当たり判定
        if (!this.game.player.isInvincible) {
            const px = this.game.player.x + this.game.player.halfWidth;
            const py = this.game.player.y + this.game.player.halfHeight;
            const hitRadiusSq = this.game.player.hitRadiusSq;

            for (const e of enemies) {
                if (this._isCircleHit(px, py, hitRadiusSq, e)) {
                    this.game.onPlayerMiss();
                    return; 
                }
            }
            for (const eb of enemyBullets) {
                if (this._isCircleHit(px, py, hitRadiusSq, eb)) {
                    this.game.onPlayerMiss();
                    return;
                }
            }
        }

        // 敵の当たり判定（vs 自機弾）
        for (const enemy of enemies) {
            if (!enemy.active) continue;

            // 💡 敵（ボス）が無敵状態（isInvincible === true）ならヒット判定自体をスキップ
            if (enemy.isInvincible) continue;

            if (
                enemy.y + enemy.height < this.game.uiHeaderHeight ||            
                enemy.y >= this.game.height ||          
                enemy.x + enemy.width <= 0 ||             
                enemy.x >= this.game.width              
            ) {
                continue;
            }

            for (const pBullet of playerBullets) {
                if (!pBullet.active) continue;
                if (!enemy.active) break;

                // 🎯 衝突判定（マルチヒットボックス対応の _checkHitResult を使用）
                const hitResult = this._checkHitResult(pBullet, enemy);

                if (hitResult.hit) {
                    pBullet.active = false;
                    this.game.stats.shotsHit++;

                    const baseDamage = pBullet.damage || 1;
                    const finalDamage = baseDamage * hitResult.multiplier;

                    if (enemy.takeDamage(finalDamage)) {
                        // 敵撃破処理
                        this.game.stats.enemiesKilled++;
                        this._calculateAttachScore(enemy);
                        if (typeof enemy.onDie === 'function') enemy.onDie(this.game);
                        
                        // 🛑 ボス撃破時のグランドフィナーレ・お片付け処理
                        if (enemy.isBoss) {
                            this.game.scenario.skipToAfterLoop();
                            
                            // 🌟 画面内・画面外（上空含む）すべての敵・敵弾を確実に一斉処理！
                            this.game.entities.forEach(e => {
                                // 自分自身（ボス自身）は除外
                                if (e === enemy) return;

                                // ① すべてのザコ敵の処理
                                if (e instanceof Enemy && e.active) {
                                    this.game.stats.enemiesKilled++;
                                    this._calculateAttachScore(e); // 密着ボーナス等のスコア計算

                                    const isVisible = (
                                        e.y >= this.game.uiHeaderHeight &&
                                        e.y < this.game.height &&
                                        e.x >= 0 &&
                                        e.x < this.game.width
                                    );

                                    if (isVisible) {
                                        if (typeof e.onDie === 'function') e.onDie(this.game, true);
                                    }
                                    
                                    e.active = false;
                                }
                                
                                // ② すべての敵弾の処理（敵弾は即消去）
                                if (e instanceof EnemyBullet) {
                                    e.active = false;
                                }
                            });
                            
                            console.log("[Collision] Boss defeated. Smart cleanup completed without auditory overload.");
                        }
                    } else {
                        // 敵ヒット処理
                        const amount = 10 * hitResult.multiplier; // 弱点ヒット時はヒット加算スコアも倍増
                        this.game.score += amount;

                        // 弱点（倍率 1.0 超）と通常部分で演出・SEを分ける
                        if (hitResult.multiplier > 1.0) {
                            if (this.game.sc.audio) {
                                // 弱点ヒット用音（無ければ既存音）
                                if (typeof this.game.sc.audio.playCriticalHit === 'function') {
                                    this.game.sc.audio.playCriticalHit();
                                } else {
                                    this.game.sc.audio.playHitSound();
                                }
                            }
                            // 弱点ヒット時はパーティクルを多めに出す
                            for (let i = 0; i < 3; i++) {
                                this.game.entities.push(new Particle(pBullet.x, pBullet.y, 'critical'));
                            }
                        } else {
                            if (this.game.sc.audio) this.game.sc.audio.playHitSound();
                            this.game.entities.push(new Particle(pBullet.x, pBullet.y));
                        }

                        // ボスだけスコア演出
                        if (enemy.isBoss) {
                            const scatterX = (Math.random() - 0.5) * 10;
                            const scatterY = (Math.random() - 0.5) * 10;
                            const color = hitResult.multiplier > 1.0 ? "#FF0" : "#0FF"; // 弱点は黄色表示
                            this.game.entities.push(new ScoreText(pBullet.x + scatterX, pBullet.y + scatterY, `+${amount}`, color));
                        }
                    }
                }
            }
        }
    }

    _isCircleHit(px, py, radiusSq, target) {
        const tx = target.x + target.width / 2;
        const ty = target.y + target.height / 2;
        const dx = px - tx;
        const dy = py - ty;
        return (dx * dx + dy * dy) < radiusSq;
    }

    /**
     * 弾と対象のヒット状態およびダメージ倍率を取得する
     * マルチヒットボックス (getHitboxes) がある場合は各ボックスを判定
     */
    _checkHitResult(bullet, enemy) {
        // 💡 対象（ボス等）が getHitboxes メソッドを持っている場合
        if (typeof enemy.getHitboxes === 'function') {
            const hitboxes = enemy.getHitboxes();
            const bw = bullet.hitWidth ?? bullet.width;
            const bh = bullet.hitHeight ?? bullet.height;
            const bx = bullet.x + (bullet.width - bw) / 2;
            const by = bullet.y + (bullet.height - bh) / 2;

            for (const box of hitboxes) {
                if (
                    bx < box.x + box.width &&
                    bx + bw > box.x &&
                    by < box.y + box.height &&
                    by + bh > box.y
                ) {
                    return { hit: true, multiplier: box.multiplier || 1.0, part: box.part };
                }
            }
            return { hit: false, multiplier: 1.0 };
        }

        // 💡 通常判定（従来通りの AABB 判定）
        return { hit: this._isHit(bullet, enemy), multiplier: 1.0 };
    }

    _isHit(r1, r2) {
        const w1 = r1.hitWidth ?? r1.width;
        const h1 = r1.hitHeight ?? r1.height;
        const w2 = r2.hitWidth ?? r2.width;
        const h2 = r2.hitHeight ?? r2.height;

        const r1Left = r1.x + (r1.width - w1) / 2;
        const r1Top  = r1.y + (r1.height - h1) / 2;
        const r2Left = r2.x + (r2.width - w2) / 2;
        const r2Top  = r2.y + (r2.height - h2) / 2;

        return r1Left < r2Left + w2 &&
               r1Left + w1 > r2Left &&
               r1Top < r2Top + h2 &&
               r1Top + h1 > r2Top;
    }

    _calculateAttachScore(enemy){
        const maxHp = enemy.maxHp || 1;
        const amount = 100 + (maxHp * 150);
        this.game.score += amount;

        const centerX = enemy.x + enemy.width / 2;
        let centerY = enemy.isBoss ? enemy.y + (enemy.height * 0.8) : enemy.y + enemy.height / 2;
        
        this.game.entities.push(new ScoreText(centerX, centerY, amount));

        // ボスはタイムボーナスがある
        if (enemy.isBoss){
            const elapsed = this.game.frame - this.game.bossStartTime;
            const limit = enemy.timeLimit || 3600;
            const maxBonus = amount * 0.25;
            const decayRate = maxBonus / limit;
            const rawBonus = Math.max(0, maxBonus - (elapsed * decayRate));
            const bonus = Math.floor(rawBonus / 100) * 100;
            if (bonus > 0) {
                this.game.score += bonus;
                this.game.entities.push(new ScoreText( this.game.width / 2, this.game.height / 2, ["TIME BONUS", bonus.toLocaleString()], "#0FF"));
            }
        }
    }

    createExplosion(x, y, enemy, soundoff = false) {
        const hp = enemy.maxHp || 1;
        
        // パーティクル数に上限（キャップ）を設ける（最大60個程度に抑える）
        const rawCount = 10 + Math.floor(hp * 0.2); 
        const count = enemy.isBoss ? Math.min(rawCount, 60) : Math.min(rawCount, 30);
        const type = enemy.isBoss ? 'boss' : 'enemy';

        // パーティクルの生成
        for (let i = 0; i < count; i++) {
            this.game.entities.push(new Particle(x, y, type));
        }

        // 【修正2】SEの制御（単体の爆発生成では1回だけ鳴らす）
        if (this.game.sc.audio && !soundoff) {
            this.game.sc.audio.playExplosion();
        }
    }
}