/*
 * PROJECT: VOID-CIRCUIT
 *
 * entities/player.js
 *
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import { Entity } from './base.js';

/**
 * 弾クラス（自機用）
 */
export class Bullet extends Entity {
    static DEFAULT_WIDTH = 4;
    static DEFAULT_HEIGHT = 10;
    static DEFAULT_VY = -7;

    constructor(x, y, vx = 0) {
        super(x, y, Bullet.DEFAULT_WIDTH, Bullet.DEFAULT_HEIGHT);

        this.vx = vx;  
        this.vy = Bullet.DEFAULT_VY;  

        this.halfWidth = this.width / 2;
        this.halfHeight = this.height / 2;
    }

    update() {
        this.x += this.vx; 
        this.y += this.vy; 
    }

    draw(ctx) {
        ctx.fillStyle = '#FF0';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

/**
 * プレイヤーが操作する自機クラス
 */
export class Player extends Entity {
    // --- 調整用定数（マジックナンバーの共通管理） ---
    static START_WIDTH = 32;       // 自機の幅
    static START_HEIGHT = 32;      // 自機の高さ
    static DEFAULT_SPEED = 5;      // 移動速度
    static HIT_RADIUS = 10;        // 当たり判定の半径
    
    static CD_STRAIGHT = 8;        // STRAIGHT時の連射クールダウン(フレーム)
    static CD_WIDE = 12;           // WIDE時の連射クールダウン(フレーム)

    constructor(game, input, x, y) {
        super(x, y, Player.START_WIDTH, Player.START_HEIGHT);
        this.halfWidth = this.width / 2;
        this.halfHeight = this.height / 2;
        this.hitRadiusSq = Player.HIT_RADIUS * Player.HIT_RADIUS;
        
        this.game = game;
        this.input = input;
        this.speed = Player.DEFAULT_SPEED;
        this.alive = true;
        this._invincibleTimer = 0;

        this.weaponMode = 'STRAIGHT';      // 'STRAIGHT' または 'WIDE'
        this.shotCooldown = 0;             // 連射制限用クールダウンタイマー
        this.weaponSwitchReady = true;     // Xキーの押しっぱなしによる高速連打防止フラグ

        this.windForceX = 0;               // 風圧による横方向の力
        this.suctionForceX = 0;
        this.suctionForceY = 0;
        this.mouseWindOffset = 0;          // マウス/タッチ操作時の風圧蓄積オフセット
        this.mouseSuctionOffsetX = 0;
        this.mouseSuctionOffsetY = 0;

        this.image = new Image();
        this.image.onload = () => {
            this.isLoaded = true;
        };
        this.image.src = `${game.sc.assetBase}player.webp`;
    }

    get centerX() { return this.x + this.halfWidth; }
    get centerY() { return this.y + this.halfHeight; }    

    setInvincible(frames) { 
        this._invincibleTimer = frames; 
    }
    get isInvincible() { return this._invincibleTimer > 0; }
    
    // --- 武器制御 ---
    set weaponMode(val) {
        this._weaponMode = val;
        this._updateWeaponUI();
    }
    get weaponMode() { return this._weaponMode; }

    _updateWeaponUI() {
        const weaponContainer = document.getElementById('weapon-container');
        const displayEl = document.getElementById('weapon-display');
        const hintEl = document.getElementById('weapon-hint');
        if (displayEl) {
            displayEl.innerText = `WEAPON: ${this.weaponMode}`;
            displayEl.className = (this.weaponMode === 'WIDE') ? 'mode-wide' : '';
        }
        if (hintEl) hintEl.innerText = '[X]Key OR TAP SIDE-UI TO CHANGE';
        if (weaponContainer) weaponContainer.style.display = 'block';
    }

    /**
     * 画面外判定（プレイヤーは判定しない）
     */
    isOutOfBounds(game, margin) {
        return false;
    }

    /** 
     * プレイヤーの入力と状態に応じて位置・武器・射撃を一括更新する
     * @param {number} cw - 画面幅
     * @param {number} ch - 画面高さ
     * @param {Object} inputState - game.jsから渡される入力状態オブジェクト
     */
    update(cw, ch, inputState = {}) {
        if (!this.alive) return;
        if (this._invincibleTimer > 0) this._invincibleTimer--;
        if (this.shotCooldown > 0) this.shotCooldown--;

        // 🎬 リプレイ再生中かどうかチェック（game.jsのreplayオブジェクトを参照）
        const isPlayback = this.game.replay && this.game.replay.mode === 'PLAYBACK';

        if (!isPlayback) {
            // ==========================================
            // 【通常プレイ時のみ】移動計算を実行
            // ==========================================

            // 1. キーボード操作による移動（Direct Input 判定）
            const rawInput = this.game.sc.input;
            if (rawInput.isPressed('ArrowUp')) this.y -= this.speed;
            if (rawInput.isPressed('ArrowDown')) this.y += this.speed;
            if (rawInput.isPressed('ArrowLeft')) this.x -= this.speed;
            if (rawInput.isPressed('ArrowRight')) this.x += this.speed;

            // 2. タッチ/マウス操作
            const isTouching = inputState.isTouching !== undefined ? inputState.isTouching : rawInput.isTouching;
            const touchX = inputState.touchX !== undefined ? inputState.touchX : rawInput.touchX;
            const touchY = inputState.touchY !== undefined ? inputState.touchY : rawInput.touchY;

            if (isTouching && touchX !== null) {
                // ドラッグ移動（風圧＆吸い込み両方のオフセットを計算）
                this._handleTouchMove(touchX, touchY, cw, ch);
            } else {
                // 指/マウスを離したらズレをリセット
                this.mouseWindOffset = 0;
                this.mouseSuctionOffsetX = 0;
                this.mouseSuctionOffsetY = 0;

                // キーボード操作等のために風圧・吸い込みを直接加算
                this.x += this.windForceX + this.suctionForceX;
                this.y += this.suctionForceY;
            }

            // 3. 風圧・吸い込み力を使い切ったのでリセット
            this.windForceX = 0;
            this.suctionForceX = 0;
            this.suctionForceY = 0;

            // 4. 画面外はみ出し防止
            this._clampPosition(cw, ch);
        } else {
            // リプレイ再生中は座標指定で位置が固定されているため、蓄積オフセット等のみ初期化
            this.mouseWindOffset = 0;
            this.mouseSuctionOffsetX = 0;
            this.mouseSuctionOffsetY = 0;
            this.windForceX = 0;
            this.suctionForceX = 0;
            this.suctionForceY = 0;
        }

        // 5. 武器換装とショット自動生成（通常時・再生時問わず更新）
        this._handleWeaponSwitch(inputState);
        this._handleShooting(inputState);
    }

    /** タッチ/マウス入力時の慣性＆バウンス付き移動を計算する */
    _handleTouchMove(tx, ty, cw, ch) {
        // 🌪️ 風圧オフセット
        if (this.windForceX !== 0) {
            this.mouseWindOffset += this.windForceX * 1.2;
            const maxOffset = cw * 0.4;
            this.mouseWindOffset = Math.max(-maxOffset, Math.min(maxOffset, this.mouseWindOffset));
        }

        // 🌀 吸い込みオフセット（X・Y両方）
        if (this.suctionForceX !== 0 || this.suctionForceY !== 0) {
            this.mouseSuctionOffsetX += this.suctionForceX * 1.2;
            this.mouseSuctionOffsetY += this.suctionForceY * 1.2;

            const maxOffset = cw * 0.4;
            this.mouseSuctionOffsetX = Math.max(-maxOffset, Math.min(maxOffset, this.mouseSuctionOffsetX));
            this.mouseSuctionOffsetY = Math.max(-maxOffset, Math.min(maxOffset, this.mouseSuctionOffsetY));
        }

        // 基準の目標位置（カーソル位置）に、風圧と吸い込みのズレを加算
        const targetX = (tx - this.width / 2) + this.mouseWindOffset + this.mouseSuctionOffsetX;
        const targetY = (ty - this.height / 2) + this.mouseSuctionOffsetY;
        
        const vx = (targetX - this.x) * 0.2;
        const vy = (targetY - this.y) * 0.2;
        
        this.x += vx;
        this.y += vy;

        // 🏀 バウンス計算
        const bounce = 0.6;
        const minX = -this.halfWidth;
        const maxX = cw - this.halfWidth;
        const minY = -this.halfHeight;
        const maxY = ch - this.halfHeight;

        if (this.x < minX) { 
            this.x = minX; 
            this.x += Math.abs(vx) * bounce; 
        } else if (this.x > maxX) { 
            this.x = maxX; 
            this.x -= Math.abs(vx) * bounce; 
        }

        if (this.y < minY) { 
            this.y = minY; 
            this.y += Math.abs(vy) * bounce; 
        } else if (this.y > maxY) { 
            this.y = maxY; 
            this.y -= Math.abs(vy) * bounce; 
        }
    }

    /** 自機位置を画面領域内に強制クランプする（半身はみ出し許容） */
    _clampPosition(cw, ch) {
        const width = cw || (this.game ? this.game.width : 320);
        const height = ch || (this.game ? this.game.height : 480);

        const minX = -this.halfWidth;
        const maxX = width - this.halfWidth;
        const minY = -this.halfHeight;
        const maxY = height - this.halfHeight;

        this.x = Math.max(minX, Math.min(maxX, this.x));
        this.y = Math.max(minY, Math.min(maxY, this.y));
    }

    /** 武器換装ロジック（Xキー / マウス右クリック / ダブルタップ / 画面外タップ）*/
    _handleWeaponSwitch(inputState) {
        if (!this.game.isRunning || !this.alive) return;

        // キーボード（Xキー）判定
        const rawInput = this.game.sc.input;
        const isKeyboardDown = rawInput.isPressed('KeyX') || 
                               rawInput.isPressed('x') || 
                               rawInput.isPressed('X');

        // 各種ワンショットトリガー（確定された boolean 値を参照）
        const isRightClicked = !!inputState.isRightClick;
        const isDoubleTapped = !!inputState.isDoubleTap;
        const isCanvasOutClicked = !!inputState.isCanvasOutClick;

        // Xキー長押し防止 OR 各種単発トリガー
        if ((isKeyboardDown && this.weaponSwitchReady) || isRightClicked || isDoubleTapped || isCanvasOutClicked) {
            this.weaponMode = (this.weaponMode === 'STRAIGHT') ? 'WIDE' : 'STRAIGHT';
            this.game.weaponMode = this.weaponMode;

            if (this.game.sc && this.game.sc.audio) {
                this.game.sc.audio.playChangeWp();
            }

            this.weaponSwitchReady = false; 
        } else if (!isKeyboardDown) {
            this.weaponSwitchReady = true; 
        }
    }

    /** ショット発射ロジック（Zキー / スペース / タッチ入力対応） */
    _handleShooting(inputState) {
        // inputState.isFiring は game.js 側で Z / Space / タッチ の論理ORで確定済み
        const isFiring = !!inputState.isFiring;
        
        if (isFiring && this.shotCooldown === 0) {
            const centerX = this.centerX;
            const topY = this.y;

            if (this.weaponMode === 'STRAIGHT') {
                const offset = 6; 
                this.game.entities.push(new Bullet(centerX - offset, topY, 0)); 
                this.game.entities.push(new Bullet(centerX + (offset - Bullet.DEFAULT_WIDTH), topY, 0)); 
                
                this.game.stats.shotsFired += 2; 
                this.shotCooldown = Player.CD_STRAIGHT; 
            } else if (this.weaponMode === 'WIDE') {
                const halfBulletW = Bullet.DEFAULT_WIDTH / 2;
                const bulletStartX = centerX - halfBulletW;

                this.game.entities.push(new Bullet(bulletStartX, topY, 0));    
                this.game.entities.push(new Bullet(bulletStartX, topY, -3.5)); 
                this.game.entities.push(new Bullet(bulletStartX, topY, 3.5));  
                
                this.game.stats.shotsFired += 3; 
                this.shotCooldown = Player.CD_WIDE; 
            }

            // ショットSEの再生
            if (this.game.sc && this.game.sc.audio) {
                this.game.sc.audio.playShot();
            }
        }
    }

    /** プレイヤーを描画する（無敵状態では点滅する）*/
    draw(ctx) {
        if (!this.alive) return; 
        if (this._invincibleTimer > 0 && Math.floor(this._invincibleTimer / 5) % 2 === 0) return;

        if (this.isLoaded) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#0FF';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}