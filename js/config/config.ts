/*
 * PROJECT: VOID-CIRCUIT
 *
 * config/config.ts - BIOS風設定画面・ゲームオプション管理
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import { SoundTestManager } from './soundTest.js';
import type { ConfigControllerLike, ConfigManagerLike } from '../types/config.js';

export type ExtendOption = readonly [number] | readonly [number, number] | 'NONE';

export const CONFIG_OPTIONS = {
    difficulty: ['EASY', 'NORMAL', 'HARD', 'VERY HARD'],
    lives: [1, 2, 3, 5],
    extend: [
        [150000, 500000],
        [250000, 700000],
        [350000],
        'NONE'
    ]
} as const satisfies {
    difficulty: readonly string[];
    lives: readonly number[];
    extend: readonly ExtendOption[];
};

export type DifficultyLevel = (typeof CONFIG_OPTIONS.difficulty)[number];
export type LivesOption = (typeof CONFIG_OPTIONS.lives)[number];

/** 配列内の選択肢を前後循環するヘルパー */
function cycleOption<T>(opts: readonly [T, ...T[]], current: T, isRight: boolean): T {
    const idx = opts.indexOf(current);
    const safeIdx = idx === -1 ? 0 : idx;
    const nextIdx = isRight
        ? (safeIdx + 1) % opts.length
        : (safeIdx - 1 + opts.length) % opts.length;
    return opts[nextIdx] ?? opts[0];
}

/**
 * 設定画面（BIOS風）を管理するクラス
 */
export class ConfigManager implements ConfigManagerLike {
    public sc: ConfigControllerLike;
    public isMode: boolean = false;
    public currentIndex: number = 0;
    public debugCCount: number = 0;

    public soundTest: SoundTestManager;

    public readonly OPTIONS = CONFIG_OPTIONS;

    public difficulty: DifficultyLevel;
    public lives: LivesOption;
    public extend: ExtendOption;
    public isInvincibleCheat: boolean = false;

    public screenEl: HTMLElement | null;
    public startScreenEl: HTMLElement | null;
    public items: HTMLElement[] = [];
    public resetConfirmed: boolean = false;

    constructor(sc: ConfigControllerLike) {
        this.sc = sc;

        this.soundTest = new SoundTestManager(sc.audio, sc.assetBase ?? '');
        this.soundTest.onIndexChanged = () => this.refreshAllDisplay();

        this.difficulty = this.OPTIONS.difficulty[1];
        this.lives = this.OPTIONS.lives[2];
        this.extend = this.OPTIONS.extend[1];

        this.screenEl = document.getElementById('config-screen');
        this.startScreenEl = document.getElementById('start-screen');
    }

    /** 設定画面を開く */
    public async open(): Promise<void> {
        this.isMode = true;

        // 先にデータを構築して画面の裏でリストを確定させる
        this.items = Array.from(document.querySelectorAll<HTMLElement>('.config-item'));
        await this.soundTest.activate(() => this.isMode);

        // 表示される前に描画を一度走らせ、最初から正しい行間にしておく
        this.refreshAllDisplay();
        this.updateSelection();
        this.setupMouseEvents();

        // すべての準備が整ってから画面を表示
        if (this.startScreenEl) this.startScreenEl.style.display = 'none';
        if (this.screenEl) this.screenEl.style.display = 'flex';
    }

    /** 設定画面を閉じる */
    public close(): void {
        this.isMode = false;
        if (this.screenEl) {
            this.screenEl.style.display = 'none';
        }
        if (this.startScreenEl) {
            this.startScreenEl.style.display = 'flex';
        }

        this.soundTest.deactivate(this.screenEl);

        // 画面外クリックが残るのでリセット
        this.sc.input?.clearTriggers();
    }

