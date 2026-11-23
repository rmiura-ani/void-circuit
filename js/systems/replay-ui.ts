/*
 * PROJECT: VOID-CIRCUIT
 *
 * systems/replay-ui.ts
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import { ReplayStorage, type ReplayRecord } from './replayStorage.js';
import { Game, type GameControllerLike } from '../game.js';

export interface ReplayGameLike {
    destroy(): void;
    startReplay?(replayData: ReplayRecord, stage: number): void;
}

export interface ReplayUIControllerLike extends GameControllerLike {
    game: ReplayGameLike | null;
    stopIdleTimer(): void;
    startIdleTimer(): void;
}

export class ReplayUIManager {
    public sc: ReplayUIControllerLike;
    public modalEl: HTMLDivElement | null = null;

    constructor(controller: ReplayUIControllerLike) {
        this.sc = controller;
    }

    /** UIボタン・モーダルの初期セットアップ */
    public setupUI(): void {
        const startScreenNode = document.getElementById('start-screen');
        if (!startScreenNode) return;

        // タイトル画面に「REPLAY」ボタンを設置（未配置の場合のみ）
        let replayBtn = document.getElementById('config-replay-btn') as HTMLButtonElement | null;
        if (!replayBtn) {
            replayBtn = document.createElement('button');
            replayBtn.id = 'config-replay-btn';
            replayBtn.className = 'menu-btn';
            replayBtn.innerText = 'REPLAY';
            startScreenNode.appendChild(replayBtn);
        }

        replayBtn.onclick = (e: MouseEvent) => {
            e.stopPropagation();
            this.sc.stopIdleTimer(); // タイトル放置タイマー停止
            this.openModal();
        };
    }

    /** リプレイ選択モーダルを開く */
    public openModal(): void {
        const replays = ReplayStorage.getList();

        if (!this.modalEl) {
            this.modalEl = document.createElement('div');
            this.modalEl.id = 'replay-modal';
            this.modalEl.className = 'modal-overlay';
            document.body.appendChild(this.modalEl);
        }

        if (replays.length === 0) {
            this.modalEl.innerHTML = `
                <div class="modal-content">
                    <h2>REPLAY LIST</h2>
                    <p>NO REPLAY DATA</p>
                    <button class="modal-close-btn">CLOSE</button>
                </div>
            `;
        } else {
            const listHtml = replays
                .map(
                    (r) => `
                <div class="replay-item">
                    <div class="replay-info">
                        <span class="replay-date">${r.dateStr}</span>
                        <span class="replay-score">SCORE: ${r.score.toLocaleString()} (ST${r.stage})</span>
                    </div>
                    <button class="btn-play-replay" data-id="${r.id}">PLAY</button>
                </div>
            `
                )
                .join('');

            this.modalEl.innerHTML = `
                <div class="modal-content">
                    <h2>REPLAY SELECT</h2>
                    <div class="replay-list">${listHtml}</div>
                    <button class="modal-close-btn">CLOSE</button>
                </div>
            `;
        }

        this.modalEl.style.display = 'flex';

        // 閉じるイベント
        const closeBtn = this.modalEl.querySelector<HTMLButtonElement>('.modal-close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                this.closeModal();
            };
        }

        // 各再生ボタンイベント
        const playButtons = this.modalEl.querySelectorAll<HTMLButtonElement>('.btn-play-replay');
        playButtons.forEach((btn) => {
            btn.onclick = (e: MouseEvent) => {
                const target = e.currentTarget as HTMLButtonElement | null;
                const id = target?.getAttribute('data-id');
                if (!id) return;

                const replayData = ReplayStorage.getById(id);
                if (replayData) {
                    this.closeModal();
                    this.startReplayPlayback(replayData);
                }
            };
        });
    }

    /** モーダルを閉じる */
    public closeModal(): void {
        if (this.modalEl) {
            this.modalEl.style.display = 'none';
        }
        this.sc.startIdleTimer();
    }

    /** リプレイ再生の実行 */
    public startReplayPlayback(replayData: ReplayRecord): void {
        if (this.sc.game) {
            this.sc.game.destroy();
            this.sc.game = null;
        }

        // Start画面を非表示にする
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.style.display = 'none';

        // Gameを生成してリプレイ再生スタート
        this.sc.game = new Game(this.sc);
        this.sc.game.startReplay(replayData, replayData.stage);
    }
}