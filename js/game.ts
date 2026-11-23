/*
 * PROJECT: VOID-CIRCUIT
 *
 * game.ts - ゲーム全体を統括するメインクラス
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import { ScenarioManager } from './systems/scenario.js';
import { AssetManager, Entity, type GameContext } from './entities/base.js';
import { GameUIManager } from './game-ui.js';
import { GameCollisionManager } from './game-collision.js';
import { BackgroundManager } from './background.js';
import { Random } from './systems/random.js';
import { ReplayManager } from './systems/replayManager.js';
import { ReplayStorage } from './systems/replayStorage.js';
import type { ControlInputType, GameInstanceLike } from './controller.js';
import type { GameStats, MissionConfig } from './ga.js';

import './entities/enemies/index.js'; // 全ステージの敵がレジストリに登録される

import { Player, Bullet } from './entities/player.js';
import { Enemy, EnemyBullet } from './entities/enemy.js';
import { Particle } from './entities/effects.js';

export interface DifficultyParam {
    fireRate: number;
    bulletSpeed: number;
    wayBonus: number;
}

export interface PlayerInputState {
    isTouching?: boolean;
    touchX?: number;
    touchY?: number;
    isFiring: boolean;
    isRightClick: boolean;
    isDoubleTap: boolean;
    isCanvasOutClick: boolean;
    isWeaponSwitchTriggered?: boolean;
}

export interface GameControllerLike {
    canvas: HTMLCanvasElement | null;
    assetBase: string;
    tag: string;
    highScore: number;
    input: {
        isTouching: boolean;
        touchX: number;
        touchY: number;
        isPressed(code: string): boolean;
        getAndResetRightClick(): boolean;
        getAndResetDoubleTap(): boolean;
        getAndResetCanvasOutClick?: () => boolean;
        clearTriggers(): void;
    };
    audio: {
        resetBGM(): void;
        playBGM(): void;
        fadeOutBGM(durationMs?: number): void;
        pauseBGM(): void;
        resumeBGM(): void;
        playExplosion(): void;
        playHitSound(): void;
        playPowerUp?(): void;
        playCriticalHit?: () => void;
    };
    config: {
        lives: number;
        difficulty: string;
        extend: number | number[] | 'NONE';
        isInvincibleCheat: boolean;
    };
    showStartScreen(msg: string, isNew: boolean): void;
    startIdleTimer(): void;
}

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
        'EASY': { fireRate: 0.7, bulletSpeed: 0.75, wayBonus: -1 },
        'NORMAL': { fireRate: 1.0, bulletSpeed: 0.9, wayBonus: 0 },
        'HARD': { fireRate: 1.3, bulletSpeed: 1.0, wayBonus: 1 },
        'VERY HARD': { fireRate: 1.6, bulletSpeed: 1.1, wayBonus: 2 }
    } as Record<string, DifficultyParam>
} as const;

/**
 * ゲーム全体を統括するメインクラス
 */
export class Game implements GameContext, GameInstanceLike {
    public sc: GameControllerLike & GameContext['sc'];
    public canvas: HTMLCanvasElement;
    public ctx: CanvasRenderingContext2D;

    public readonly width: number = GAME_CONFIG.WIDTH;
    public readonly height: number = GAME_CONFIG.HEIGHT;
    public readonly uiHeaderHeight: number = GAME_CONFIG.UI_HEADER_HEIGHT;
    public readonly playerSpawnYOffset: number = GAME_CONFIG.PLAYER_SPAWN_Y_OFFSET;
    public readonly playerSpawnWaitTime: number = GAME_CONFIG.PLAYER_SPAWN_WAIT_TIME;
    public readonly playerSpawnInvincibleTime: number = GAME_CONFIG.PLAYER_SPAWN_INVINCIBLE_TIME;

    public background: BackgroundManager;
    public scenario: ScenarioManager;
    public assets: AssetManager;
    public ui: GameUIManager;
    public collisions: GameCollisionManager;
    public replay: ReplayManager;

