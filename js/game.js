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
import { BackgroundManager } from './background.js'; // ★ 不足していたインポートを追加

import './entities/enemies/index.js'; // 全ステージの敵がレジストリに登録される

import { Player, Bullet } from './entities/player.js';
import { Enemy, EnemyBullet } from './entities/enemy.js';
import { Particle, ScoreText } from './entities/effects.js';

// 設定・定数の定義
const GAME_CONFIG = {
    WIDTH: 320,
    HEIGHT: 480,
    UI_HEADER_HEIGHT: 40,
    PLAYER_SPAWN_Y_OFFSET: 80,
    PLAYER_SPAWN_WAIT_TIME: 90,
    PLAYER_SPAWN_INVINCIBLE_TIME: 180,
    FPS: 60,
    DIFFICULTY_PARAMS: {
        'EASY': { enemySpeed: 0.7, fireRate: 0.5 },
        'NORMAL': { enemySpeed: 1.0, fireRate: 1.0 },
        'HARD': { enemySpeed: 1.1, fireRate: 1.5 },
        'VERY HARD': { enemySpeed: 1.3, fireRate: 2.0 }
    }
};

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

        this.width = GAME_CONFIG.WIDTH;
        this.height = GAME_CONFIG.HEIGHT;
        this.playerSpawnYOffset = GAME_CONFIG.PLAYER_SPAWN_Y_OFFSET;
        this.playerSpawnWaitTime = GAME_CONFIG.PLAYER_SPAWN_WAIT_TIME;
        this.playerSpawnInvincibleTime = GAME_CONFIG.PLAYER_SPAWN_INVINCIBLE_TIME;

        this.background = new BackgroundManager(this.width, this.height);
        this.scenario = new ScenarioManager();
        this.assets = new AssetManager(this.sc.assetBase);
        this.ui = new GameUIManager(this);
        this.collisions = new GameCollisionManager(this);

        // 内部状態
        this._score = 0;
        this._lives = controller.config.lives;
        this.isRunning = false;

        this._abortController = null;

        this.reset();
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

    /** イベントリスナーの安全なアタッチ */
    _attachEventListeners() {
        this._detachEventListeners(); // 二重アタッチ防止

        this._abortController = new AbortController();
        const { signal } = this._abortController;

        window.addEventListener('keydown', (e) => this.handleKeyDown(e), { signal });
        window.addEventListener('mousedown', (e) => this.handleMouseDown(e), { signal });
    }

    /** イベントリスナーの解除 */
    _detachEventListeners() {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
    }

    /** ゲーム開始 */
    async start(initialInputMode, startStage = 1) {
        this.ui.resetGameUIState();
        
        const diffParam = GAME_CONFIG.DIFFICULTY_PARAMS[this.sc.config.difficulty] || GAME_CONFIG.DIFFICULTY_PARAMS['NORMAL'];
        this.scenario.setDifficulty(diffParam);
        
        this.reset();
        this._attachEventListeners();
        
        this.stats.inputMode = initialInputMode;

        const success = await this.initStage(startStage);
        if (!success) return; 

        if (typeof Analytics !== 'undefined') {
            Analytics.logLevelStart(this.missionConfig);
        }
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

            if (e.active && typeof e.isOutOfBounds === 'function') {
                if (e.isOutOfBounds()) {
                    e.active = false;
                }
            }
        });

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

    /** 描画マスタ（1ループで描画レイヤー順に一括処理） */
    draw() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.background.draw(this.ctx);
        
        if (!this.player) return;

        // 描画優先度を分類して1回の走査でバケット分け
        const bullets = [];
        const normalEnemies = [];
        const bossEnemies = [];
        const otherEntities = [];

        for (let i = 0; i < this.entities.length; i++) {
            const e = this.entities[i];
            if (e instanceof Bullet || e instanceof EnemyBullet) {
                bullets.push(e);
            } else if (e instanceof Enemy) {
                if (e.isBoss) bossEnemies.push(e);
                else normalEnemies.push(e);
            } else {
                otherEntities.push(e);
            }
        }

        // 重ね順に従って順次描画
        bullets.forEach(e => e.draw(this.ctx));
        normalEnemies.forEach(e => e.draw(this.ctx, this.isInvincibleCheat));
        bossEnemies.forEach(e => e.draw(this.ctx, this.isInvincibleCheat));
        otherEntities.forEach(e => e.draw(this.ctx));

        // 自機描画
        this.player.draw(this.ctx);

        // UIオーバーレイ
        this.ui.drawOverlayMessages(this.ctx);
    }

    /** ゲーム終了 */
    endSession(msg) {
        if (!this.isRunning && this.gameOverTimer > 182) return;
        this.isRunning = false;

        this._detachEventListeners();

        this.missionConfig.score = this.score;

        if (typeof Analytics !== 'undefined') {
            Analytics.logLevelEnd(this.missionConfig, this.stats, this.score, this.isCleared);
            Analytics.logPostScore(this.score, this.currentStageNum);
        }

        const isNew = this.score > this.sc.highScore && this.score > 0;
        if (isNew) {
            this.sc.highScore = this.score;
            if (typeof Analytics !== 'undefined') {
                Analytics.logAchievement('HI_SCORE_BREAK');
            }
        }
        
        const weaponContainer = document.getElementById('weapon-container');
        if (weaponContainer) weaponContainer.style.display = 'none';
        
        this.sc.showStartScreen(msg, isNew);
        this.sc.startIdleTimer();
    }

    /** インスタンス破棄 */
    destroy() {
        this.isRunning = false;
        this._detachEventListeners();
        if (this.escTimer) clearTimeout(this.escTimer);
    }

    // --- プライベート・内部処理用メソッド ---

    handleKeyDown(e) {
        if (!this.isRunning) return;
        if (e.key === 'Escape') this.handleEmergencyEscape();
    }

    handleMouseDown(e) { }

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

    updateInputMode() {
        if (this.stats.inputMode === 'BOTH') return;
        const isKeyActive = (this.sc.input.isPressed('KeyZ') || this.sc.input.isPressed('Space') || this.sc.input.isPressed('ArrowUp'));
        if (this.stats.inputMode === 'KEYBOARD' && this.sc.input.isTouching) this.stats.inputMode = 'BOTH';
        else if (this.stats.inputMode === 'MOUSE' && isKeyActive) this.stats.inputMode = 'BOTH';
    }
}