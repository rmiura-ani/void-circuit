/*
 * PROJECT: VOID-CIRCUIT
 *
 * types/config.ts - BIOS風設定画面の契約インターフェース・ゲーム設定型定義
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import type { DifficultyLevel, ExtendOption, LivesOption } from '../config/config.js';
import type { SoundTestAudioLike } from './soundTest.js';

export type { DifficultyLevel, ExtendOption, LivesOption };

export interface ConfigAudioLike {
    playHitSound(): void;
    playExplosion(): void;
    playPowerUp(): void;
}

export interface ConfigControllerLike {
    assetBase?: string;
    audio?: (ConfigAudioLike & SoundTestAudioLike) | null;
    input?: {
        clearTriggers(): void;
    };
    resetHighScore(): void;
    visualEffectWarning?: () => void;
}

export interface ConfigManagerLike {
    isMode: boolean;
    lives: LivesOption;
    difficulty: DifficultyLevel;
    extend: ExtendOption;
    isInvincibleCheat: boolean;
    loadConfig(): void;
    open(): void;
    handleInput(e: KeyboardEvent): void;
}