    // 内部・セッション状態
    private _score: number = 0;
    public lives: number;
    public isRunning: boolean = false;
    public isPaused: boolean = false;
    public weaponMode: GameContext['weaponMode'] = 'STRAIGHT';
    public weaponSwitchCooldown: number = 0;

    public seed: number = 0;
    public random!: Random;
    public stats!: GameStats & { score?: number };
    public isInvincibleCheat: boolean = false;

    public extendThreshold: number | number[] | 'NONE' = 'NONE';
    public extendIndex: number = 0;
    public hasExtended: boolean = false;

    public missionConfig!: MissionConfig & {
        difficulty: string;
        lives: number;
    };

    public currentStageNum: number = 1;
    public isCleared: boolean = false;
    public isEnding: boolean = false;
    public frame: number = 0;
    public isBossActive: boolean = false;
    public bossStartTime: number = 0;
    public postBossTimer: number = 0;
    public gameOverTimer: number = 0;
    public clearTimer: number = 0;
    public respawnTimer: number = 0;

    public escCount: number = 0;
    private escTimer: ReturnType<typeof setTimeout> | null = null;
    private _abortController: AbortController | null = null;

    public entities: Entity[] = [];
    public player!: Player;
    public currentInputState: PlayerInputState = {
        isFiring: false,
        isRightClick: false,
        isDoubleTap: false,
        isCanvasOutClick: false
    };

    constructor(controller: GameControllerLike) {
        if (!controller.canvas) {
            throw new Error('[Game] Canvas element (#game-canvas) is missing.');
        }
        const ctx = controller.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('[Game] Failed to acquire 2D rendering context.');
        }

        this.canvas = controller.canvas;
        this.ctx = ctx;

        this.background = new BackgroundManager(this.width, this.height);
        this.scenario = new ScenarioManager();
        this.assets = new AssetManager(controller.assetBase);

        this.sc = Object.assign(controller, {
            assets: this.assets
        }) as unknown as GameControllerLike & GameContext['sc'];

        this.ui = new GameUIManager(this as unknown as ConstructorParameters<typeof GameUIManager>[0]);
        this.collisions = new GameCollisionManager(this as unknown as ConstructorParameters<typeof GameCollisionManager>[0]);
        this.replay = new ReplayManager();

