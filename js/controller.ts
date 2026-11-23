/*
 * PROJECT: VOID-CIRCUIT
 *
 * controller.ts - System Administration & Scene Control
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import { InputManager } from './systems/input.js';
import { AudioManager } from './systems/audio.js';
import { ConfigManager } from './config/config.js';
import type { DifficultyLevel, ExtendOption, LivesOption } from './config/config.js';
import { ReplayUIManager } from './systems/replay-ui.js';
import { Game } from './game.js';

declare const __APP_VERSION__: string;

export type ControlInputType = 'MOUSE' | 'KEYBOARD';

/** Game インスタンスの契約インターフェース（game.ts 移行時の設計指針） */
export interface GameInstanceLike {
    isRunning: boolean;
    score: number;
    gameOverTimer: number;
    player?: {
        alive: boolean;
    } | null;
    stats: {
        enemiesSpawned: number;
        enemiesKilled: number;
        shotsFired: number;
        shotsHit: number;
        inputMode?: string;
    };
    missionConfig: {
        missionName: string;
        difficulty: string;
        extend: string;
        lives: number;
        cheatUsed: boolean;
    };
    start(inputType: ControlInputType, stage?: number): void;
    startReplay(replayData: any, stage: number): void;
    update(): void;
    draw(): void;
    destroy(): void;
}

/** ConfigManager の契約インターフェース（config.ts 移行時の設計指針） */
export interface ConfigManagerLike {
    isMode: boolean;
    lives: LivesOption;
    difficulty: DifficultyLevel;
    extend: ExtendOption;
    isInvincibleCheat: boolean;
    loadConfig(): void;
    open(): void;
    handleInput(e: KeyboardEvent): void;
}

/** ReplayUIManager の契約インターフェース（replay-ui.ts 移行時の設計指針） */
export interface ReplayUIManagerLike {
    setupUI(): void;
}

/**
 * SystemController: ゲーム全体のライフサイクル・システム統合管理
 */
export class SystemController {
    public readonly VERSION: string;
    public canvas: HTMLCanvasElement | null;
    public assetBase: string;
    public tag: string = 'local';

    public input: InputManager;
    public audio: AudioManager;
    public config: ConfigManagerLike;
    public replayUI: ReplayUIManagerLike;

    public game: GameInstanceLike | null;
    public isShowingCredits: boolean;
    public idleTimeout: ReturnType<typeof setTimeout> | null;
    private _abortController: AbortController | null;

    constructor() {
        this.VERSION = __APP_VERSION__;
        this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;

        // アセット参照パスの判別
        this.assetBase = this._determineAssetBase();

        console.log(`[System] Asset Base Path determined: "${this.assetBase}"`);

        // サブシステムの初期化
        this.input = new InputManager(this.canvas, { ignoreElement: 'start-screen' });
        this.audio = new AudioManager(this.assetBase);
        this.config = new ConfigManager(this) as unknown as ConfigManagerLike;
        this.config.loadConfig();

        this.replayUI = new ReplayUIManager(this) as unknown as ReplayUIManagerLike;

        this.game = null;
        this.isShowingCredits = false;
        this.idleTimeout = null;
        this._abortController = null;
    }

    /** アセットベースURLの動的決定 */
    private _determineAssetBase(): string {
        const urlParams = new URLSearchParams(window.location.search);
        const tag = urlParams.get('tag');
        const branch = urlParams.get('branch') || 'main';
        const refPath = tag ? `tags/${tag}` : `heads/${branch}`;
        const githubBase = `https://raw.githubusercontent.com/rmiura-ani/void-circuit-assets/refs/${refPath}/`;

        const LOCAL_ASSET_ROOT = "/void-circuit-assets/";
        const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);

        let basePath = isLocal ? LOCAL_ASSET_ROOT : githubBase;
        this.tag = isLocal ? 'local' : (tag ? `${tag}` : `${branch}`);

