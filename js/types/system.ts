/*
 * PROJECT: VOID-CIRCUIT
 *
 * types/system.ts - システム制御・画面遷移・リプレイ関連の型・契約インターフェース定義
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

export type ControlInputType = 'MOUSE' | 'KEYBOARD';

/** Game インスタンスの契約インターフェース */
export interface GameInstanceLike {
    isRunning: boolean;
    score: number;
    gameOverTimer: number;
    player?: {
        alive: boolean;
    } | null;
    stats: {
        enemiesSpawned: number;
        enemiesKilled: number;
        shotsFired: number;
        shotsHit: number;
        inputMode?: string;
    };
    missionConfig: {
        missionName: string;
        difficulty: string;
        extend: string;
        lives: number;
        cheatUsed: boolean;
    };
    start(inputType: ControlInputType, stage?: number): void;
    startReplay(replayData: any, stage: number): void;
    update(): void;
    draw(): void;
    destroy(): void;
}

/** ReplayUIManager の契約インターフェース */
export interface ReplayUIManagerLike {
    setupUI(): void;
}