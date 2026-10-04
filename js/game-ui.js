/*
 * PROJECT: VOID-CIRCUIT
 *
 * UI・演出管理コンポーネント (game-ui.js)
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

export class GameUIManager {
    constructor(game) {
        this.game = game;
        
        // --- DOM要素のキャッシュ ---
        this.dom = {
            startScreen: document.getElementById('start-screen'),
            livesDisplay: document.getElementById('lives-display'),
            weaponContainer: document.getElementById('weapon-container'),
            scoreDisplay: document.getElementById('score-display'),
            hiScoreDisplay: document.getElementById('hi-score-display'),
            gameContainer: document.getElementById('game-container'),
            debugInfo: document.getElementById('debug-info'),
            fullscreenKv: document.getElementById('fullscreen-kv'),
            warpPlayer: document.getElementById('fullscreen-warp-player')
        };

        // DOMキャッシュ比較用メモリ
        this._lastScoreText = '';
        this._lastHiScoreText = '';

        this.resetGameUIState();
    }

    /** メインループから毎フレーム呼ばれるUI一括更新メソッド */
    update() {
        this.updateScoreUI();
        this.updateLivesUI();
    }

    /** UI状態リセット系 */

    resetGameUIState() {
        this.hasPlayedCounterStopSE = false;
        this.resetStageUIState();
    }

    resetStageUIState() {
        if (this.dom.startScreen) this.dom.startScreen.style.display = 'none';
        if (this.dom.livesDisplay) this.dom.livesDisplay.style.display = 'block';
        if (this.dom.weaponContainer) this.dom.weaponContainer.style.display = 'block';

        if (this.dom.scoreDisplay) this.dom.scoreDisplay.classList.remove('counter-stop');
        if (this.dom.hiScoreDisplay) this.dom.hiScoreDisplay.classList.remove('counter-stop');

        this.isKvActive = false;
        this._kvShown = false;

        this._endingPhase = 0;
        this._endingTimer = 0;
        this._endingKvAlpha = 0;
        if (this.game) this.game.isEnding = false;

        if (this.dom.fullscreenKv) {
            this.dom.fullscreenKv.style.display = 'none';
            this.dom.fullscreenKv.style.opacity = '0';
        }
        if (this.dom.warpPlayer) {
            this.dom.warpPlayer.style.opacity = '1';
            this.dom.warpPlayer.classList.remove('trigger-warp');
        }

        this._lastScoreText = '';
        this._lastHiScoreText = '';
    }

    /** DOM / HTML UI更新系 */

    updateScoreUI() {
        const DIGITS = 7;
        const MAX_DISPLAY_SCORE = 9999990;

        if (this.dom.scoreDisplay) {
            const displayScore = Math.min(this.game.score || 0, MAX_DISPLAY_SCORE);
            const isCounterStopped = (this.game.score >= MAX_DISPLAY_SCORE);
            const scoreText = `SCORE: ${displayScore.toString().padStart(DIGITS, '0')}`;

            if (this._lastScoreText !== scoreText) {
                this.dom.scoreDisplay.innerText = scoreText;
                this.dom.scoreDisplay.classList.toggle('counter-stop', isCounterStopped);
                this._lastScoreText = scoreText;
            }

            if (isCounterStopped && !this.hasPlayedCounterStopSE) {
                this.game.sc?.audio?.playPowerUp?.();
                this.hasPlayedCounterStopSE = true;
            }
        }

        if (this.dom.hiScoreDisplay) {
            const currentHi = this.game.sc?.highScore || 0;
            const displayHiScore = Math.min(currentHi, MAX_DISPLAY_SCORE);
            const hiScoreText = `HI-SCORE: ${displayHiScore.toString().padStart(DIGITS, '0')}`;

            if (this._lastHiScoreText !== hiScoreText) {
                this.dom.hiScoreDisplay.innerText = hiScoreText;
                this.dom.hiScoreDisplay.classList.toggle('counter-stop', currentHi >= MAX_DISPLAY_SCORE);
                this._lastHiScoreText = hiScoreText;
            }
        }
    }

    triggerExtendBlink() {
        this.game.sc?.audio?.playPowerUp?.();
        this.isExtending = true;
        this.updateLivesUI();

        if (this._blinkTimer) clearTimeout(this._blinkTimer);
        this._blinkTimer = setTimeout(() => {
            this.isExtending = false;
            this.updateLivesUI();
            this._blinkTimer = null;
        }, 2000);
    }

    updateLivesUI() {
        const el = this.dom.livesDisplay;
        if (!el) return;

        const count = Math.max(0, (this.game.lives || 0) - 1);
        const icon = "🚀";

        if (count === 0) {
            if (el.innerHTML !== "") el.innerHTML = "";
            return;
        }

        let html = "";

        if (count <= 3) {
            if (this.isExtending) {
                const baseIcons = icon.repeat(Math.max(0, count - 1));
                html = `${baseIcons}<span class="extend-blink-single">${icon}</span>`;
            } else {
                html = icon.repeat(count);
            }
        } else {
            if (this.isExtending) {
                html = `${icon}x<span class="extend-blink-single">${count}</span>`;
            } else {
                html = `${icon}x${count}`;
            }
        }

        if (el.innerHTML !== html) {
            el.innerHTML = html;
        }
    }

    visualEffectWarning() {
        const container = this.dom.gameContainer;
        if (!container) return;
        container.style.transition = "filter 0.1s";
        container.style.filter = "brightness(1.2) sepia(1) saturate(5) hue-rotate(-50deg)";
        setTimeout(() => { container.style.filter = ""; }, 150);
    }

    updateDebugInfo() {
        const debugEl = this.dom.debugInfo;
        if (!debugEl || !this.game.isInvincibleCheat) {
            if (debugEl) debugEl.style.display = 'none';
            return;
        }
        debugEl.style.display = 'block';
        
        const setElText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        setElText('debug-frame', this.game.frame);
        setElText('debug-scn-frame', this.game.scenario?.currentScenarioFrame || 0);
        setElText('debug-index', `${this.game.scenario?.currentIndex || 0} / ${this.game.scenario?.length || 0}`);

        const bonusEl = document.getElementById('debug-bonus-time');
        const boss = this.game.entities?.find(e => e.isBoss); 
        
        if (boss && this.game.bossStartTime > 0 && bonusEl) {
            const elapsed = this.game.frame - this.game.bossStartTime;
            const remaining = Math.max(0, (boss.timeLimit || 0) - elapsed);
            bonusEl.innerText = `${remaining}F (${(remaining / 60).toFixed(2)}s)`;
            bonusEl.style.color = remaining < 600 ? "#f00" : "#0ff"; 
        } else if (bonusEl) {
            bonusEl.innerText = "---";
            bonusEl.style.color = "#888";
        }        
        setElText('debug-load', this.game.entities?.length || 0);
        setElText('debug-spawn', this.game.stats?.enemiesSpawned || 0);
        setElText('debug-kill', this.game.stats?.enemiesKilled || 0);
    }


    // ---------------------------------------------------------------
    // 🎨 キャンバスオーバーレイ描画の親（マスター）メソッド
    // ---------------------------------------------------------------

    /** オーバーレイ演出の一括描画統括 */
    drawOverlayMessages(ctx) {
        ctx.save();
        ctx.font = '16px "Press Start 2P", cursive';
        ctx.textAlign = 'center';

        // 優先度1: エンディング演出
        if (this.game.isEnding) {
            this._drawEndingOverlay(ctx);
            ctx.restore();
            return;
        }

        // 優先度2: ゲームオーバー演出
        if (this.game.player && !this.game.player.alive && this.game.lives <= 0) {
            this._drawGameOverOverlay(ctx);
            ctx.restore();
            return;
        }

        // 優先度3: 道中KV演出
        this._drawStageKVOverlay(ctx);

        // 優先度4: ステージクリア演出
        if (this.game.isCleared) {
            this._drawStageClearOverlay(ctx);
        }

        // 優先度5: ポーズ画面演出（最前面）
        if (this.game.isPaused) {
            this._drawPauseOverlay(ctx);
        }

        ctx.restore();
    }


    // ---------------------------------------------------------------
    // 🧩 演出ごとの個別描画メソッド
    // ---------------------------------------------------------------

    /** 🌟 1. エンディング演出 */
    _drawEndingOverlay(ctx) {
        const domKv = this.dom.fullscreenKv;
        const container = this.dom.gameContainer;
        const warpPlayer = this.dom.warpPlayer;
        
        if (this._endingPhase === 0) {
            this._endingPhase = 1;
            this._endingTimer = 0;

            if (container) container.style.display = 'none';

            if (domKv) {
                const assetBase = this.game.sc?.assetBase || '';
                const kvPath = `${assetBase}ending/kv.png`;
                domKv.style.backgroundImage = `url('${kvPath}')`;
                domKv.style.display = 'flex';
                setTimeout(() => { domKv.style.opacity = '1'; }, 50);
            }

            if (warpPlayer) {
                const assetBase = this.game.sc?.assetBase || '';
                const playerImgPath = `${assetBase}player.webp`;
                warpPlayer.src = playerImgPath;
                warpPlayer.classList.add('trigger-warp');
            }
        }

        this._endingTimer++;

        if (this._endingPhase === 1 && this._endingTimer >= 60) this._endingPhase = 2;
        if (this._endingPhase === 2 && this._endingTimer >= 330) this._endingPhase = 3;
        if (this._endingPhase === 3 && this._endingTimer >= 360) {
            this._endingPhase = 4;
            this._endingTimer = 0; 
        }
        if (this._endingPhase === 4) {
            if (this._endingTimer === 60 && domKv) {
                domKv.style.opacity = '0';
            }

            if (this._endingTimer >= 180) {
                this._endingPhase = 5; 
                this.resetGameUIState();
                if (container) container.style.display = 'block';
                console.log("[Ending] Full HTML-Ending completed. To Credits.");
                this.game.endSession?.("ALL STAGES CLEARED!");
            }
        }
    }

    /** 💀 2. ゲームオーバー演出 */
    _drawGameOverOverlay(ctx) {
        this.isKvActive = false;

        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(0, this.game.height / 2 - 50, this.game.width, 100);
        ctx.fillStyle = '#FFF';
        ctx.fillText('GAME OVER', this.game.width / 2, this.game.height / 2);
    }

    /** 🌌 3. 道中 KV 演出 */
    _drawStageKVOverlay(ctx) {
        let kvPath = null;
        let kvDuration = 180;

        const scenario = this.game.scenario || {};

        if (scenario.kv) {
            if (typeof scenario.kv === 'object') {
                kvPath = scenario.kv.path;
                kvDuration = scenario.kv.duration || 180;
            } else {
                kvPath = scenario.kv;
            }
        }

        if (kvPath && this.game.frame < kvDuration && !this._kvShown) {
            this.isKvActive = true;
            this._kvShown = true;
        }

        if (this.game.frame >= 0 && this.game.frame < kvDuration && this.isKvActive) {
            let textAlpha = 0;
            if (this.game.frame <= 30) {
                textAlpha = Math.min(1.0, Math.max(0, this.game.frame / 30));
            } else if (this.game.frame > (kvDuration - 30)) {
                textAlpha = Math.min(1.0, Math.max(0, (kvDuration - this.game.frame) / 30));
            } else {
                textAlpha = 1.0;
            }

            if (kvPath && this.game.assets) {
                const kvImage = this.game.assets.get?.(kvPath) || this.game.assets[kvPath];

                const rawSrc = kvImage?.src ? decodeURIComponent(kvImage.src) : '';
                const targetPath = decodeURIComponent(kvPath);
                
                const isCorrectImageLoaded = kvImage && 
                    kvImage.complete && 
                    kvImage.naturalWidth > 0 && 
                    rawSrc.endsWith(targetPath);

                if (isCorrectImageLoaded) {
                    ctx.save();
                    const progress = this.game.frame / kvDuration;
                    
                    let kvAlpha = 0;
                    if (this.game.frame <= 25) {
                        kvAlpha = Math.min(1.0, Math.max(0, this.game.frame / 25));
                    } else if (this.game.frame > (kvDuration - 45)) {
                        kvAlpha = Math.min(1.0, Math.max(0, (kvDuration - this.game.frame) / 45));
                    } else {
                        kvAlpha = 1.0;
                    }

                    const baseWidth = this.game.width;
                    const aspectRatio = kvImage.height / kvImage.width;
                    const baseHeight = baseWidth * aspectRatio;
                    const scale = 1.12 - (progress * 0.12); 
                    const drawWidth = baseWidth * scale;
                    const drawHeight = baseHeight * scale;
                    const drawX = (this.game.width - drawWidth) / 2;
                    const drawY = (this.game.height * 0.35) - (drawHeight / 2);

                    // 黒背景オーバーレイ
                    ctx.save();
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.globalAlpha = kvAlpha * 0.6;
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, this.game.width, this.game.height);
                    ctx.restore();

                    // KV本体描画
                    ctx.globalCompositeOperation = 'screen';
                    ctx.globalAlpha = kvAlpha;
                    ctx.drawImage(kvImage, drawX, drawY, drawWidth, drawHeight);
                    ctx.restore();
                }
            }

            // ステージ名テキスト描画
            const textCenterY = this.game.height * 0.65;
            ctx.font = '16px "Press Start 2P", cursive';
            ctx.fillStyle = `rgba(0, 255, 255, ${textAlpha.toFixed(2)})`;
            ctx.fillText(`STAGE ${this.game.currentStageNum || 1}`, this.game.width / 2, textCenterY);
            
            ctx.font = '11px "Press Start 2P", cursive';
            ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha.toFixed(2)})`;
            ctx.fillText(scenario.stageName || '', this.game.width / 2, textCenterY + 30);

        } else if (this.game.frame >= kvDuration && this.isKvActive) {
            this.isKvActive = false;
        }
    }

    /** 🎉 4. ステージクリア演出 */
    _drawStageClearOverlay(ctx) {
        const stageNameStr = this.game.scenario?.stageName || ''; 
        ctx.fillStyle = '#0FF';
        ctx.fillText(`STAGE ${this.game.currentStageNum || 1} CLEAR`, this.game.width / 2, this.game.height / 2);            
        ctx.font = '10px "Press Start 2P", cursive';
        ctx.fillStyle = '#FFF';
        ctx.fillText(stageNameStr, this.game.width / 2, this.game.height / 2 + 30);
    }

    /** ⏸️ 5. ポーズ演出 */
    _drawPauseOverlay(ctx) {
        ctx.save();

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, this.game.width, this.game.height);

        const centerX = this.game.width / 2;
        const centerY = this.game.height / 2;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '12px "Press Start 2P", cursive';

        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;

        ctx.fillStyle = '#ffffff';
        ctx.fillText('PAUSE', centerX, centerY - 15);

        ctx.shadowBlur = 0;
        ctx.font = '8px "Press Start 2P", cursive';

        if (Math.floor((this.game.frame || 0) / 30) % 2 === 0) {
            ctx.fillStyle = '#00ffff';
        } else {
            ctx.fillStyle = '#777777';
        }

        ctx.fillText('CLICK / TAP TO RESUME', centerX, centerY + 20);

        ctx.restore();
    }
}