        this.lives = controller.config.lives;
        this.reset();
    }

    // ==========================================
    // 1. Getter / Setter
    // ==========================================

    public get score(): number {
        return this._score;
    }

    public set score(value: number) {
        const delta = value - this._score;
        this._score = value;

        // 加算（正の増加）があった場合のみエクステンド判定を行う
        if (delta > 0) {
            this.checkExtend();
        }
    }

    // ==========================================
    // 2. ライフサイクル & セッション・ステージ制御
    // ==========================================

    /** 初期化 */
    public reset(seed: number = Date.now()): void {
        this.seed = seed;
        this.random = new Random(this.seed);

        this._score = 0;
        this.lives = this.sc.config.lives;
        this.stats = {
            enemiesSpawned: 0,
            enemiesKilled: 0,
            shotsFired: 0,
            shotsHit: 0,
            inputMode: 'NONE'
        };
        this.isInvincibleCheat = this.sc.config.isInvincibleCheat;

        this.extendThreshold = this.sc.config.extend;
        this.extendIndex = 0;
        this.hasExtended = false;

        this.missionConfig = {
            missionName: this.sc.tag,
            difficulty: this.sc.config.difficulty,
            extend: Array.isArray(this.sc.config.extend) ? this.sc.config.extend[0] : this.sc.config.extend,
            lives: this.sc.config.lives,
            cheatUsed: this.sc.config.isInvincibleCheat
        };

        this.currentStageNum = 1;
        this.isCleared = false;
        this.isEnding = false;
        this.isPaused = false;
        this.frame = 0;
        this.isBossActive = false;
        this.bossStartTime = 0;
        this.postBossTimer = 0;
        this.gameOverTimer = 0;
        this.clearTimer = 0;
        this.respawnTimer = 0;
        this.weaponSwitchCooldown = 0;
        this.escCount = 0;
        this.escTimer = null;

        this.entities = [];
        this.player = new Player(this, this.sc.input as unknown as ConstructorParameters<typeof Player>[1], 0, 0);
        this.player.x = this.width / 2 - this.player.halfWidth;
        this.player.y = this.height - this.playerSpawnYOffset;

        this.scenario.reset();
        this.sc.audio.resetBGM();
    }

    /** 通常ゲーム開始（録画モード） */
    public async start(initialInputMode: ControlInputType, startStage: number = 1, seed: number = Date.now()): Promise<void> {
        this.reset(seed);
        this.replay.startRecording(this.seed);
        this._attachEventListeners();

        this.stats.inputMode = initialInputMode;

        const success = await this.initStage(startStage);
        if (!success) return;

        if (window.Analytics) {
            window.Analytics.logLevelStart(this.missionConfig);
        }
        this.isRunning = true;
    }

    /** リプレイ再生開始 */
    public async startReplay(
        replayData: Parameters<ReplayManager['startPlayback']>[0],
        startStage: number = 1
    ): Promise<void> {
        this.reset(replayData.seed);
        this.replay.startPlayback(replayData);
        this._attachEventListeners();

        const success = await this.initStage(startStage);
        if (!success) return;

        this.isRunning = true;
    }

    /** ステージ情報を動的にセットアップ */
    public async initStage(stageNum: number): Promise<boolean> {
        this.ui.resetStageUIState();

        this.currentStageNum = stageNum;
        this.isBossActive = false;
        this.bossStartTime = 0;
        this.postBossTimer = 0;
        this.isCleared = false;
        this.isEnding = false;
        this.clearTimer = 0;

        try {
            const success = await this.scenario.loadStageResources(
                stageNum,
                this.assets,
                this.sc.audio as unknown as Parameters<ScenarioManager['loadStageResources']>[2],
                this.sc.assetBase
            );

            if (success) {
                const diffParam = GAME_CONFIG.DIFFICULTY_PARAMS[this.sc.config.difficulty] || GAME_CONFIG.DIFFICULTY_PARAMS['NORMAL'];
                this.scenario.setDifficulty(diffParam);
                this.background.setup(stageNum);
                this.sc.audio.playBGM();

                console.log(`Stage ${stageNum} "${this.scenario.stageName}" Started.`);
                return true;
            } else {
                const errorReason = this.scenario.lastError || 'Unknown asset loss.';
                this.endSession(`LOAD ERROR: ${errorReason}`);
                return false;
            }
        } catch (error: unknown) {
            console.error(error);
            const message = error instanceof Error ? error.message : String(error);
            this.endSession(`LOAD CRASH: ${message}`);
            return false;
        }
    }

    /** 次ステージへ */
    public async goToNextStage(): Promise<void> {
        this.currentStageNum++;
        this.isCleared = false;
        this.clearTimer = 0;
        this.frame = 0;

        await this.initStage(this.currentStageNum);
    }

    /** ゲーム終了 */
    public endSession(msg: string = 'GAME OVER'): void {
        if (!this.isRunning && this.gameOverTimer > 182) return;
        this.isRunning = false;

        this._detachEventListeners();
        this.stats.score = this.score;

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

        if (window.Analytics) {
            window.Analytics.logLevelEnd(this.missionConfig, this.stats, this.score, this.isCleared);
            window.Analytics.logPostScore(this.score, String(this.currentStageNum));
        }

        const isNew = this.score > this.sc.highScore && this.score > 0;
        if (isNew) {
            this.sc.highScore = this.score;
            if (window.Analytics) {
                window.Analytics.logAchievement('HI_SCORE_BREAK');
            }
        }

        this.ui.hideWeaponUI();

        this.sc.showStartScreen(msg, isNew);
        this.sc.startIdleTimer();
    }

    /** インスタンス破棄 */
    public destroy(): void {
        this.isRunning = false;
        this._detachEventListeners();
        if (this.escTimer) {
            clearTimeout(this.escTimer);
            this.escTimer = null;
        }
    }

    // ==========================================
    // 3. フレーム更新ループ (Update)
    // ==========================================

    /** メインループ更新 */
    public update(): void {
        if (!this.isRunning) return;

        // ポーズ中は入力フラグのみクリアして処理を中断（ポーズ解除直後の武器誤切り替え防止）
        if (this.isPaused) {
            this.sc.input?.clearTriggers();
            return;
        }
        if (this.weaponSwitchCooldown > 0) {
            this.weaponSwitchCooldown--;
        }

        this.background.update(this.frame);

        // 入力確定とプレイヤー更新（リプレイ再生時はここで終了する可能性あり）
        if (!this._processInputAndPlayer()) return;

        this.frame++;

        // シナリオ・判定の進行
        this.scenario.update(this as unknown as Parameters<ScenarioManager['update']>[0]);

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
                this.endSession('GAME OVER');
            }
        }

        this.updateEntities();

        if (this.ui) {
            this.ui.update();
            this.ui.updateDebugInfo();
        }
    }

    /**
     * 入力処理とプレイヤー座標・射撃状態の更新
     * @returns セッション継続時は true、リプレイ終了時は false
     */
    private _processInputAndPlayer(): boolean {
        const isPlayback = this.replay && this.replay.mode === 'PLAYBACK';

        if (isPlayback) {
            const frameData = this.replay.getCurrentFrameData();

            if (!frameData && this.replay.log.length > 0) {
                this.endSession('REPLAY FINISHED');
                return false;
            }

            if (frameData && this.player) {
                this.player.x = frameData.x;
                this.player.y = frameData.y;

                this.currentInputState = {
                    isFiring: frameData.f === 1,
                    isRightClick: frameData.b === 1,
                    isDoubleTap: false,
                    isCanvasOutClick: false,
                    isWeaponSwitchTriggered: frameData.b === 1
                };
                this.player.update(this);
            }
            return true;
        }

        // 通常プレイ：Input管理クラスから取得して確定
        const isKeyFiring = this.sc.input.isPressed('KeyZ') || this.sc.input.isPressed('Space');
        const isFiring = isKeyFiring || this.sc.input.isTouching;

        const isRightClick = this.sc.input.getAndResetRightClick();
        const isDoubleTap = this.sc.input.getAndResetDoubleTap();
        const isCanvasOutClick = typeof this.sc.input.getAndResetCanvasOutClick === 'function'
            ? this.sc.input.getAndResetCanvasOutClick()
            : false;

        const rawSwitchTriggered = isRightClick || isDoubleTap || isCanvasOutClick;
        const isWeaponSwitchTriggered = rawSwitchTriggered && (this.weaponSwitchCooldown === 0);

        if (isWeaponSwitchTriggered) {
            this.weaponSwitchCooldown = 12; // 約0.2秒間のガード
        }

        this.currentInputState = {
            isTouching: this.sc.input.isTouching,
            touchX: this.sc.input.touchX,
            touchY: this.sc.input.touchY,
            isFiring,
            isRightClick,
            isDoubleTap,
            isCanvasOutClick,
            isWeaponSwitchTriggered
        };

        if (this.player) {
            this.player.update(this);

            if (this.replay && this.replay.mode === 'RECORD') {
                this.replay.recordFrame(this.player.x, this.player.y, isFiring, isWeaponSwitchTriggered);
            }
        }
        return true;
    }

    /** エンティティ更新（一括処理） */
    public updateEntities(): void {
        const currentEntities = [...this.entities];

        currentEntities.forEach((e: Entity) => {
            e.update(this);

            if (e.active && typeof e.isOutOfBounds === 'function') {
                if (e.isOutOfBounds(this)) {
                    e.active = false;
                }
            }
        });

        this.entities = this.entities.filter((e: Entity) => e.active);
    }

    /** ステージクリア判定 */
    public checkClearCondition(): void {
        if (this.frame < 180) return;

        const hasEnemies = this.entities.some((e: Entity) => e instanceof Enemy);
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
                    void this.goToNextStage();
                } else {
                    this.isEnding = true;
                }
            }
        }
    }

    /** 入力モード判定の更新 */
    public updateInputMode(): void {
        if (this.stats.inputMode === 'BOTH') return;
        const isKeyActive = (
            this.sc.input.isPressed('KeyZ') ||
            this.sc.input.isPressed('Space') ||
            this.sc.input.isPressed('ArrowUp')
        );
        if (this.stats.inputMode === 'KEYBOARD' && this.sc.input.isTouching) {
            this.stats.inputMode = 'BOTH';
        } else if (this.stats.inputMode === 'MOUSE' && isKeyActive) {
            this.stats.inputMode = 'BOTH';
        }
    }

    // ==========================================
    // 4. ゲームイベント & ルール処理
    // ==========================================

    /** ボス戦スタート */
    public startBossBattle(): void {
        this.isBossActive = true;
        this.bossStartTime = this.frame;
    }

    /** 被弾ミス */
    public onPlayerMiss(): void {
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
    public respawnPlayer(): void {
        this.player.x = this.width / 2 - this.player.halfWidth;
        this.player.y = this.height - this.playerSpawnYOffset;
        this.player.alive = true;
        this.player.setInvincible(this.playerSpawnInvincibleTime);
    }

    /** エクステンド判定 */
    public checkExtend(): void {
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
        } else if (!this.hasExtended && this.score >= this.extendThreshold) {
            this.lives++;
            this.hasExtended = true;
            this.ui.triggerExtendBlink();
        }
    }

    // ==========================================
    // 5. イベントハンドラ & 描画
    // ==========================================

    /** イベントリスナーの安全なアタッチ */
    private _attachEventListeners(): void {
        this._detachEventListeners();

        this._abortController = new AbortController();
        const { signal } = this._abortController;

        window.addEventListener('keydown', (e: KeyboardEvent) => this.handleKeyDown(e), { signal });

        if (this.replay.mode === 'RECORD') {
            const triggerAutoPause = (): void => {
                const isGameOver = (!this.player.alive && this.lives <= 0);

                if (this.isRunning && !isGameOver && !this.isPaused) {
                    this.isPaused = true;
                    this.sc.audio.pauseBGM();
                }
            };

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) triggerAutoPause();
            }, { signal });

            window.addEventListener('blur', triggerAutoPause, { signal });
        }

        const resumeGame = (e: PointerEvent): void => {
            if (this.isRunning && this.isPaused) {
                e.preventDefault();
                e.stopPropagation();
                this.isPaused = false;
                this.sc.audio.resumeBGM();
            }
        };

        if (this.canvas) {
            this.canvas.addEventListener('pointerdown', resumeGame, { signal });
        }
    }

    /** イベントリスナーの解除 */
    private _detachEventListeners(): void {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
    }

    public handleKeyDown(e: KeyboardEvent): void {
        if (!this.isRunning) return;
        if (e.key === 'Escape') this.handleEmergencyEscape();
    }

    public handleEmergencyEscape(): void {
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
            this.endSession('EMERGENCY EXIT');
        } else {
            this.escTimer = setTimeout(() => {
                this.escCount = 0;
                this.escTimer = null;
            }, 1000);
        }
    }

    /** 描画マスタ */
    public draw(): void {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.background.draw(this.ctx);

        if (!this.player) return;

        const bullets: Entity[] = [];
        const normalEnemies: Enemy[] = [];
        const bossEnemies: Enemy[] = [];
        const otherEntities: Entity[] = [];

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
}