    /** キー入力処理 */
    public handleInput(e: KeyboardEvent): void {
        if (!this.isMode) return;

        // 画面に見えている有効なアイテムだけを抽出
        const visibleItems = this.items.filter((item) => {
            const style = window.getComputedStyle(item);
            return style.display !== 'none' && style.opacity !== '0';
        });

        if (visibleItems.length === 0) return;

        const currentItem = this.items[this.currentIndex];
        let currentVisibleIdx = currentItem ? visibleItems.indexOf(currentItem) : -1;
        if (currentVisibleIdx === -1) currentVisibleIdx = 0;

        switch (e.code) {
            case 'ArrowUp': {
                currentVisibleIdx = (currentVisibleIdx - 1 + visibleItems.length) % visibleItems.length;
                const nextVisible = visibleItems[currentVisibleIdx];
                if (nextVisible) {
                    this.currentIndex = this.items.indexOf(nextVisible);
                    this.updateSelection();
                }
                break;
            }
            case 'ArrowDown': {
                currentVisibleIdx = (currentVisibleIdx + 1) % visibleItems.length;
                const nextVisible = visibleItems[currentVisibleIdx];
                if (nextVisible) {
                    this.currentIndex = this.items.indexOf(nextVisible);
                    this.updateSelection();
                }
                break;
            }
            case 'ArrowLeft':
            case 'ArrowRight':
                this.handleValueChange(e.code === 'ArrowRight');
                break;
            case 'Space':
            case 'KeyZ':
                this.handleAction();
                break;
            case 'KeyC':
                this.handleCheatCommand();
                break;
        }
    }

    /** 値の変更処理 */
    public handleValueChange(isRight: boolean): void {
        const item = this.items[this.currentIndex];
        if (!item) return;
        const setting = item.dataset['setting'];

        if (setting === 'difficulty') {
            this.difficulty = cycleOption(this.OPTIONS.difficulty, this.difficulty, isRight);
        } else if (setting === 'lives') {
            this.lives = cycleOption(this.OPTIONS.lives, this.lives, isRight);
        } else if (setting === 'extend') {
            this.extend = cycleOption(this.OPTIONS.extend, this.extend, isRight);
        } else if (this.soundTest.handlesSetting(setting)) {
            this.soundTest.handleValueChange(setting, isRight);
        }

        this.refreshDisplay(item);
    }

    /** 決定時のアクション */
    public handleAction(): void {
        const item = this.items[this.currentIndex];
        if (!item) return;
        const setting = item.dataset['setting'];

        if (setting === 'sound') this.soundTest.playSE();
        if (setting === 'bgm') this.soundTest.toggleBGMWithUI(this.screenEl);

        if (setting === 'reset_score') {
            if (!this.resetConfirmed) {
                this.resetConfirmed = true;
                this.sc.audio?.playHitSound();
                item.classList.add('danger');
                const valEl = item.querySelector<HTMLElement>('.value');
                if (valEl) valEl.innerText = 'SURE?';
            } else {
                this.executeHighScoreReset();
                this.resetConfirmed = false;
                item.classList.remove('danger');
            }
        } else {
            this.cancelResetConfirm();
        }

        if (setting === 'exit') {
            this.saveConfig();
            this.close();
        }
    }

    /** 描画（全部） */
    public refreshAllDisplay(): void {
        this.items.forEach((item) => this.refreshDisplay(item));
    }

    /** 描画（アイテム） */
    public refreshDisplay(item: HTMLElement): void {
        const setting = item.dataset['setting'];
        const valEl = item.querySelector<HTMLElement>('.value');
        if (!valEl) return;

        const wrapArrows = (text: string | number): string => {
            const btnStyle = [
                'cursor: pointer;',
                'padding: 10px 14px;',
                'margin: -10px -14px;',
                'user-select: none;',
                'display: inline-block;',
                'font-weight: bold;'
            ].join(' ');

            return (
                `<span class="arrow-btn left-arrow" style="${btnStyle}"> ◀ </span>` +
                `<span class="inner-val" style="padding: 0 12px; display: inline-block; min-width: 80px; text-align: center;">${text}</span>` +
                `<span class="arrow-btn right-arrow" style="${btnStyle}"> ▶ </span>`
            );
        };

        if (setting === 'difficulty') {
            valEl.innerHTML = wrapArrows(this.difficulty);
        } else if (setting === 'lives') {
            valEl.innerHTML = wrapArrows(this.lives);
        } else if (setting === 'extend') {
            let displayVal: string = String(this.extend);
            if (Array.isArray(this.extend)) {
                if (this.extend.length === 1) {
                    const first = (this.extend[0] / 10000).toFixed(0) + '万';
                    displayVal = `${first} (1回)`;
                } else {
                    const first = (this.extend[0] / 10000).toFixed(0) + '万';
                    const second = (this.extend[1] / 10000).toFixed(0) + '万';
                    displayVal = `${first} / ${second}`;
                }
            }
            valEl.innerHTML = wrapArrows(displayVal);
        } else if (this.soundTest.handlesSetting(setting)) {
            valEl.innerHTML = wrapArrows(this.soundTest.getDisplayValue(setting));
        }
    }

