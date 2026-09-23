/**
 * 画面全体にWARNING警告演出を表示する演出専用エンティティ
 */
class WarningEffect extends Entity {
    /**
     * @param {Game} game 
     * @param {number} x 
     * @param {number} y 
     * @param {Object} data - YAMLからのパラメータ
     */
    constructor(game, x, y, data = {}) {
        // 1. 親クラス(Entity)のコンストラクタを呼び出し
        super(game, x, y);

        // 2. 演出用パラメータの設定
        this.duration = data.duration || 120; // デフォルト2秒 (120frame)
        this.frame = 0;

        // 3. Entityとしてのプロパティ設定・上書き
        this.width = game.width;
        this.height = game.height;
        this.active = true;
        this.hp = Infinity;       // 破壊不能
        
        // 当たり判定や撃破数等のカウント誤作動を防ぐフラグ
        this.isEnemy = false;     // 自機弾のヒットテスト対象外にする場合
        this.isBoss = false;      // ScenarioManagerのボス判定スルー用
    }

    update() {

        // 親クラスに共通処理があれば呼び出し
        if (super.update) super.update();

        this.frame++;

        // 指定時間を過ぎたら非アクティブ化（game.entities から自動削除される）
        if (this.frame >= this.duration) {
            this.active = false;
        }
    }

 draw(ctx, isInvincibleCheat = false) {
        if (!this.active) return;

        const width = GAME_CONFIG.WIDTH;
        const height = GAME_CONFIG.HEIGHT;
        const barHeight = 20; // 上下の警告バーの太さ

        ctx.save();

        // ----------------------------------------------------
        // 1. 上下のハザードバー（黄×黒の斜めストライプ）
        // ----------------------------------------------------
        const drawHazardBar = (y) => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, y, width, barHeight);
            ctx.clip(); // バーの範囲内に描画領域を制限

            // ベースの黄色背景
            ctx.fillStyle = "#ffd700";
            ctx.fillRect(0, y, width, barHeight);

            // 斜めの黒ストライプを描画
            ctx.fillStyle = "#000000";
            const stripeWidth = 15;
            // アニメーションさせたい場合は this.frame * 2 などを足すと流れます
            for (let x = -barHeight; x < width + barHeight; x += stripeWidth * 2) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + stripeWidth, y);
                ctx.lineTo(x + stripeWidth - barHeight, y + barHeight);
                ctx.lineTo(x - barHeight, y + barHeight);
                ctx.closePath();
                ctx.fill();
            }

            // 赤色の上下枠線で引き締める
            ctx.strokeStyle = "#ff0000";
            ctx.lineWidth = 2;
            ctx.strokeRect(0, y, width, barHeight);

            ctx.restore();
        };

        // 画面の最上部と最下部に描画
        drawHazardBar(0);
        drawHazardBar(height - barHeight);

        // ----------------------------------------------------
        // 2. 画面上部への WARNING テキスト表示
        // ----------------------------------------------------
        // 点滅アニメーション（12フレームごと）
        if (Math.floor(this.frame / 12) % 2 === 0) {
            ctx.fillStyle = "#ff2222";
            ctx.font = '16px "Press Start 2P", cursive';
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // ネオン風の発光効果
            ctx.shadowColor = "#ff0000";
            ctx.shadowBlur = 10;

            // 画面上部（Y = 45px 付近、UIやスコア表示と重ならない位置）
            ctx.fillText("WARNING", width / 2, 45);
        }

        ctx.restore();
    }
}