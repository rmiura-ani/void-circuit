/*
 * PROJECT: VOID-CIRCUIT
 *
 * game.js - ゲーム全体を統括するメインクラス
 *
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import { ScenarioManager } from './systems/scenario.js';
import { AssetManager } from './entities/base.js';
import { GameUIManager } from './game-ui.js';
import { GameCollisionManager } from './game-collision.js';

import './entities/enemies/index.js'; // これ1つで全ステージの敵がレジストリに登録される

import { Player, Bullet } from './entities/player.js';
import { Enemy, EnemyBullet } from './entities/enemy.js';
import { Particle, ScoreText } from './entities/effects.js';

/**
 * ゲーム全体を統括するメインクラス
 */
export class Game {
    /**
     * @param {Object} controller - SystemController への参照
     */
    constructor(controller) {
        this.sc = controller;
        this.canvas = controller.canvas;
        this.ctx = this.canvas.getContext('2d');

        this.width = 320;
        this.height = 480;
        this.uiHeaderHeight = 40;
        this.playerSpawnYOffset = 80;
        this.playerSpawnWaitTime = 90;
        this.playerSpawnInvincibleTime = 180;
        this.fps = 60;

        this.background = new BackgroundManager(this.width, this.height);

        this.scenario = new ScenarioManager();
        this.assets = new AssetManager(this.sc.assetBase);
        this.ui = new GameUIManager(this);
        this.collisions = new GameCollisionManager(this);

        // 内部状態
        this._score = 0;
        this._lives = controller.config.lives;
        this.isRunning = false;

        this.reset();

        // イベントリスナーの保持（破棄用）
        this._boundKeyDown = (e) => this.handleKeyDown(e);
        this._boundMouseDown = (e) => this.handleMouseDown(e);
    }

    // --- Getter / Setter ---

    get score() { return this._score; }
    set score(val) {
        this._score = val;
        this.ui.updateScoreUI();
    }

    get currentLives() { return this._lives; }
    set currentLives(val) {
        this._lives = val;
        this.ui.updateLivesUI();
    }

    // --- パブリックメソッド（ゲームフロー制御） ---

    /** 初期化 */
    reset() {
        this._score = 0;
        this.currentLives = this.sc.config.lives;
        this.stats = { enemiesSpawned: 0, enemiesKilled: 0, shotsFired: 0, shotsHit: 0, inputMode: "NONE" };
        this.isInvincibleCheat = this.sc.config.isInvincibleCheat;

        this.extendThreshold = this.sc.config.extend; 
        this.hasExtended = false;
        this.hasCounterStopped = false;

        this.missionConfig = {
            missionName: this.sc.tag,
            difficulty: this.sc.config.difficulty,
            extend: this.sc.config.extend,
            lives: this.sc.config.lives,
            cheatUsed: this.sc.config.isInvincibleCheat
        };        

        this.currentStageNum = 1;
        this.isCleared = false;
        this.isEnding = false;
        this.frame = 0;    
        this.isBossActive = false;
        this.bossStartTime = 0;
        this.postBossTimer = 0;
        this.gameOverTimer = 0;
        this.clearTimer = 0;
        this.respawnTimer = 0;
        this.escCount = 0;
        this.escTimer = null;

        this.entities = [];
        this.player = new Player(this, this.sc.input, 0, 0);
        this.player.x = this.width / 2 - this.player.halfWidth;
        this.player.y = this.height - this.playerSpawnYOffset;

        this.scenario.reset();
        this.sc.audio?.resetBGM();
    }

    /** ゲーム開始 */
    async start(initialInputMode, startStage = 1) {
        this.ui.resetGameUIState();
        const diffParams = {
            'EASY': { enemySpeed: 0.8, fireRate: 0.7 },
            'NORMAL': { enemySpeed: 1.0, fireRate: 1.0 },
            'HARD': { enemySpeed: 1.1, fireRate: 1.5 },
            'VERY HARD': { enemySpeed: 1.3, fireRate: 2.0 }
        };
        this.scenario.setDifficulty(diffParams[this.sc.config.difficulty]);
        
        this.reset();

        window.removeEventListener('keydown', this._boundKeyDown);
        window.removeEventListener('mousedown', this._boundMouseDown);
        window.addEventListener('keydown', this._boundKeyDown);
        window.addEventListener('mousedown', this._boundMouseDown);
        
        this.stats.inputMode = initialInputMode;

        const success = await this.initStage(startStage);
        if (!success) return; 

        Analytics.logLevelStart(this.missionConfig);
        this.isRunning = true;
    }