    /** 選択状態の更新 */
    public updateSelection(): void {
        this.items.forEach((item, index) => {
            item.classList.toggle('active', index === this.currentIndex);
        });
        if (this.resetConfirmed) this.cancelResetConfirm();
        this.debugCCount = 0;
    }

    /** マウスイベントセットアップ */
    public setupMouseEvents(): void {
        this.items.forEach((item, index) => {
            item.onclick = (e: MouseEvent) => {
                e.stopPropagation();
                if (this.currentIndex !== index) {
                    this.currentIndex = index;
                    this.updateSelection();
                }
                const setting = item.dataset['setting'];
                const target = e.target as HTMLElement | null;
                const isLeftArrow = target?.classList.contains('left-arrow') ?? false;
                const isRightArrow = target?.classList.contains('right-arrow') ?? false;

                if (isLeftArrow || isRightArrow) {
                    this.handleValueChange(isRightArrow);
                    this.sc.audio?.playHitSound();
                    if (setting === 'sound') this.soundTest.playSE();
                } else if (setting === 'bgm') {
                    this.soundTest.toggleBGMWithUI(this.screenEl);
                    this.refreshDisplay(item);
                } else if (
                    setting === 'difficulty' ||
                    setting === 'lives' ||
                    setting === 'extend' ||
                    (this.soundTest.handlesSetting(setting) && setting !== 'sound')
                ) {
                    this.handleValueChange(true);
                    this.sc.audio?.playHitSound();
                } else {
                    this.handleAction();
                }
            };

            item.onmouseenter = () => {
                const style = window.getComputedStyle(item);
                if (style.display === 'none' || style.opacity === '0') return;
                if (this.currentIndex !== index) {
                    this.currentIndex = index;
                    this.updateSelection();
                }
            };
        });
    }

    public cancelResetConfirm(): void {
        this.resetConfirmed = false;
        this.items.forEach((item) => {
            item.classList.remove('danger');
            if (item.dataset['setting'] === 'reset_score') {
                const valEl = item.querySelector<HTMLElement>('.value');
                if (valEl) valEl.innerText = 'EXECUTE';
            }
        });
    }

    public executeHighScoreReset(): void {
        this.sc.audio?.playExplosion();
        this.sc.visualEffectWarning?.();
        this.sc.resetHighScore();

        const valEl = this.items[this.currentIndex]?.querySelector<HTMLElement>('.value');
        if (valEl) {
            valEl.innerText = 'PURGED!!';
            valEl.style.color = '#0FF';
            setTimeout(() => {
                valEl.innerText = 'EXECUTE';
                valEl.style.color = '';
            }, 2000);
        }
    }

    public handleCheatCommand(): void {
        this.debugCCount++;
        if (this.debugCCount < 7) return;
        this.debugCCount = 0;

        this.isInvincibleCheat = !this.isInvincibleCheat;
        if (this.isInvincibleCheat) {
            this.sc.audio?.playPowerUp();
            if (this.screenEl) {
                this.screenEl.style.color = '#FFD700';
                this.screenEl.style.textShadow = '0 0 10px #FFF';
            }
        } else {
            this.sc.audio?.playExplosion();
            if (this.screenEl) {
                this.screenEl.style.color = '';
                this.screenEl.style.textShadow = '';
            }
        }
    }

    public saveConfig(): void {
        const configData = {
            difficulty: this.difficulty,
            lives: this.lives,
            extend: this.extend
        };
        localStorage.setItem('void_circuit_config', JSON.stringify(configData));
    }

    public loadConfig(): void {
        const saved = localStorage.getItem('void_circuit_config');
        if (!saved) return;
        try {
            const data = JSON.parse(saved) as Partial<{
                difficulty: DifficultyLevel;
                lives: LivesOption;
                extend: ExtendOption;
            }>;

            const matchedDifficulty = this.OPTIONS.difficulty.find((d) => d === data.difficulty);
            this.difficulty = matchedDifficulty ?? this.OPTIONS.difficulty[1];

            const matchedLives = this.OPTIONS.lives.find((l) => l === data.lives);
            this.lives = matchedLives ?? this.OPTIONS.lives[2];

            // 配列比較を含むためJSON文字列一致でオプション定義のインスタンスを復元
            const matchedExtend = this.OPTIONS.extend.find(
                (opt) => JSON.stringify(opt) === JSON.stringify(data.extend)
            );
            this.extend = matchedExtend ?? this.OPTIONS.extend[1];

            this.refreshAllDisplay();
        } catch (e) {
            console.error('Config corruption detected. Resetting to defaults.', e);
        }
    }
}