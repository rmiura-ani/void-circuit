/*
 * PROJECT: VOID-CIRCUIT
 *
 * input.js - Unified Input Management
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

/**
 * InputManager: 入力統合管理
 * キーボード、マウス、タッチの入力を正規化して保持します。
 */
export class InputManager {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ignoreElementId = options.ignoreElement || 'start-screen';

        this.keys = new Set();
        this.touchX = null;
        this.touchY = null;
        this.isTouching = false;
        this.isCanvasOutClicked = false;

        this._abortController = new AbortController();
        this._setupEventListeners();
    }

    _setupEventListeners() {
        const { signal } = this._abortController;

        // キーボード
        window.addEventListener('keydown', (e) => this.keys.add(e.code), { signal });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code), { signal });

        const updatePos = (e) => this._handleCoordinate(e);

        // 画面外クリック検出
        window.addEventListener('mousedown', (e) => {
            if (e.target !== this.canvas) {
                const ignoreEl = document.getElementById(this.ignoreElementId);
                if (ignoreEl?.contains(e.target)) return;
                this.isCanvasOutClicked = true;
            }
        }, { signal });

        // マウス (canvas内 / window全体)
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', (e) => {
                this.isTouching = true;
                updatePos(e);
            }, { signal });
        }

        window.addEventListener('mousemove', (e) => {
            if (this.isTouching) updatePos(e);
        }, { signal });

        window.addEventListener('mouseup', () => {
            this.isTouching = false;
        }, { signal });

        // タッチ (iOS/Android 向け最適化)
        if (this.canvas) {
            const touchOptions = { passive: false, signal };

            this.canvas.addEventListener('touchstart', (e) => {
                this.isTouching = true;
                updatePos(e);
                if (e.cancelable) e.preventDefault();
            }, touchOptions);

            this.canvas.addEventListener('touchmove', (e) => {
                updatePos(e);
                if (e.cancelable) e.preventDefault();
            }, touchOptions);

            const resetTouch = () => {
                this.isTouching = false;
            };

            this.canvas.addEventListener('touchend', resetTouch, { signal });
                this.canvas.addEventListener('touchcancel', resetTouch, { signal });
        }
    }

    getAndResetCanvasOutClick() {
        const clicked = this.isCanvasOutClicked;
        this.isCanvasOutClicked = false;
        return clicked;
    }

    _handleCoordinate(e) {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // 論理サイズと実表示サイズの比率を計算
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        this.touchX = (clientX - rect.left) * scaleX;
        this.touchY = (clientY - rect.top) * scaleY;
    }

    isPressed(keyCode) { 
        return this.keys.has(keyCode); 
    }

    /** インスタンス破棄時にイベントリスナーを一括解除 */
    destroy() {
        this._abortController.abort();
        this.keys.clear();
        this.isTouching = false;
    }
}