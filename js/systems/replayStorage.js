/* replayStorage.js */

const REPLAY_KEY_PREFIX = 'vc_replay_';
const MAX_REPLAYS = 5; // 保存する最大リプレイ数（古いやつから自動削除）

export class ReplayStorage {
    /**
     * リプレイデータを保存
     * @param {Object} replayData ReplayManager.getReplayData() の戻り値
     */
    static save(replayData) {
        try {
            const list = this.getList();
            const timestamp = Date.now();
            const id = `replay_${timestamp}`;
            
            const record = {
                id,
                timestamp,
                dateStr: new Date(timestamp).toLocaleString('ja-JP'),
                stage: replayData.stage || 1,
                score: replayData.score || 0,
                seed: replayData.seed,
                log: replayData.log
            };

            list.unshift(record);

            // 最大保存数を超えたら古いものを削除
            if (list.length > MAX_REPLAYS) {
                list.splice(MAX_REPLAYS);
            }

            localStorage.setItem(`${REPLAY_KEY_PREFIX}list`, JSON.stringify(list));
            console.log(`[ReplayStorage] Saved: ${id}`);
            return id;
        } catch (e) {
            console.error('[ReplayStorage] Failed to save replay:', e);
            return null;
        }
    }

    /** 保存済みリプレイ一覧を取得 */
    static getList() {
        try {
            const data = localStorage.getItem(`${REPLAY_KEY_PREFIX}list`);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('[ReplayStorage] Failed to load replay list:', e);
            return [];
        }
    }

    /** IDを指定してリプレイデータを取得 */
    static getById(id) {
        const list = this.getList();
        return list.find(item => item.id === id) || null;
    }

    /** リプレイを個別削除 */
    static delete(id) {
        let list = this.getList();
        list = list.filter(item => item.id !== id);
        localStorage.setItem(`${REPLAY_KEY_PREFIX}list`, JSON.stringify(list));
    }
}