    /** ステージ情報を動的にセットアップ */
    async initStage(stageNum) {
        this.currentStageNum = stageNum;
        this.isBossActive = false;
        this.bossStartTime = 0;
        this.postBossTimer = 0; 
        this.isCleared = false;
        this.isEnding = false;
        this.clearTimer = 0;

        try {
            const success = await this.scenario.loadStageResources(stageNum, this.assets, this.sc.audio, this.sc.assetBase);
            
            if (success) {
                this.background.setup(this.scenario.bgColor, stageNum); 
                this.sc.audio?.playBGM();
                
                if (this.missionConfig) {
                    this.missionConfig.missionName = this.sc.tag;
                }
                console.log(`Stage ${stageNum} "${this.scenario.stageName}" Started.`);
                return true;
            } else {
                const errorReason = this.scenario.lastError || "Unknown asset loss.";
                this.endSession(`LOAD ERROR: ${errorReason}`); 
                return false;
            }
        } catch (error) {
            console.error(error);
            this.endSession(`LOAD CRASH: ${error.message}`); 
            return false;
        }
    }

    /** メインループ更新 */
    update() {
        this.background.update(this.frame);

        if (!this.isRunning) return;

        this.frame++;
        this.player.update(this.width, this.height);
        this.scenario.update(this.frame, this);

        if (this.player.alive) {
            this.collisions.check(); 
            this.checkClearCondition();
            this.updateInputMode();
            
            const isFiring = this.sc.input.isPressed('KeyZ') || this.sc.input.isPressed('Space') || this.sc.input.isTouching;
            if (this.frame % 5 === 0 && !this.isBossActive) {
                this.score += isFiring ? 20 : 30;   
            }
        }
        
        if (!this.player.alive && this.currentLives > 0) {
            this.respawnTimer++;
            if (this.respawnTimer > this.playerSpawnWaitTime) { 
                this.respawnPlayer();
                this.respawnTimer = 0;
            }
        }

        if (!this.player.alive && this.currentLives <= 0) {
            this.gameOverTimer++;
            if (this.gameOverTimer > 180) {
                this.endSession("GAME OVER");
            }
        }

        this.updateEntities();
        this.ui.updateDebugInfo(); 
    }

    /** エンティティ更新（一括処理） */
    updateEntities() {
        const currentEntities = [...this.entities];

        currentEntities.forEach(e => {
            e.update(this);

            // 画面外判定
            if (e.active && typeof e.isOutOfBounds === 'function') {
                if (e.isOutOfBounds()) {
                    e.active = false;
                }
            }
        });

        // active なものだけ抽出してクリーンアップ
        this.entities = this.entities.filter(e => e.active);
    }

    /** ボス戦スタート */
    startBossBattle() {
        this.isBossActive = true;
        this.bossStartTime = this.frame;
    }

    /** ステージクリア判定 */
    checkClearCondition() {
        if (this.frame < 180) return;

        const hasEnemies = this.entities.some(e => e instanceof Enemy);
        const isEnemyAllKilled = this.scenario.isFinished && !hasEnemies;

        if (isEnemyAllKilled && !this.isCleared) {
            this.postBossTimer++;

            // エンティティの存在を確認
            const isEffectsFinished = (this.entities.length === 0);
            const isTimeout = (this.postBossTimer >= 150);

            if (isEffectsFinished || isTimeout) {
                this.isCleared = true;
                this.clearTimer = 0; 
                this.sc.audio?.fadeOutBGM(3000); 
                console.log(`[System] All effects finished at frame ${this.postBossTimer}. Stage Cleared.`);
            }
        }

        if (this.isCleared) {
            this.clearTimer++;
            if (this.clearTimer === 180) { 
                if (this.currentStageNum < 7) {
                    this.goToNextStage();
                } else {
                    this.isEnding = true;
                }     
            }
        }
    }

    /** 次ステージへ */
    async goToNextStage() { 
        this.currentStageNum++;
        this.isCleared = false;
        this.clearTimer = 0;
        this.frame = 0; 
        
        await this.initStage(this.currentStageNum);
    }

