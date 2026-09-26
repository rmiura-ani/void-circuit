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
        this.input.getAndResetCanvasOutClick();     // 1回読み捨て
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

    /** プレイヤーの入力と状態に応じて位置・武器・射撃を一括更新する */
    update(cw, ch) {
        if (!this.alive) return;
        if (this._invincibleTimer > 0) this._invincibleTimer--;

        if (this.shotCooldown > 0) this.shotCooldown--;

        // 1. キーボード操作による移動
        if (this.input.isPressed('ArrowUp')) this.y -= this.speed;
        if (this.input.isPressed('ArrowDown')) this.y += this.speed;
        if (this.input.isPressed('ArrowLeft')) this.x -= this.speed;
        if (this.input.isPressed('ArrowRight')) this.x += this.speed;

        // 2. タッチ/マウス操作
        if (this.input.isTouching && this.input.touchX !== null) {
            // ドラッグ移動（風圧＆吸い込み両方のオフセットを計算）
            this._handleTouchMove(this.input.touchX, this.input.touchY, cw, ch);
        } else {
            // 指/マウスを離したらズレをリセット
            this.mouseWindOffset = 0;
            this.mouseSuctionOffsetX = 0;
            this.mouseSuctionOffsetY = 0;

            // キーボード操作等のために風圧・吸い込みを直接加算
            this.x += this.windForceX + this.suctionForceX;
            this.y += this.suctionForceY; // 🌀 縦方向の吸い込みを加算
        }

        // 3. 風圧・吸い込み力を使い切ったのでリセット
        this.windForceX = 0;
        this.suctionForceX = 0;
        this.suctionForceY = 0;

        // 4. 画面外はみ出し防止
        this._clampPosition(cw, ch);

        // 5. 武器換装とショット自動生成
        this._handleWeaponSwitch(this.input);
        this._handleShooting(this.input);
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

        // 🏀 バウンス計算（既存のまま）
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
        const width = cw || (typeof GAME_CONFIG !== 'undefined' ? game.width : 320);
        const height = ch || (typeof GAME_CONFIG !== 'undefined' ? game.height : 480);

        // 最小値: -halfWidth (左/上に半身出る)
        // 最大値: width - halfWidth (右/下に半身出る)
        const minX = -this.halfWidth;
        const maxX = width - this.halfWidth;
        const minY = -this.halfHeight;
        const maxY = height - this.halfHeight;

        this.x = Math.max(minX, Math.min(maxX, this.x));
        this.y = Math.max(minY, Math.min(maxY, this.y));
    }

    /** 武器換装ロジック（Xキー / マウス右クリック）*/
    _handleWeaponSwitch(input) {
        if (!this.game.isRunning || !this.alive) return;

        // キーボード（Xキー）判定
        const isKeyboardDown = input.isPressed('KeyX') || input.isPressed('x') || input.isPressed('X');
        
        // 右クリック判定（クリックされた瞬間に 1 度だけ true になる）
        const isRightClicked = input.getAndResetRightClick(); 

        // Xキーの長押し防止判定 OR 右クリック単発トリガー
        if ((isKeyboardDown && this.weaponSwitchReady) || isRightClicked) {
            this.weaponMode = (this.weaponMode === 'STRAIGHT') ? 'WIDE' : 'STRAIGHT';
            this.game.weaponMode = this.weaponMode; 
            
            if (this.game.sc?.audio) this.game.sc.audio.playChangeWp();                 
            
            // キーボードの長押しによる連続切り替えを防止するためのロック
            this.weaponSwitchReady = false; 
        } else if (!isKeyboardDown) {
            // Xキーが離されたらキーボード用のロックを解除
            this.weaponSwitchReady = true; 
        }
    }

    /** ショット発射ロジック（Zキー / スペース / タッチ入力対応） */
    _handleShooting(input) {
        const isFiring = input.isPressed('KeyZ') || input.isPressed('Space') || input.isTouching;
        
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
            if (this.game.sc?.audio) {
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