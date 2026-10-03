/*
 * PROJECT: VOID-CIRCUIT
 *
 * random.js - Unified Input Management
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

/**
 * 乱数ジェネレーター（リプレイ時に同じ乱数になるように）
 * 逆に Math.random() は📚プロジェクトでは利用不可
 */
export class Random {
    constructor(seed = 12345) {
        this.seed = seed;
    }

    /** 0 以上 1 未満の疑似乱数を返却 */
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    /** 指定範囲のランダム実数を取得 */
    range(min, max) {
        return min + this.next() * (max - min);
    }

    /** 💡 追加: 0 ～ 2π (360度) の全方位ラジアン角を取得 */
    angle() {
        return this.next() * Math.PI * 2;
    }

    /** 💡 追加: プラスマイナス（-spread/2 ～ +spread/2）のブレ幅を取得（弾の拡散・ブレ用） */
    spread(value) {
        return (this.next() - 0.5) * value;
    }

    /** 💡 追加: 配列からランダムに1要素を抽出 */
    choice(array) {
        return array[Math.floor(this.next() * array.length)];
    }
}