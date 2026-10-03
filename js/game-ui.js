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
        
        // --- DOM要素のキャッシュ（描画・更新パフォーマンスの最適化） ---
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

        this.resetGameUIState();
    }

    /** 💡 メインループから毎フレーム呼ばれるUI一括更新メソッド */
    update() {
        this.updateScoreUI();
        this.updateLivesUI();
    }

    // 🚀 UI・KV・演出状態をリセットする
    resetGameUIState() {
        this.hasPlayedCounterStopSE = false; // SE既生フラグ
        this.resetStageUIState(); // 💡 this. を追加（修正箇所）
    }

    // 🚀 UI・KV・演出状態をリセットする
    resetStageUIState() {
        // --- A. DOM要素のトグル ---
        if (this.dom.startScreen) this.dom.startScreen.style.display = 'none';
        if (this.dom.livesDisplay) this.dom.livesDisplay.style.display = 'block';
        if (this.dom.weaponContainer) this.dom.weaponContainer.style.display = 'block';

        if (this.dom.scoreDisplay) this.dom.scoreDisplay.classList.remove('counter-stop');
        if (this.dom.hiScoreDisplay) this.dom.hiScoreDisplay.classList.remove('counter-stop');

        // --- B. KV演出状態の初期化 ---
        this.isKvActive = false; // 現在KVを描画中かどうかのフラグ
        this._kvShown = false;   // このステージでKVを開始したかどうかのフラグ

        // --- C. 🚀 【残像撃退】Canvasを全消去（真っ黒）にする ---
        if (this.game.ctx) {
            const ctx = this.game.ctx;
            const width = this.game.width || ctx.canvas?.width || 0;
            const height = this.game.height || ctx.canvas?.height || 0;

            if (width > 0 && height > 0) {
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0); // 変形をリセットして全画面を確実に塗る
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            }
        }

        // --- D. エンディング演出関連のリセット ---
        this._endingPhase = 0;
        this._endingTimer = 0;
        this._endingKvAlpha = 0;
        this.game.isEnding = false;

        if (this.dom.fullscreenKv) {
            this.dom.fullscreenKv.style.display = 'none';
            this.dom.fullscreenKv.style.opacity = '0';
        }
        if (this.dom.warpPlayer) {
            this.dom.warpPlayer.style.opacity = '1';
            this.dom.warpPlayer.classList.remove('trigger-warp');
        }
    }

    updateScoreUI() {
        const DIGITS = 7;
        const MAX_DISPLAY_SCORE = 9999990; // 7桁表示の限界値

        if (this.dom.scoreDisplay) {
            // 表示用スコア（内部スコアがどれだけ大きくても 9,999,990 で打ち止め）
            const displayScore = Math.min(this.game.score, MAX_DISPLAY_SCORE);
            const isCounterStopped = (this.game.score >= MAX_DISPLAY_SCORE);

            this.dom.scoreDisplay.innerText = `SCORE: ${displayScore.toString().padStart(DIGITS, '0')}`;
            this.dom.scoreDisplay.classList.toggle('counter-stop', isCounterStopped);

            // カンスト達成の「瞬間」だけ効果音を鳴らす（演出用フラグ）
            if (isCounterStopped && !this.hasPlayedCounterStopSE) {
                if (this.game.sc.audio) this.game.sc.audio.playPowerUp();
                this.hasPlayedCounterStopSE = true; // SE既生フラグ（UI側のローカル管理）
            }
        }

        if (this.dom.hiScoreDisplay) {
            const currentHi = this.game.sc.highScore || 0;
            const displayHiScore = Math.min(currentHi, MAX_DISPLAY_SCORE);

            this.dom.hiScoreDisplay.innerText = `HI-SCORE: ${displayHiScore.toString().padStart(DIGITS, '0')}`;
            this.dom.hiScoreDisplay.classList.toggle('counter-stop', currentHi >= MAX_DISPLAY_SCORE);
        }
    }