    /** 被弾ミス */
    onPlayerMiss() {
        if (!this.player.alive) return;

        this.sc.audio?.playExplosion();
        const px = this.player.x + this.player.halfWidth;
        const py = this.player.y + this.player.halfHeight;
        for (let i = 0; i < 30; i++) {
            this.entities.push(new Particle(px, py, 'player'));
        }

        if (this.isInvincibleCheat) {
            this.player.setInvincible(this.playerSpawnInvincibleTime);
            return;
        }

        this.player.alive = false;
        this.respawnTimer = 0;      
        this.currentLives--;
        if (this.currentLives <= 0) {
            this.sc.audio?.fadeOutBGM();
        }
    }

    /** リスポーン */
    respawnPlayer() {
        this.player.x = this.width / 2 - this.player.halfWidth;
        this.player.y = this.height - this.playerSpawnYOffset;
        this.player.alive = true;
        this.player.setInvincible(this.playerSpawnInvincibleTime);
    }

    /** 描画マスタ */
    draw() {
        // 通常のゲーム画面を黒クリア
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.background.draw(this.ctx);
        
        if (!this.player) return;

        // 弾やエフェクトの描画
        this.entities.forEach(e => { if (e instanceof Bullet || e instanceof EnemyBullet) e.draw(this.ctx); });

        // 敵・ボスの描画
        this.entities.forEach(e => { if (e instanceof Enemy && !e.isBoss) e.draw(this.ctx, this.isInvincibleCheat); });
        this.entities.forEach(e => { if (e instanceof Enemy && e.isBoss) e.draw(this.ctx, this.isInvincibleCheat); });

        // 一般的な Entity（WarningEffect や ScoreText など）を描画
        this.entities.forEach(e => {
            if (!(e instanceof Enemy) && !(e instanceof Bullet) && !(e instanceof EnemyBullet)) {
                e.draw(this.ctx);
            }
        });

        // 自機描画
        this.player.draw(this.ctx);

        // UIオーバーレイ
        this.ui.drawOverlayMessages(this.ctx);
    }

    /** ゲーム終了 */
    endSession(msg) {
        if (!this.isRunning && this.gameOverTimer > 182) return;
        this.isRunning = false;

        window.removeEventListener('keydown', this._boundKeyDown);
        window.removeEventListener('mousedown', this._boundMouseDown);

        this.missionConfig.score = this.score;
        Analytics.logLevelEnd(this.missionConfig, this.stats, this.score, this.isCleared);

        Analytics.logPostScore(this.score, this.currentStageNum);
        const isNew = this.score > this.sc.highScore && this.score > 0;
        if (isNew) {
            this.sc.highScore = this.score;
            Analytics.logAchievement('HI_SCORE_BREAK');
        }
        
        const weaponContainer = document.getElementById('weapon-container');
        if (weaponContainer) weaponContainer.style.display = 'none';
        
        this.sc.showStartScreen(msg, isNew);
        this.sc.startIdleTimer();
    }

    // --- プライベート・内部処理用メソッド ---

    /** キー入力ハンドラ */
    handleKeyDown(e) {
        if (!this.isRunning) return;
        if (e.key === 'Escape') this.handleEmergencyEscape();
    }

    /** マウス入力ハンドラ */
    handleMouseDown(e) { }

    /** ESC連打でゲーム終了 */
    handleEmergencyEscape() {
        if (this.escTimer) clearTimeout(this.escTimer);

        this.escCount++;
        this.ui.visualEffectWarning(); 

        if (this.escCount >= 2) {
            this.escCount = 0;
            this.escTimer = null;
            
            this.currentLives = 0;
            this.gameOverTimer = 180;
            if (this.player.alive) this.onPlayerMiss(); 
            this.sc.audio?.fadeOutBGM(1000);
            this.endSession("EMERGENCY EXIT");
        } else {
            this.escTimer = setTimeout(() => {
                this.escCount = 0;
                this.escTimer = null;
            }, 1000);
        }
    }

    /** 操作モードの動的記録 */
    updateInputMode() {
        if (this.stats.inputMode === 'BOTH') return;
        const isKeyActive = (this.sc.input.isPressed('KeyZ') || this.sc.input.isPressed('Space') || this.sc.input.isPressed('ArrowUp'));
        if (this.stats.inputMode === 'KEYBOARD' && this.sc.input.isTouching) this.stats.inputMode = 'BOTH';
        else if (this.stats.inputMode === 'MOUSE' && isKeyActive) this.stats.inputMode = 'BOTH';
    }
}