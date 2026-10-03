/* systems/replay-ui.js */
import { ReplayStorage } from './replayStorage.js';
import { Game } from '../game.js';

export class ReplayUIManager {
    /**
     * @param {SystemController} controller 
     */
    constructor(controller) {
        this.sc = controller;
        this.modalEl = null;
    }

    /** UIボタン・モーダルの初期セットアップ */
    setupUI() {
        const startScreenNode = document.getElementById('start-screen');
        if (!startScreenNode) return;

        // タイトル画面に「REPLAY」ボタンを設置（未配置の場合のみ）
        let replayBtn = document.getElementById('config-replay-btn');
        if (!replayBtn) {
            replayBtn = document.createElement('button');
            replayBtn.id = 'config-replay-btn';
            replayBtn.className = 'menu-btn';
            replayBtn.innerText = 'REPLAY';
            // Start画面のUIグループに追加
            startScreenNode.appendChild(replayBtn);
        }

        replayBtn.onclick = (e) => {
            e.stopPropagation();
            this.sc.stopIdleTimer(); // タイトル放置タイマー停止
            this.openModal();
        };
    }

    /** リプレイ選択モーダルを開く */
    openModal() {
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
            const listHtml = replays.map(r => `
                <div class="replay-item">
                    <div class="replay-info">
                        <span class="replay-date">${r.dateStr}</span>
                        <span class="replay-score">SCORE: ${r.score.toLocaleString()} (ST${r.stage})</span>
                    </div>
                    <button class="btn-play-replay" data-id="${r.id}">PLAY</button>
                </div>
            `).join('');

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
        this.modalEl.querySelector('.modal-close-btn').onclick = () => {
            this.closeModal();
        };

        // 各再生ボタンイベント
        const playButtons = this.modalEl.querySelectorAll('.btn-play-replay');
        playButtons.forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.getAttribute('data-id');
                const replayData = ReplayStorage.getById(id);

                if (replayData) {
                    this.closeModal();
                    this.startReplayPlayback(replayData);
                }
            };
        });
    }

    /** モーダルを閉じる */
    closeModal() {
        if (this.modalEl) {
            this.modalEl.style.display = 'none';
        }
        this.sc.startIdleTimer();
    }

    /** リプレイ再生の実行 */
    startReplayPlayback(replayData) {
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