triggerExtendBlink() {
        // 1. SE再生
        if (this.game.sc?.audio) {
            this.game.sc.audio.playPowerUp();
        }

        // 2. 新規増加フラグを立てて表示更新
        this.isExtending = true;
        this.updateLivesUI();

        // 3. 2秒後にフラグを解除して通常表示に戻す
        if (this._blinkTimer) clearTimeout(this._blinkTimer);
        this._blinkTimer = setTimeout(() => {
            this.isExtending = false;
            this.updateLivesUI(); // 点滅終わりの通常表示に戻す
            this._blinkTimer = null;
        }, 2000);
    }

    updateLivesUI() {
        const el = this.dom.livesDisplay;
        if (!el) return;

        const count = Math.max(0, this.game.lives - 1);
        const icon = "🚀";

        if (count === 0) {
            el.innerHTML = "";
            return;
        }

        let html = "";

        if (count <= 3) {
            if (this.isExtending) {
                // 例: 3機目の場合、既存2個 ＋ 点滅する1個
                const baseIcons = icon.repeat(count - 1);
                html = `${baseIcons}<span class="extend-blink-single">${icon}</span>`;
            } else {
                html = icon.repeat(count);
            }
        } else {
            // 4機以上（x4など数値表記）の場合
            if (this.isExtending) {
                html = `${icon}x<span class="extend-blink-single">${count}</span>`;
            } else {
                html = `${icon}x${count}`;
            }
        }

        // HTML内容が変わった時だけ書き換え（余計な再描画を防ぐ）
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
        
        document.getElementById('debug-frame').innerText = this.game.frame;
        document.getElementById('debug-scn-frame').innerText = this.game.scenario.currentScenarioFrame;
        document.getElementById('debug-index').innerText = `${this.game.scenario.currentIndex} / ${this.game.scenario.length}`;

        const bonusEl = document.getElementById('debug-bonus-time');
        const boss = this.game.entities.find(e => e.isBoss); 
        
        if (boss && this.game.bossStartTime > 0 && bonusEl) {
            const elapsed = this.game.frame - this.game.bossStartTime;
            const remaining = Math.max(0, boss.timeLimit - elapsed);
            bonusEl.innerText = `${remaining}F (${(remaining / GAME_CONFIG?.FPS || 60).toFixed(2)}s)`;
            bonusEl.style.color = remaining < 600 ? "#f00" : "#0ff"; 
        } else if (bonusEl) {
            bonusEl.innerText = "---";
            bonusEl.style.color = "#888";
        }        
        document.getElementById('debug-load').innerText = this.game.entities.length;

        const spawnEl = document.getElementById('debug-spawn');
        if (spawnEl) spawnEl.innerText = this.game.stats.enemiesSpawned;

        const killEl = document.getElementById('debug-kill');
        if (killEl) killEl.innerText = this.game.stats.enemiesKilled;
    }

    drawOverlayMessages(ctx) {
        ctx.save();
        ctx.font = '16px "Press Start 2P", cursive';
        ctx.textAlign = 'center';

        // ---------------------------------------------------------------
        // 🌟 【最優先1】ステージ7クリア・エンディング演出（HTML遷移）
        // ---------------------------------------------------------------
        if (this.game.isEnding) {
            const domKv = this.dom.fullscreenKv;
            const container = this.dom.gameContainer;
            const warpPlayer = this.dom.warpPlayer;
            
            if (this._endingPhase === 0) {
                this._endingPhase = 1;
                this._endingTimer = 0;

                if (container) container.style.display = 'none';

                if (domKv) {
                    const kvPath = `${this.game.sc.assetBase}ending/kv.png`;
                    domKv.style.backgroundImage = `url('${kvPath}')`;
                    domKv.style.display = 'flex';
                    setTimeout(() => { domKv.style.opacity = '1'; }, 50);
                }

                if (warpPlayer) {
                    const playerImgPath = `${this.game.sc.assetBase}player.webp`;
                    warpPlayer.src = playerImgPath;
                    warpPlayer.classList.add('trigger-warp');
                }
            }

            this._endingTimer++;

            if (this._endingPhase === 1 && this._endingTimer >= 60) {
                this._endingPhase = 2;
            }
            if (this._endingPhase === 2 && this._endingTimer >= 330) {
                this._endingPhase = 3;
            }
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
                    this.game.endSession("ALL STAGES CLEARED!");
                }
            }

            return;
        }

        // ---------------------------------------------------------------
        // 💀 【最優先2】ゲームオーバー演出：KV描画を即時強制停止
        // ---------------------------------------------------------------
        // 💡 this.game.currentLives -> this.game.lives に修正
        if (!this.game.player.alive && this.game.lives <= 0) {
            this.isKvActive = false;

            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(0, this.game.height / 2 - 50, this.game.width, 100);
            ctx.fillStyle = '#FFF';
            ctx.fillText('GAME OVER', this.game.width / 2, this.game.height / 2);
            ctx.restore();
            return;
        }

        // ---------------------------------------------------------------
        // 🌌 通常の道中開始時：KV演出
        // ---------------------------------------------------------------
        let kvPath = null;
        let kvDuration = 180;
        if (this.game.scenario.kv) {
            if (typeof this.game.scenario.kv === 'object') {
                kvPath = this.game.scenario.kv.path;
                kvDuration = this.game.scenario.kv.duration || 180;
            } else {
                kvPath = this.game.scenario.kv;
            }
        }

        // kvDuration 未満かつ未開始（!this._kvShown）ならKVを自動有効化
        if (kvPath && this.game.frame < kvDuration && !this._kvShown) {
            this.isKvActive = true;
            this._kvShown = true;
        }

        // KV有効期間中かつ isKvActive が true の場合のみ描画
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
                    kvImage.naturalWidth !== 0 && 
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
                    const baseHeight = kvImage.height * (this.game.width / kvImage.width);
                    const scale = 1.12 - (progress * 0.12); 
                    const drawWidth = baseWidth * scale;
                    const drawHeight = baseHeight * scale;
                    const drawX = (this.game.width - drawWidth) / 2;
                    const drawY = (this.game.height * 0.35) - (drawHeight / 2);

                    // 黒背景のオーバーレイ
                    ctx.save();
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.globalAlpha = kvAlpha * 0.6;
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, this.game.width, this.game.height);
                    ctx.restore();

                    // KV本体の描画
                    ctx.globalCompositeOperation = 'screen';
                    ctx.globalAlpha = kvAlpha;
                    ctx.drawImage(kvImage, drawX, drawY, drawWidth, drawHeight);
                    ctx.restore();
                }
            }

            // ステージ名テキストの描画
            const textCenterY = this.game.height * 0.65;
            ctx.font = '16px "Press Start 2P", cursive';
            ctx.fillStyle = `rgba(0, 255, 255, ${textAlpha.toFixed(2)})`;
            ctx.fillText(`STAGE ${this.game.currentStageNum}`, this.game.width / 2, textCenterY);
            
            ctx.font = '11px "Press Start 2P", cursive';
            ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha.toFixed(2)})`;
            ctx.fillText(this.game.scenario.stageName || '', this.game.width / 2, textCenterY + 30);

        } else if (this.game.frame >= kvDuration && this.isKvActive) {
            // フェードアウト完了時に描画フラグを倒す
            this.isKvActive = false;
        }

        // ---------------------------------------------------------------
        // 🌟 通常のステージクリア演出 (STAGE 1〜6用)
        // ---------------------------------------------------------------
        if (this.game.isCleared) {
            const stageNameStr = this.game.scenario.stageName; 
            ctx.fillStyle = '#0FF';
            ctx.fillText(`STAGE ${this.game.currentStageNum} CLEAR`, this.game.width / 2, this.game.height / 2);            
            ctx.font = '10px "Press Start 2P", cursive';
            ctx.fillStyle = '#FFF';
            ctx.fillText(stageNameStr, this.game.width / 2, this.game.height / 2 + 30);
        }

        ctx.restore();
    }
}