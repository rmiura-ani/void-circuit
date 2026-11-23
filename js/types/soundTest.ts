/*
 * PROJECT: VOID-CIRCUIT
 *
 * types/soundTest.ts - サウンドテスト・音量・EQ・UI効果音関連の型定義
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

export interface BGMListItem {
    stagePath: string;
    fileName: string;
    displayName: string;
}

export interface EQSettings {
    low: number;
    mid: number;
    high: number;
}

export interface RoomPreset {
    reverbWet: number;
    echoWet: number;
}

export type SoundTestSettingKey =
    | 'se_vol'
    | 'bgm_vol'
    | 'sound'
    | 'bgm'
    | 'audio_room'
    | 'eq_low'
    | 'eq_mid'
    | 'eq_high';

export interface SoundTestAudioLike {
    seVolume?: number;
    bgmVolume?: number;
    seCount?: number;
    bgmCount?: number;
    roomPresetCount?: number;
    eqSettings?: EQSettings;
    ROOM_PRESETS?: Record<number, RoomPreset>;
    bgmNode?: { onended: (() => void) | null } | null;
    onBGMEnded?: (() => void) | null;
    setSEVolume?: (vol: number) => void;
    setBGMVolume?: (vol: number) => void;
    getSEName(index: number): string;
    getBGMName(index: number): string;
    getRoomPresetName?: (index: number) => string;
    loadStageBGM(fileName: string, stagePath: string): Promise<unknown>;
    setDynamicBGMList?: (list: BGMListItem[]) => void;
    playBGMByIndex?: (index: number) => void;
    playSEByIndex(index: number): void;
    playHitSound(): void;
    playExplosion(): void;
    playPowerUp(): void;
    setAudioRoomPreset(index: number): void;
    resetBGM(): void;
    setEQGain(band: keyof EQSettings, value: number): void;
    getByteFrequencyData?: () => Uint8Array | null;
}
