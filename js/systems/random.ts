/*
 * PROJECT: VOID-CIRCUIT
 *
 * random.ts - Deterministic PRNG for Replay Consistency
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

/**
 * 乱数ジェネレーター（リプレイ時に同じ乱数になるように）
 * 逆に Math.random() は本プロジェクトでは利用不可
 */
export class Random {
    public seed: number;

    constructor(seed: number = 12345) {
        this.seed = seed;
    }

    /** 0 以上 1 未満の疑似乱数を返却 */
    public next(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    /** 指定範囲のランダム実数を取得 */
    public range(min: number, max: number): number {
        return min + this.next() * (max - min);
    }

    /** 💡 追加: 0 ～ 2π (360度) の全方位ラジアン角を取得 */
    public angle(): number {
        return this.next() * Math.PI * 2;
    }

    /** 💡 追加: プラスマイナス（-spread/2 ～ +spread/2）のブレ幅を取得（弾の拡散・ブレ用） */
    public spread(value: number): number {
        return (this.next() - 0.5) * value;
    }

    /** 💡 追加: 配列からランダムに1要素を抽出 */
    public choice<T>(array: readonly T[]): T | undefined {
        if (array.length === 0) return undefined;
        return array[Math.floor(this.next() * array.length)];
    }
}