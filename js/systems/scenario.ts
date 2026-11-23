/*
 * PROJECT: VOID-CIRCUIT
 *
 * systems/scenario.ts - シナリオ管理
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import jsyaml from 'js-yaml';
import {
    createEnemyInstance,
    Enemy,
    type EnemyGameContext,
    type EnemySpawnData
} from '../entities/enemy.js';
import { WarningEffect } from '../entities/effects.js';
import type { AudioManager } from './audio.js';
import type { Random } from './random.js';

export type SpawnDirection = 'top' | 'bottom' | 'left' | 'right';

/** YAML内の1イベントデータ構造 */
export interface ScenarioEvent {
    frame: number;
    type: string;
    from?: SpawnDirection | string;
    dir?: string;
    x?: number;
    y?: number;
    hp?: number;
    bulletType?: string;
    timeLimit?: number;
    timeMultiplier?: number;
    returnTo?: number;
    spawned?: boolean;
    [key: string]: unknown;
}

/** YAMLファイル全体のルート構造 */
export interface ScenarioYAML {
    version?: string | number;
    name?: string;
    bgm?: string;
    kv?: string | { path?: string } | null;
    preloadAssets?: string[];
    scenario?: ScenarioEvent[];
}

export interface StageMeta {
    stageNum: number;
    name: string;
    bgm: string;
}

export interface DifficultyParams {
    fireRate?: number;
    bulletSpeed?: number;
    wayBonus?: number;
}

/** 外部マネージャーとの最小接続インターフェース（未移行 .js 互換用） */
export interface AssetManagerLike {
    preload(images: string[], stagePath?: string): Promise<unknown>;
}

export interface GameLike extends EnemyGameContext {
    isEnding?: boolean;
    isCleared?: boolean;
    currentStageNum?: number;
    startBossBattle?: () => void;
}

/**
 * ScenarioManager 敵キャラシナリオ管理
 */
export class ScenarioManager {
    public readonly REQUIRED_VERSION: number = 0.4;

    private _scenario: ScenarioEvent[] = [];
    public stageName: string = "";
    public bgm: string = "";
    public kv: string | { path?: string } | null = "";
    public preloadAssets: string[] = [];

    public currentIndex: number = 0;
    public currentScenarioFrame: number = 0;
    public isFinished: boolean = false;

    public fireRateMultiplier: number = 1.0;
    public bulletSpeedMultiplier: number = 1.0;
    public wayBonus: number = 0;

    public version: string = "0.0";
    public lastError: string | null = null;

    constructor() {
        this.reset();
    }

    public get length(): number {
        return this._scenario.length;
    }

    /** リセット */
    public reset(): void {
        this._scenario = [];
        this.stageName = "";
        this.bgm = "";
        this.kv = "";
        this.preloadAssets = [];

        this.currentIndex = 0;
        this.currentScenarioFrame = 0;
        this.isFinished = false;

        this.fireRateMultiplier = 1.0;
        this.bulletSpeedMultiplier = 1.0;
        this.wayBonus = 0;

        this.version = "0.0";
        this.lastError = null;
    }

