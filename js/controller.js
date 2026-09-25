/*
 * PROJECT: VOID-CIRCUIT
 *
 * controller.js - System Administration & Scene Control
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import { InputManager } from './systems/input.js';
import { AudioManager } from './systems/audio.js';
import { ConfigManager } from './config/config.js';
import { Game } from './game.js';

/**
 * SystemController: ゲーム全体のライフサイクル・システム統合管理
 */
export class SystemController {
    constructor() {
        this.VERSION = "0.65";
        this.canvas = document.getElementById('game-canvas');

        // アセット参照パスの判別
        this.assetBase = this._determineAssetBase();

        console.log(`[System] Asset Base Path determined: "${this.assetBase}"`);

        // サブシステムの初期化
        this.input = new InputManager(this.canvas, { ignoreElement: 'start-screen' });
        this.audio = new AudioManager(this.assetBase);
        this.config = new ConfigManager(this);
        this.config.loadConfig();
        
        this.game = null; 
        this.isShowingCredits = false;
        this.idleTimeout = null;
        this._abortController = null;
    }

    /** アセットベースURLの動的決定 */
    _determineAssetBase() {
        const urlParams = new URLSearchParams(window.location.search);
        const tag = urlParams.get('tag');
        const branch = urlParams.get('branch') || 'main';
        const refPath = tag ? `tags/${tag}` : `heads/${branch}`;
        const githubBase = `https://raw.githubusercontent.com/rmiura-ani/void-circuit-assets/refs/${refPath}/`;

        const LOCAL_ASSET_ROOT = "../void-circuit-assets/";
        const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
        
        let basePath = isLocal ? LOCAL_ASSET_ROOT : githubBase;
        this.tag = isLocal ? 'local' : (tag ? `${tag}` : `${branch}`);

        if (!basePath.endsWith("/")) {
            basePath += "/";
        }
        return basePath;
    }

    // --- プロパティ (ハイスコア管理) ---

    set highScore(val) {
        const scoreBound = Math.min(val, 99999990);
        localStorage.setItem('void_circuit_highscore', scoreBound);
        
        const hiScoreEl = document.getElementById('hi-score-display');
        if (hiScoreEl) {
            hiScoreEl.classList.add('counter-stop');
            hiScoreEl.innerText = `HI-SCORE: ${scoreBound.toString().padStart(8, '0')}`;
        }
    }
    
    get highScore() { 
        return parseInt(localStorage.getItem('void_circuit_highscore'), 10) || 0; 
    }

    resetHighScore() {
        this.highScore = 0;
        localStorage.removeItem('void_circuit_highscore');
    }

    /** 初期化 */
    async init() {
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
            this.startIdleTimer();
        } catch (e) {
            console.error("[System] Init Failed:", e);
            this.setStartMessage("❌ ERROR: Failed to Load Assets", "#F44");
        }

        if (typeof Analytics !== 'undefined') {
            Analytics.logGameLaunch(this.VERSION);
        }
    }

    /** メインループ制御 */ 
    startLoop() {
        const loop = () => {
            this.update();
            this.draw();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    update() {
        if (this.game?.isRunning) {
            this.game.update();
        }
    }

    draw() {
        if (this.game?.isRunning) {
            this.game.draw();
        }
    }
    
    /** イベントリスナー セットアップ (AbortControllerで安全化) */
    setupGlobalEvents() {
        if (this._abortController) this._abortController.abort();
        this._abortController = new AbortController();
        const { signal } = this._abortController;

        document.getElementById('start-screen')?.addEventListener('click', () => this.handleProceed('MOUSE'), { signal });
        
        document.getElementById('config-open-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.stopIdleTimer();
            this.config.open();
        }, { signal });

        window.addEventListener('keydown', (e) => {
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

        const credits = document.getElementById('credit-screen');
        if (credits) {
            credits.onanimationend = () => {
                setTimeout(() => { if (this.isShowingCredits) this.backToTitle(); }, 5000);
            };
        }
    }

    /** ゲーム進行ハンドラ（古いGameインスタンスを破棄して新生成） */
    handleProceed(type, stage = 1) {
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

        this.game = new Game(this);
        this.game.start(type === 'MOUSE' ? 'MOUSE' : 'KEYBOARD', stage);
    }

    // --- 画面遷移系 ---

    startIdleTimer() {
        this.stopIdleTimer();
        this.idleTimeout = setTimeout(() => this.showCredits(), 15000);
    }
    
    stopIdleTimer() { 
        if (this.idleTimeout) clearTimeout(this.idleTimeout); 
    }
    
    showCredits() {
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

    backToTitle() {
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
    showStartScreen(msg, isNew) {
        if (!this.game) return;

        const missionCode = this.getMissionCode(false);
        const spawned = this.game.stats?.enemiesSpawned || 0;
        const killed = this.game.stats?.enemiesKilled || 0;
        const fired = this.game.stats?.shotsFired || 0;
        const hit = this.game.stats?.shotsHit || 0;

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
        
        const pEl = document.querySelector('#start-screen p');
        if (pEl) {
            pEl.innerHTML = `<div class="result-msg">${msg}</div>${statsHtml}${isNew ? '<div class="new-record">★ NEW HI-SCORE !! ★</div>' : ''}<br>RETRY OPERATION?`;
        }
        
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.style.display = 'flex';

        this.setupShareButton();
    }

    setStartMessage(text, color) {
        const el = document.querySelector('#start-screen p');
        if (el) {
            el.innerHTML = text;
            el.style.color = color;
            el.style.animation = "none";
        }
    }

    setupShareButton() {
        const btn = document.getElementById('share-btn');
        if (!btn) return;
        btn.style.display = 'block';
        btn.onclick = (e) => {
            e.stopPropagation();
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(this.generateShareText())}`, '_blank');
        };
    }

    generateShareText() {
        const scoreVal = this.game ? this.game.score : 0;
        return `PROJECT: VOID-CIRCUIT v${this.VERSION}\n` +
               `----------------------------\n` +
               `■ SCORE  : ${scoreVal.toLocaleString()}\n` +
               `■ MISSION: ${this.getMissionCode(true)}\n` +
               `----------------------------\n` +
               `作戦完了。虚無の回路を突破せよ。\n\n` +
               `https://void-circuit.ani-net.com\n` +
               `#VoidCircuit #80年代STG #IndieGame`;
    }

    /** ミッション名導出（未定義エラーへのセーフティ強化） */ 
    getMissionCode(isShare = false) {
        const c = this.game?.missionConfig;
        const s = this.game?.stats;

        if (!c || !s) return "UNKNOWN-MISSION";

        const diffMap = { 'EASY':'EZ', 'NORMAL':'NM', 'HARD':'HD', 'VERY HARD':'VH' };
        const diffStr = diffMap[c.difficulty] || 'U';
        const cheatStr = c.cheatUsed ? (isShare ? '(CHEAT)' : '(CHT)') : '';
        const extendStr = c.extend === 'NONE' ? 'OFF' : `${(c.extend / 1000000)}M`;
        const livesStr = `${c.lives}L`;
        const missionName = (c.missionName || 'UNKNOWN').toUpperCase();

        // 操作モード判定
        let controlSuffix = '-MK';
        if (s.inputMode === 'MOUSE') controlSuffix = '-M';
        if (s.inputMode === 'KEYBOARD') controlSuffix = '-K';

        return `${missionName}-${diffStr}${cheatStr}-${livesStr}-${extendStr}${controlSuffix}`;
    }

    /** システム破棄処理 */
    destroy() {
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