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
import { BackgroundManager } from './background.js';
import { Random } from './systems/random.js';
import { ReplayManager } from './systems/replayManager.js';
import { ReplayStorage } from './systems/replayStorage.js';


import './entities/enemies/index.js'; // 全ステージの敵がレジストリに登録される

import { Player, Bullet } from './entities/player.js';
import { Enemy, EnemyBullet } from './entities/enemy.js';
import { Particle } from './entities/effects.js';

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
        'EASY': { 
            fireRate: 0.7, 
            bulletSpeed: 0.75, 
            wayBonus: -1 
        },
        'NORMAL': { 
            fireRate: 1.0, 
            bulletSpeed: 0.9,  
            wayBonus: 0  
        },
        'HARD': { 
            fireRate: 1.3, 
            bulletSpeed: 1.0,  
            wayBonus: 1  
        },
        'VERY HARD': { 
            fireRate: 1.6, 
            bulletSpeed: 1.1,  
            wayBonus: 2  
        }
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
        this.replay = new ReplayManager();

        // 内部状態
        this._score = 0;
        this.lives = controller.config.lives;
        this.isRunning = false;

        this._abortController = null;

        this.reset();
    }

    // --- Getter / Setter ---

    get score() { return this._score; }
    set score(value) {
        const delta = value - this._score;
        this._score = value;

        // 加算（正の増加）があった場合のみエクステンド判定を行う
        if (delta > 0) {
            this.checkExtend();
        }
    }


    // --- パブリックメソッド（ゲームフロー制御） ---

    /** 初期化 */
    reset(seed = Date.now()) {
        this.seed = seed;
        this.random = new Random(this.seed); // 決定論的乱数の初期化

        this._score = 0;
        this.lives = this.sc.config.lives;
        this.stats = { enemiesSpawned: 0, enemiesKilled: 0, shotsFired: 0, shotsHit: 0, inputMode: "NONE" };
        this.isInvincibleCheat = this.sc.config.isInvincibleCheat;

        this.extendThreshold = this.sc.config.extend; 
        this.extendIndex = 0;
        this.hasExtended = false; // 単一値指定用フラグのリセット

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
        this.sc.audio.resetBGM();
    }

    /** イベントリスナーの安全なアタッチ */
    _attachEventListeners() {
        this._detachEventListeners(); // 二重アタッチ防止

        this._abortController = new AbortController();
        const { signal } = this._abortController;

        window.addEventListener('keydown', (e) => this.handleKeyDown(e), { signal });

        if (this.replay.mode === 'RECORD') {

            // --- ブラウザ非アクティブ時の自動ポーズ処理 ---
            const triggerAutoPause = () => {
                const isGameOver = (!this.player.alive && this.lives <= 0);

                if (this.isRunning && !isGameOver && !this.isPaused) {
                    this.isPaused = true;
                    this.sc.audio.pauseBGM();
                }
            };

            // タブ切り替え / バックグラウンド化
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) triggerAutoPause();
            }, { signal });

            // ウィンドウのフォーカス外れ
            window.addEventListener('blur', triggerAutoPause, { signal });
        }

        // ポーズ解除：ポーズ中に Canvas をクリック/タップで再開
        const resumeGame = (e) => {
            if (this.isRunning && this.isPaused) {
                e.stopPropagation();
                this.isPaused = false;
                this.sc.audio.resumeBGM();
            }
        };

        if (this.canvas) {
            this.canvas.addEventListener('mousedown', resumeGame, { signal });
            this.canvas.addEventListener('touchstart', resumeGame, { signal });
        }
    }

    /** イベントリスナーの解除 */
    _detachEventListeners() {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
    }

    /** 通常ゲーム開始（録画モード） */
    async start(initialInputMode, startStage = 1, seed = Date.now()) {
        this.reset(seed);
        this.replay.startRecording(this.seed);
        this._attachEventListeners();
        
        this.stats.inputMode = initialInputMode;

        const success = await this.initStage(startStage);
        if (!success) return; 

        if (typeof Analytics !== 'undefined') {
            Analytics.logLevelStart(this.missionConfig);
        }
        this.isRunning = true;
    }

    /** リプレイ再生開始 */
    async startReplay(replayData, startStage = 1) {
        this.reset(replayData.seed);
        this.replay.startPlayback(replayData);
        this._attachEventListeners();

        const success = await this.initStage(startStage);
        if (!success) return;

        this.isRunning = true;
    }

    /** ステージ情報を動的にセットアップ */
    async initStage(stageNum) {
        this.ui.resetStageUIState();

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
                const diffParam = GAME_CONFIG.DIFFICULTY_PARAMS[this.sc.config.difficulty] || GAME_CONFIG.DIFFICULTY_PARAMS['NORMAL'];
                this.scenario.setDifficulty(diffParam);
                this.background.setup(this.scenario.bgColor, stageNum); 
                this.sc.audio.playBGM();
                
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
        if (this.isPaused || !this.isRunning) return;

        this.background.update(this.frame);

        const isPlayback = this.replay && this.replay.mode === 'PLAYBACK';

        if (isPlayback) {
            // --- 1. 再生モード：ログから状態を読み込み ---
            const frameData = this.replay.getCurrentFrameData();

            if (!frameData && this.replay.log.length > 0) {
                this.endSession("REPLAY FINISHED");
                return;
            }

            if (frameData && this.player) {
                this.player.x = frameData.x;
                this.player.y = frameData.y;

                this.currentInputState = {
                    isFiring: frameData.f === 1,
                    isRightClick: frameData.b === 1,
                    isDoubleTap: false,
                    isCanvasOutClick: false
                };

                // 再生中もショット・武器切替アニメーション等の更新のために呼ぶ
                this.player.update(this.width, this.height, this.currentInputState);
            }
        } else {
            // --- 2. 通常プレイ：Input管理クラスから1度だけ取得して確定 ---
            const isKeyFiring = this.sc.input.isPressed('KeyZ') || this.sc.input.isPressed('Space');
            const isFiring = isKeyFiring || this.sc.input.isTouching;

            const isRightClick = this.sc.input.getAndResetRightClick();
            const isDoubleTap = this.sc.input.getAndResetDoubleTap();
            const isCanvasOutClick = typeof this.sc.input.getAndResetCanvasOutClick === 'function' 
                ? this.sc.input.getAndResetCanvasOutClick() : false;

            this.currentInputState = {
                isTouching: this.sc.input.isTouching,
                touchX: this.sc.input.touchX,
                touchY: this.sc.input.touchY,
                isFiring: isFiring,
                isRightClick: isRightClick,
                isDoubleTap: isDoubleTap,
                isCanvasOutClick: isCanvasOutClick
            };

            if (this.player) {
                // 自機の移動＆武器切替（判定済みデータを与えるだけ）
                this.player.update(this.width, this.height, this.currentInputState);

                // 録画ログ出力（右クリック・ダブルタップ・画面外タップのいずれが発生したかを記録）
                if (this.replay && this.replay.mode === 'RECORD') {
                    const isWeaponSwitchTriggered = isRightClick || isDoubleTap || isCanvasOutClick;
                    this.replay.recordFrame(this.player.x, this.player.y, isFiring, isWeaponSwitchTriggered);
                }
            }
        }

        this.frame++;

        // シナリオ・判定の進行
        this.scenario.update(this);

        if (this.player && this.player.alive) {
            this.collisions.check();
            this.checkClearCondition();
            this.updateInputMode();

            if (this.frame % 5 === 0 && !this.isBossActive) {
                this.score += this.currentInputState.isFiring ? 20 : 30;
            }
        }

        if (this.player && !this.player.alive && this.lives > 0) {
            this.respawnTimer++;
            if (this.respawnTimer > this.playerSpawnWaitTime) {
                this.respawnPlayer();
                this.respawnTimer = 0;
            }
        }

        if (this.player && !this.player.alive && this.lives <= 0) {
            this.gameOverTimer++;
            if (this.gameOverTimer > 180) {
                this.endSession("GAME OVER");
            }
        }

        this.updateEntities();

        if (this.ui) {
            this.ui.update();
            this.ui.updateDebugInfo();
        }
    }

    /** エンティティ更新（一括処理） */
    updateEntities() {
        const currentEntities = [...this.entities];

        currentEntities.forEach(e => {
            e.update(this);

            if (e.active && typeof e.isOutOfBounds === 'function') {
                if (e.isOutOfBounds(this)) {
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
                this.sc.audio.fadeOutBGM(3000); 
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

        this.sc.audio.playExplosion();
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
        this.lives--;
        if (this.lives <= 0) {
            this.sc.audio.fadeOutBGM();
        }
    }

    /** リスポーン */
    respawnPlayer() {
        this.player.x = this.width / 2 - this.player.halfWidth;
        this.player.y = this.height - this.playerSpawnYOffset;
        this.player.alive = true;
        this.player.setInvincible(this.playerSpawnInvincibleTime);
    }

    /** エクステンド判定 */
    checkExtend() {
        if (this.extendThreshold === 'NONE' || !this.extendThreshold) return;

        if (Array.isArray(this.extendThreshold)) {
            const currentIndex = this.extendIndex || 0;
            if (currentIndex >= this.extendThreshold.length) return;

            const nextThreshold = this.extendThreshold[currentIndex];

            if (nextThreshold && this.score >= nextThreshold) {
                this.lives++;
                this.extendIndex = currentIndex + 1;
                this.ui.triggerExtendBlink();
            }
        } 
        else if (!this.hasExtended && this.score >= this.extendThreshold) {
            this.lives++;
            this.hasExtended = true;
            this.ui.triggerExtendBlink();
        }
    }

    /** 描画マスタ */
    draw() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.background.draw(this.ctx);
        
        if (!this.player) return;

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

        bullets.forEach(e => e.draw(this.ctx));
        normalEnemies.forEach(e => e.draw(this.ctx, this.isInvincibleCheat));
        bossEnemies.forEach(e => e.draw(this.ctx, this.isInvincibleCheat));
        otherEntities.forEach(e => e.draw(this.ctx));

        this.player.draw(this.ctx);
        this.ui.drawOverlayMessages(this.ctx);
    }

    /** ゲーム終了 */
    endSession(msg) {
        if (!this.isRunning && this.gameOverTimer > 182) return;
        this.isRunning = false;

        this._detachEventListeners();
        this.stats.score = this.score;

        // ★★★ "GAME OVER" か "ALL STAGES CLEARED!" の時だけリプレイ保存 ★★★
        const shouldSaveReplay = (msg === 'GAME OVER' || msg === 'ALL STAGES CLEARED!');
        if (shouldSaveReplay && this.replay && this.replay.mode === 'RECORD') {
            const replayData = this.replay.exportReplay();

            if (replayData && replayData.log && replayData.log.length > 0) {
                const savedId = ReplayStorage.save({
                    seed: replayData.seed,
                    log: replayData.log,
                    score: this.score,
                    stage: this.currentStageNum
                });
                console.log(`[Game] ✅ リプレイを保存しました (ID: ${savedId})`);
            } else {
                console.warn(`[Game] ⚠️ リプレイログが空のため保存スキップ`);
            }
        }

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
            
            this.lives = 0;
            this.gameOverTimer = 180;
            if (this.player.alive) this.onPlayerMiss(); 
            this.sc.audio.fadeOutBGM(1000);
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