    /** YAMLシナリオファイルをロード */
    public async loadScenario(path: string): Promise<boolean> {
        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

            // YAML形式でロード
            const yamlText = await res.text();
            const data = jsyaml.load(yamlText) as ScenarioYAML | null | undefined;
            if (!data || typeof data !== 'object') {
                throw new Error("YAML parse failed or empty.");
            }

            // バージョンチェック
            const parsedVersion = data.version !== undefined ? String(data.version) : "0.1";
            if (parseFloat(parsedVersion) < this.REQUIRED_VERSION) {
                console.warn(`[Warning] Scenario v${parsedVersion} is outdated.`);
            }

            this.reset();
            this.version = parsedVersion;

            // メタデータの抽出
            this.stageName = data.name || "Unknown Stage";
            this.bgm = data.bgm || "";
            this.kv = data.kv || null;
            this.preloadAssets = Array.isArray(data.preloadAssets) ? data.preloadAssets : [];

            // 敵データの抽出とソート
            const rawScenario = Array.isArray(data.scenario) ? data.scenario : [];
            const sortedScenario = [...rawScenario].sort((a, b) => (a.frame || 0) - (b.frame || 0));

            // 🛡️ 事前バリデーション＆データ正規化の実行
            this._scenario = this._validateScenarioData(sortedScenario);

            console.log(`[System] YAML Scenario "${path}" loaded. (${this._scenario.length} events validated)`);
            return true;
        } catch (e) {
            console.error("[System] Scenario Load Failed:", e);
            return false;
        }
    }

    /**
     * 🛡️ ロード時の事前バリデーション・データ正規化処理
     * 全イベントを走査し、不正パラメータの検知・警告・自動補正を行います。
     */
    private _validateScenarioData(scenarioArray: ScenarioEvent[]): ScenarioEvent[] {
        const validatedList: ScenarioEvent[] = [];
        const validFroms: SpawnDirection[] = ['top', 'bottom', 'left', 'right'];

        for (let i = 0; i < scenarioArray.length; i++) {
            const data = scenarioArray[i];

            if (!data || typeof data !== 'object') {
                console.warn(`[Scenario Validation] Index ${i}: 無効なデータオブジェクトをスキップします。`, data);
                continue;
            }

            // 特殊コマンド (LOOP_END等) はチェックをパスしてそのまま追加
            if (data.type === 'LOOP_END' || data.type === 'BOSS_TRIGGER') {
                validatedList.push(data);
                continue;
            }

            // 1. type チェック
            if (!data.type) {
                console.error(`[Scenario Validation Error] Index ${i}: enemy type が指定されていません。スキップします。`, data);
                continue;
            }

            // 2. from / dir の許容値チェックと正規化
            const rawFrom = data.from || data.dir;
            let from: SpawnDirection = 'top';

            if (rawFrom) {
                const lowerFrom = String(rawFrom).toLowerCase() as SpawnDirection;
                if (validFroms.includes(lowerFrom)) {
                    from = lowerFrom;
                } else {
                    console.warn(`[Scenario Validation Warning] Index ${i}: 不正な from/dir 指定 "${rawFrom}". デフォルト "top" を割り当てます。`, data);
                }
            }
            data.from = from;

            // 3. 数値型パラメータの事前修正
            if (data.x !== undefined && (typeof data.x !== 'number' || Number.isNaN(data.x))) {
                console.warn(`[Scenario Validation Warning] Index ${i}: x 座標が不正な数値です (${data.x})。自動処理対象にします。`, data);
                delete data.x;
            }
            if (data.y !== undefined && (typeof data.y !== 'number' || Number.isNaN(data.y))) {
                console.warn(`[Scenario Validation Warning] Index ${i}: y 座標が不正な数値です (${data.y})。自動処理対象にします。`, data);
                delete data.y;
            }

            // 4. 矛盾パラメータの警告
            if ((from === 'top' || from === 'bottom') && data.y !== undefined) {
                console.warn(`[Scenario Validation Warning] Index ${i}: from "${from}" ですが y 座標 (${data.y}) が指定されています。from 優先で処理されます。`, data);
            }
            if ((from === 'left' || from === 'right') && data.x !== undefined) {
                console.warn(`[Scenario Validation Warning] Index ${i}: from "${from}" ですが x 座標 (${data.x}) が指定されています。from 優先で処理されます。`, data);
            }

            // 5. HP & 弾丸タイプの補正
            data.hp = (typeof data.hp === 'number' && data.hp > 0) ? data.hp : 1;
            data.bulletType = data.bulletType;

            // 6. ボスパラメータの事前補正
            if (data.type.includes('boss')) {
                const minTime = (data.hp / 2) * 8;
                if (!data.timeLimit || Number.isNaN(data.timeLimit)) {
                    data.timeLimit = Math.floor(minTime * 4) || 3600;
                }
                if (!data.timeMultiplier) {
                    data.timeMultiplier = Math.floor(data.hp * 3.33);
                }
            }

            validatedList.push(data);
        }

        return validatedList;
    }

    public async loadStageResources(
        stageNum: number,
        assetManager: AssetManagerLike,
        audioManager: AudioManager,
        assetBase: string
    ): Promise<boolean> {
        const stagePath = `stage-${stageNum}`;
        const fileName = `${stagePath}/scenario.yaml`;
        const scenarioPath = `${assetBase}${fileName}`;

        this.lastError = null;

        try {
            // 1. シナリオYAML自体のロード & 事前バリデーションの実行
            const loadSuccess = await this.loadScenario(scenarioPath);
            if (!loadSuccess) throw new Error(`Failed to load scenario file: "${fileName}"`);

            // 2. scenario配下から出現する敵の種類を自動スキャン
            const enemyData = this._scenario;
            const enemyTypes = enemyData
                .map(e => e.type)
                .filter(type => Boolean(type) && type !== 'LOOP_END' && type !== 'BOSS_TRIGGER');
            const uniqueTypes = [...new Set(enemyTypes)];

            // 敵の基本画像を配列化
            const imagesToPreload = uniqueTypes.map(type => `enemy_${type}.webp`);

            // 3. YAML直書きの固有追加アセットをマージ
            if (Array.isArray(this.preloadAssets)) {
                imagesToPreload.push(...this.preloadAssets);
            }

            // 4. キービジュアル画像の追加
            if (this.kv) {
                const kvPath = typeof this.kv === 'object' ? this.kv.path : this.kv;
                if (kvPath) imagesToPreload.push(kvPath);
            }

            // 5. AssetManager 一括プリロード
            const finalImages = [...new Set(imagesToPreload)];
            if (finalImages.length > 0) {
                try {
                    await assetManager.preload(finalImages, stagePath);
                } catch {
                    throw new Error(`Image asset preload failed. (Check files: ${finalImages.slice(0, 3).join(', ')}...)`);
                }
            }

            // 6. BGMロード
            if (this.bgm) {
                try {
                    await audioManager.loadStageBGM(this.bgm, stagePath);
                } catch {
                    throw new Error(`BGM load failed: "${this.bgm}"`);
                }
            }

            // 7. システムSEプリロード
            if (audioManager && typeof audioManager.preloadSE === 'function') {
                try {
                    await audioManager.preloadSE();
                } catch {
                    throw new Error(`SE preload failed. Check audio system.`);
                }
            }

            return true;
        } catch (error) {
            console.error(`[ScenarioManager] Failed to load resources for stage ${stageNum}:`, error);
            this.lastError = error instanceof Error ? error.message : String(error);
            return false;
        }
    }

    /** サウンドテスト用：メタデータ取得 */
    public async peekStageMeta(stageNum: number, assetBase: string): Promise<StageMeta | null> {
        const fileName = `stage-${stageNum}/scenario.yaml`;
        const scenarioPath = `${assetBase}${fileName}`;
        try {
            const res = await fetch(scenarioPath);
            if (!res.ok) return null;

            const yamlText = await res.text();
            const data = jsyaml.load(yamlText) as ScenarioYAML | null | undefined;
            if (!data || typeof data !== 'object') return null;

            return {
                stageNum,
                name: data.name || `STAGE ${stageNum}`,
                bgm: data.bgm || ""
            };
        } catch {
            console.warn(`[Scenario] Failed to peek meta for stage ${stageNum}`);
            return null;
        }
    }

    /** 難易度設定の適用 */
    public setDifficulty(params: DifficultyParams): void {
        this.fireRateMultiplier = params.fireRate || 1.0;
        this.bulletSpeedMultiplier = params.bulletSpeed || 1.0; // 弾速の倍率
        this.wayBonus = params.wayBonus || 0;                    // WAY数の加算値（例: EASY:-1, NORMAL:0, HARD:+1）
    }

    /** 更新 */
    public update(game: GameLike): void {
        if (this.isFinished || this._scenario.length === 0) return;

        this.currentScenarioFrame++;

        while (
            this.currentIndex < this._scenario.length &&
            this._scenario[this.currentIndex].frame <= this.currentScenarioFrame
        ) {
            const data = this._scenario[this.currentIndex];
            console.log(data);

            if (data.type === 'LOOP_END') {
                this.currentScenarioFrame = data.returnTo || 0;
                this.currentIndex = this._findStartIndexForFrame(this.currentScenarioFrame);
                console.log(`[System] Scenario looping back to frame: ${this.currentScenarioFrame}`);
                continue;
            }

            if (data.type === 'BOSS_TRIGGER') {
                const warning = new WarningEffect();
                game.entities.push(warning);
            } else {
                this.spawnEnemy(game, data);
            }
            this.currentIndex++;
        }

        if (this.currentIndex >= this._scenario.length) {
            this.isFinished = true;
        }
    }

    private _findStartIndexForFrame(targetFrame: number): number {
        let index = 0;
        while (index < this._scenario.length && this._scenario[index].frame < targetFrame) {
            index++;
        }
        return index;
    }

    public skipToAfterLoop(): void {
        for (let i = this.currentIndex; i < this._scenario.length; i++) {
            if (this._scenario[i].type === 'LOOP_END') {
                this.currentIndex = i + 1;
                this.currentScenarioFrame = this._scenario[i].frame;
                return;
            }
        }
    }

    /** 敵インスタンスの動的生成（軽量化済み） */
    public spawnEnemy(game: GameLike, data: ScenarioEvent): void {
        if (!data || data.spawned) return;

        const enemy = createEnemyInstance(
            game,
            data.type,
            data.bulletType,
            data.hp,
            data
        );

        if (!enemy) {
            console.error(`[SpawnEnemy Error] タイプ "${data.type}" のエネミー生成に失敗しました。`, data);
            return;
        }

        // 🎯 座標決定ロジック (事前バリデーション済みの from を使用)
        let posX: number;
        let posY: number;

        if (data.from === 'left') {
            posX = -enemy.width;
        } else if (data.from === 'right') {
            posX = game.width;
        } else if (data.x !== undefined && data.x !== null) {
            posX = data.x - enemy.width / 2;
        } else {
            posX = game.random.range(0, game.width - enemy.width);
        }

        if (data.from === 'bottom') {
            posY = game.height;
        } else if (data.from === 'top') {
            posY = -enemy.height;
        } else if (data.y !== undefined && data.y !== null) {
            posY = data.y - enemy.height / 2;
        } else {
            posY = (game.height - enemy.height) / 2;
        }

        // 🎯 決定した座標をセット＆初期位置（startX, startY）として記憶
        enemy.setStartPosition(posX, posY);

        // 🚨 ボスパラメータ処理
        if (data.type.includes('boss')) {
            game.startBossBattle?.();
            data.spawned = true;
        }

        enemy.fireRateMultiplier = this.fireRateMultiplier;
        enemy.bulletSpeedMultiplier = this.bulletSpeedMultiplier;
        enemy.wayBonus = this.wayBonus;

        game.stats.enemiesSpawned++;
        game.entities.push(enemy);
    }
}