        if (!basePath.endsWith("/")) {
            basePath += "/";
        }
        return basePath;
    }

    // --- プロパティ (ハイスコア管理) ---

    public set highScore(val: number) {
        const scoreBound = Math.min(val, 99999990);
        localStorage.setItem('void_circuit_highscore', String(scoreBound));

        const hiScoreEl = document.getElementById('hi-score-display');
        if (hiScoreEl) {
            hiScoreEl.classList.add('counter-stop');
            hiScoreEl.innerText = `HI-SCORE: ${scoreBound.toString().padStart(8, '0')}`;
        }
    }

    public get highScore(): number {
        const saved = localStorage.getItem('void_circuit_highscore');
        return saved ? parseInt(saved, 10) || 0 : 0;
    }

    public resetHighScore(): void {
        this.highScore = 0;
        localStorage.removeItem('void_circuit_highscore');
    }

    /** 初期化 */
    public async init(): Promise<void> {
        const versionEl = document.getElementById('version-display');
        if (versionEl) versionEl.innerText = this.VERSION;

        const configBtn = document.getElementById('config-open-btn');
        if (configBtn) configBtn.style.display = 'none';

        try {
            // ハイスコア表示の再更新
            this.highScore = this.highScore;

            this.setStartMessage("Click or [Z]Key to Start", "#0FF");
            if (configBtn) configBtn.style.display = 'block';

            this.setupGlobalEvents();

            // ★ リプレイUIの初期化（ボタン生成など）
            this.replayUI.setupUI();

            this.startIdleTimer();
        } catch (e) {
            console.error("[System] Init Failed:", e);
            this.setStartMessage("❌ ERROR: Failed to Load Assets", "#F44");
        }

        if (window.Analytics) {
            window.Analytics.logGameLaunch(this.VERSION);
        }
    }

    /** メインループ制御 */
    public startLoop(): void {
        const loop = (): void => {
            this.update();
            this.draw();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    public update(): void {
        if (this.game?.isRunning) {
            this.game.update();
        }
    }

    public draw(): void {
        if (this.game?.isRunning) {
            this.game.draw();
        }
    }

    /** イベントリスナー セットアップ (AbortControllerで安全化) */
    public setupGlobalEvents(): void {
        if (this._abortController) this._abortController.abort();
        this._abortController = new AbortController();
        const { signal } = this._abortController;

        document.getElementById('start-screen')?.addEventListener('click', () => this.handleProceed('MOUSE'), { signal });
        document.getElementById('config-open-btn')?.addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation();
            this.stopIdleTimer();
            this.config.open();
        }, { signal });

        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (this.config.isMode) {
                this.config.handleInput(e);
                return;
            }
            if (e.code === 'KeyC' && (!this.game || !this.game.isRunning) && !this.isShowingCredits) {
                this.stopIdleTimer();
                this.config.open();
            }
            if (['Space', 'KeyZ'].includes(e.code)) this.handleProceed('KEYBOARD');

            if (this.config?.isInvincibleCheat) {
                const keyNum = parseInt(e.key, 10);
                if (keyNum >= 1 && keyNum <= 7) {
                    this.handleProceed('KEYBOARD', keyNum);
                }
            }
        }, { signal });
        // SystemController 自身がページ離脱時の破棄を管理する
        window.addEventListener('beforeunload', () => {
            this.destroy();
        }, { signal });

        const credits = document.getElementById('credit-screen');
        if (credits) {
            credits.onanimationend = () => {
                setTimeout(() => { if (this.isShowingCredits) this.backToTitle(); }, 5000);
            };
        }
    }

    /** ゲーム進行ハンドラ（古いGameインスタンスを破棄して新生成） */
    public handleProceed(type: ControlInputType, stage: number = 1): void {
        if (this.config.isMode || this.game?.isRunning) return;
        if (this.isShowingCredits) return this.backToTitle();

        // ゲームオーバー直後の連打防止
        if (this.game?.player && !this.game.player.alive && this.game.gameOverTimer < 30) return;

        this.stopIdleTimer();

        // 既存のゲームがあれば破棄してリセット
        if (this.game) {
            this.game.destroy();
            this.game = null;
        }

        const newGame = new Game(this) as unknown as GameInstanceLike;
        this.game = newGame;
        this.game.start(type === 'MOUSE' ? 'MOUSE' : 'KEYBOARD', stage);
    }

    // --- 画面遷移系 ---

    public startIdleTimer(): void {
        this.stopIdleTimer();
        this.idleTimeout = setTimeout(() => this.showCredits(), 15000);
    }

    public stopIdleTimer(): void {
        if (this.idleTimeout) clearTimeout(this.idleTimeout);
    }

    public showCredits(): void {
        this.isShowingCredits = true;
        const title = document.getElementById('title-content');
        const configBtn = document.getElementById('config-open-btn');
        const screen = document.getElementById('credit-screen');

        if (title) title.style.display = 'none';
        if (configBtn) configBtn.style.display = 'none';
        if (screen) {
            screen.style.display = 'block';
            screen.classList.add('scrolling');
        }
    }

    public backToTitle(): void {
        this.isShowingCredits = false;
        const screen = document.getElementById('credit-screen');
        const title = document.getElementById('title-content');
        const configBtn = document.getElementById('config-open-btn');

        if (screen) {
            screen.style.display = 'none';
            screen.classList.remove('scrolling');
        }
        if (title) title.style.display = 'block';
        if (configBtn) configBtn.style.display = 'block';

        this.startIdleTimer();
    }

    /** スタート・リザルト表示 */
    public showStartScreen(msg: string, isNew: boolean): void {
        if (!this.game) return;

        const missionCode = this.getMissionCode();
        const spawned = this.game.stats.enemiesSpawned;
        const killed = this.game.stats.enemiesKilled;
        const fired = this.game.stats.shotsFired;
        const hit = this.game.stats.shotsHit;

        const killRate = spawned > 0 ? Math.floor((killed / spawned) * 100) : 0;
        const accuracy = fired > 0 ? ((hit / fired) * 100).toFixed(3) : "0.000";

        const statsHtml = `
            <div class="mission-header">MISSION: ${missionCode}</div>
            <div class="stats-container">
                <div class="stats-row">
                    <span class="stats-label">KILLS:</span>
                    <span class="stats-value">${killed} / ${spawned} (${killRate}%)</span>
                </div>
                <div class="stats-row">
                    <span class="stats-label">HIT RATE:</span>
                    <span class="stats-value">${accuracy}%</span>
                </div>
            </div>
        `;

        const pEl = document.querySelector<HTMLElement>('#start-screen p');
        if (pEl) {
            pEl.innerHTML = `<div class="result-msg">${msg}</div>${statsHtml}${isNew ? '<div class="new-record">★ NEW HI-SCORE !! ★</div>' : ''}<br>RETRY OPERATION?`;
        }

        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.style.display = 'flex';

        this.setupShareButton();
    }

    public setStartMessage(text: string, color: string): void {
        const el = document.querySelector<HTMLElement>('#start-screen p');
        if (el) {
            el.innerHTML = text;
            el.style.color = color;
            el.style.animation = "none";
        }
    }

    public setupShareButton(): void {
        const btn = document.getElementById('share-btn');
        if (!btn) return;
        if (this.game?.missionConfig.cheatUsed) {
            btn.style.display = 'none';
        } else {
            btn.style.display = 'block';
            btn.onclick = (e: MouseEvent) => {
                e.stopPropagation();
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(this.generateShareText())}`, '_blank');
            };
        }
    }

    public generateShareText(): string {
        const scoreVal = this.game ? this.game.score : 0;
        return `PROJECT: VOID-CIRCUIT v${this.VERSION}\n` +
               `----------------------------\n` +
               `■ SCORE  : ${scoreVal.toLocaleString()}\n` +
               `■ MISSION: ${this.getMissionCode()}\n` +
               `----------------------------\n` +
               `作戦完了。虚無の回路を突破せよ。\n\n` +
               `https://void-circuit.ani-net.com\n` +
               `#VoidCircuit #80年代STG #IndieGame`;
    }

    /** ミッション名導出 */
    public getMissionCode(): string {
        const c = this.game?.missionConfig;
        const s = this.game?.stats;

        if (!c || !s) return "UNKNOWN-MISSION";

        const diffMap: Record<string, string> = { 'EASY': 'EZ', 'NORMAL': 'N', 'HARD': 'H', 'H': 'VH' };
        const diffStr = diffMap[c.difficulty] || 'U';
        const livesStr = `${c.lives}L`;
        const missionName = (c.missionName || 'UNKNOWN').toUpperCase();

        // 操作モード判定
        let controlSuffix = '-MK';
        if (s.inputMode === 'MOUSE') controlSuffix = '-M';
        if (s.inputMode === 'KEYBOARD') controlSuffix = '-K';

        return `${missionName}-${diffStr}-${livesStr}${controlSuffix}`;
    }

    /** システム破棄処理 */
    public destroy(): void {
        this.stopIdleTimer();
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
        if (this.game) {
            this.game.destroy();
            this.game = null;
        }
    }
}