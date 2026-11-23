/*
 * PROJECT: VOID-CIRCUIT
 *
 * input.ts - Unified Input Management
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

export interface InputManagerOptions {
    ignoreElement?: string;
}

/**
 * InputManager: 入力統合管理
 * キーボード、マウス、タッチの入力を正規化して保持します。
 */
export class InputManager {
    public canvas: HTMLCanvasElement | null;
    public ignoreElementId: string;

    public keys: Set<string>;
    public touchX: number | null;
    public touchY: number | null;
    public isTouching: boolean;
    public isRightMouseDown: boolean;     // 右クリック長押し判定用
    public rightClickTriggered: boolean;  // 右クリック単発トリガー用
    public doubleTapTriggered: boolean;   // ダブルタップ単発トリガー用
    public isCanvasOutClicked: boolean;   // 画面外クリック/タップ判定用

    // ダブルタップ判定用の設定値
    private lastTapTime: number;
    private lastTapX: number;
    private lastTapY: number;
    private readonly doubleTapDelay: number;       // タップとタップの間隔（ミリ秒）
    private readonly doubleTapMaxDistance: number; // 許容する最大距離（論理ピクセル）

    private _abortController: AbortController;

    constructor(canvas: HTMLCanvasElement | null, options: InputManagerOptions = {}) {
        this.canvas = canvas;
        this.ignoreElementId = options.ignoreElement || 'start-screen';

        this.keys = new Set<string>();
        this.touchX = null;
        this.touchY = null;
        this.isTouching = false;
        this.isRightMouseDown = false;
        this.rightClickTriggered = false;
        this.doubleTapTriggered = false;
        this.isCanvasOutClicked = false;

        // ダブルタップ判定用の設定値
        this.lastTapTime = 0;
        this.lastTapX = 0;
        this.lastTapY = 0;
        this.doubleTapDelay = 300;       // タップとタップの間隔（ミリ秒）
        this.doubleTapMaxDistance = 40;  // 許容する最大距離（論理ピクセル）

        this._abortController = new AbortController();
        this._setupEventListeners();
    }

    private _setupEventListeners(): void {
        const { signal } = this._abortController;

        // キーボード
        window.addEventListener('keydown', (e: KeyboardEvent) => this.keys.add(e.code), { signal });
        window.addEventListener('keyup', (e: KeyboardEvent) => this.keys.delete(e.code), { signal });

        const updatePos = (e: MouseEvent | TouchEvent) => this._handleCoordinate(e);

        // コンテキストメニューの無効化（右クリックメニューを出さない）
        if (this.canvas) {
            this.canvas.addEventListener('contextmenu', (e: MouseEvent) => {
                e.preventDefault();
            }, { signal });
        }

        // --- 画面外クリック / タップ検出（PointerEventsでマウス/タッチの重複発火を防止） ---
        const handleOutPointerDown = (e: PointerEvent) => {
            const target = e.target as Node | null;

            // Canvas自体の操作であれば「画面外」とは判定しない
            if (this.canvas && target && (target === this.canvas || this.canvas.contains(target))) {
                return;
            }

            // 指定された除外要素（スタート画面等）内の操作も無視する
            const ignoreEl = document.getElementById(this.ignoreElementId);
            if (ignoreEl && target && ignoreEl.contains(target)) return;

            // 画面外が押されたフラグを立てる
            this.isCanvasOutClicked = true;
        };

        // mousedown / touchstart の代わりに pointerdown 一本に統一
        window.addEventListener('pointerdown', handleOutPointerDown, { signal });

        // マウス (canvas内)
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
                if (e.button === 0) {
                    // 左クリック
                    this.isTouching = true;
                    updatePos(e);
                } else if (e.button === 2) {
                    // 右クリック
                    this.isRightMouseDown = true;
                    this.rightClickTriggered = true;
                    updatePos(e);
                }
            }, { signal });
        }

        window.addEventListener('mousemove', (e: MouseEvent) => {
            if (this.isTouching || this.isRightMouseDown) updatePos(e);
        }, { signal });

        window.addEventListener('mouseup', (e: MouseEvent) => {
            if (e.button === 0) {
                this.isTouching = false;
            } else if (e.button === 2) {
                this.isRightMouseDown = false;
            }
        }, { signal });

        // タッチ (iOS/Android 向け最適化)
        if (this.canvas) {
            const touchOptions: AddEventListenerOptions = { passive: false, signal };

            this.canvas.addEventListener('touchstart', (e: TouchEvent) => {
                this.isTouching = true;

                // ① 先に現在のタッチ座標を更新
                updatePos(e);

                // --- ダブルタップ判定 (時間 ＆ 距離チェック) ---
                const now = Date.now();
                const timeDiff = now - this.lastTapTime;

                if (this.touchX !== null && this.touchY !== null) {
                    if (timeDiff < this.doubleTapDelay) {
                        // ② 1回目と2回目のタップ位置の距離（論理ピクセル）を計算
                        const dx = this.touchX - this.lastTapX;
                        const dy = this.touchY - this.lastTapY;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist <= this.doubleTapMaxDistance) {
                            this.doubleTapTriggered = true;
                            this.lastTapTime = 0; // 連続判定防止のリセット
                        } else {
                            this.lastTapTime = now;
                            this.lastTapX = this.touchX;
                            this.lastTapY = this.touchY;
                        }
                    } else {
                        this.lastTapTime = now;
                        this.lastTapX = this.touchX;
                        this.lastTapY = this.touchY;
                    }
                }

                if (e.cancelable) e.preventDefault();
            }, touchOptions);

            this.canvas.addEventListener('touchmove', (e: TouchEvent) => {
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

    public getAndResetCanvasOutClick(): boolean {
        const clicked = this.isCanvasOutClicked;
        this.isCanvasOutClicked = false;
        return clicked;
    }

    /**
     * 右クリックが押されたかを判定し、判定後にフラグをリセットします（単発トリガー用）
     */
    public getAndResetRightClick(): boolean {
        const triggered = this.rightClickTriggered;
        this.rightClickTriggered = false;
        return triggered;
    }

    /**
     * ダブルタップが行われたかを判定し、判定後にフラグをリセットします（単発トリガー用）
     */
    public getAndResetDoubleTap(): boolean {
        const triggered = this.doubleTapTriggered;
        this.doubleTapTriggered = false;
        return triggered;
    }

    /**
     * 単発の入力トリガーフラグを一括でクリア（ポーズ中などの誤発火防止用）
     */
    public clearTriggers(): void {
        this.getAndResetRightClick();
        this.getAndResetDoubleTap();
        if (typeof this.getAndResetCanvasOutClick === 'function') {
            this.getAndResetCanvasOutClick();
        }
    }

    private _handleCoordinate(e: MouseEvent | TouchEvent): void {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();

        let clientX: number;
        let clientY: number;

        if ('touches' in e && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if ('clientX' in e) {
            clientX = e.clientX;
            clientY = e.clientY;
        } else {
            return;
        }

        // 論理サイズと実表示サイズの比率を計算
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        this.touchX = (clientX - rect.left) * scaleX;
        this.touchY = (clientY - rect.top) * scaleY;
    }

    public isPressed(keyCode: string): boolean {
        return this.keys.has(keyCode);
    }

    /** インスタンス破棄時にイベントリスナーを一括解除 */
    public destroy(): void {
        this._abortController.abort();
        this.keys.clear();
        this.touchX = null;
        this.touchY = null;
        this.isTouching = false;
        this.isRightMouseDown = false;
        this.rightClickTriggered = false;
        this.doubleTapTriggered = false;
        this.isCanvasOutClicked = false;
    }
}