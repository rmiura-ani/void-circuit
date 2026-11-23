/*
 * PROJECT: VOID-CIRCUIT
 *
 * replayStorage.ts - LocalStorage Persistence for Replay Data
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import type { ReplayFrame } from './replayManager.js';

const REPLAY_KEY_PREFIX = 'vc_replay_';
const MAX_REPLAYS = 5; // 保存する最大リプレイ数（古いやつから自動削除）

/** ReplayManager.getReplayData() から渡される入力データの型 */
export interface ReplayInputData {
    stage?: number;
    score?: number;
    seed: number;
    log: ReplayFrame[];
}

/** LocalStorage に保存されるリプレイレコードの型 */
export interface ReplayRecord {
    id: string;
    timestamp: number;
    dateStr: string;
    stage: number;
    score: number;
    seed: number;
    log: ReplayFrame[];
}

export class ReplayStorage {
    /**
     * リプレイデータを保存
     * @param replayData ReplayManager.getReplayData() の戻り値
     */
    public static save(replayData: ReplayInputData): string | null {
        try {
            const list = this.getList();
            const timestamp = Date.now();
            const id = `replay_${timestamp}`;

            const record: ReplayRecord = {
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
    public static getList(): ReplayRecord[] {
        try {
            const data = localStorage.getItem(`${REPLAY_KEY_PREFIX}list`);
            return data ? (JSON.parse(data) as ReplayRecord[]) : [];
        } catch (e) {
            console.error('[ReplayStorage] Failed to load replay list:', e);
            return [];
        }
    }

    /** IDを指定してリプレイデータを取得 */
    public static getById(id: string): ReplayRecord | null {
        const list = this.getList();
        return list.find(item => item.id === id) || null;
    }

    /** リプレイを個別削除 */
    public static delete(id: string): void {
        let list = this.getList();
        list = list.filter(item => item.id !== id);
        localStorage.setItem(`${REPLAY_KEY_PREFIX}list`, JSON.stringify(list));
    }
}