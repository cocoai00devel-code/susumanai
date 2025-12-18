/* --------------------------------------------------------------------------------- */
/* 1. Canvasアニメーションとレスポンシブ対応                                          */
/* --------------------------------------------------------------------------------- */

const canvas = document.getElementById("waveCanvas");
const ctx = canvas.getContext("2d");

// Canvasの初期サイズ設定は、resizeCanvas関数で処理するため、ここでは変数宣言に留める
let bars = [];
const BAR_COUNT = 40; 
const BAR_WIDTH = 8;
let dataArray;

let animationFrameId;
let isSpeaking = false;
let isRecording = false;
let currentWaveColor = 'rgba(50, 200, 255, 0.7)'; // 初期色を定義
let rainbowHue = 0; // レインボーアニメーション用の色相を保持

let animationFrameId;
let isSpeaking = false;    // ★ TTS (AI応答) のアクティブ状態
let isRecording = false;   // ★ STT (ユーザー入力) のアクティブ状態
let isWaveActive = false;  // ★ 波形アニメーションを実行するかどうかを制御するフラグ (新設)


// WAVE_COLORSとは別に、ステータスアニメーション用の色の配列を定義
// 順番: 緑 → 黄緑 → オレンジ → 赤 → 紫 → 濃い青 → 水色 → 黄色
const STATUS_TRANSITION_COLORS = [
    '#32CD32', // 緑 (LimeGreen)
    '#ADFF2F', // 黄緑 (GreenYellow)
    '#FFA500', // オレンジ (Orange)
    '#FF4500', // 赤 (OrangeRed)
    '#8A2BE2', // 紫 (BlueViolet)
    '#00008B', // 濃い青 (DarkBlue)
    '#00FFFF', // 水色 (Aqua)
    '#FFFF00'  // 黄色 (Yellow)
];

let transitionFrameId; // アニメーションループ用のID

/**
 * 複数の色を順番に滑らかに遷移させるアニメーション関数
 * @param {string[]} colors 遷移させる色のHEXコード配列
 * @param {number} segmentDuration 各色セグメントの遷移にかける時間 (ms)
 */
function startSequentialColorTransition(colors, segmentDuration = 700) {
    if (transitionFrameId) {
        cancelAnimationFrame(transitionFrameId);
    }
    
    const startTime = performance.now();
    const numSegments = colors.length;

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        
        // 現在のアニメーションの全体的な進捗度を計算
        const totalDuration = numSegments * segmentDuration;
        const progress = (elapsed % totalDuration) / totalDuration; // 0から1を周期的に繰り返す

        // 現在のセグメントインデックスを決定
        const currentSegmentIndex = Math.floor(progress * numSegments);
        const nextSegmentIndex = (currentSegmentIndex + 1) % numSegments;

        // 現在のセグメント内での進捗度を計算 (0から1)
        const segmentProgress = (elapsed % segmentDuration) / segmentDuration;

        const startHex = colors[currentSegmentIndex];
        const endHex = colors[nextSegmentIndex];

        const startRgb = hexToRgb(startHex);
        const endRgb = hexToRgb(endHex);

        // 補間計算
        const r = startRgb[0] + (endRgb[0] - startRgb[0]) * segmentProgress;
        const g = startRgb[1] + (endRgb[1] - startRgb[1]) * segmentProgress;
        const b = startRgb[2] + (endRgb[2] - startRgb[2]) * segmentProgress;

        const currentColor = rgbToHex(r, g, b);

        // UIへの適用 (ステータスエリアの文字色とシャドウ色)
        statusArea.style.color = currentColor;
        statusArea.style.boxShadow = `0 0 20px ${currentColor}80`;

        transitionFrameId = requestAnimationFrame(animate);
    }
    
    animate(startTime);
}

/**
 * 連続色遷移アニメーションを停止する関数
 */
function stopSequentialColorTransition() {
    if (transitionFrameId) {
        cancelAnimationFrame(transitionFrameId);
        transitionFrameId = null;
    }
}

// 【色の定義】感情に応じた色と、レインボーアニメーション用の色相変数
const WAVE_COLORS = {
    // デフォルト: 水色 (待機状態)
    default: 'rgba(50, 200, 255, 0.7)', 
    // ポジティブな回答: 緑
    positive: 'rgba(50, 255, 50, 0.7)', 
    // お怒り: 赤
    anger: 'rgba(255, 50, 50, 0.7)', 
    // 本気の怒り/裏切り: 紫
    rage: 'rgba(150, 50, 255, 0.7)', 
    // ネガティブ (一般的): 明るめのブルー
    negative: 'rgba(50, 100, 255, 0.7)', 
    // 悲しい/号泣: 濃いブルー
    sadness: 'rgba(0, 0, 150, 0.7)'
};

// 現在の波形の色を保持する変数 (デフォルトは水色)
let currentWaveColor = WAVE_COLORS.default; 
// レインボーアニメーション用の色相を保持する変数 (0〜360度)
let rainbowHue = 0;

/**
 * バーのデータを再計算する
 */
function createBars() {
    bars = [];
    // 中央揃えでバーを配置
    const startX = canvas.width / 2 - (BAR_COUNT * BAR_WIDTH) / 2;
    for (let i = 0; i < BAR_COUNT; i++) {
        bars.push({
            x: startX + i * BAR_WIDTH,
            height: 10,
            // colorプロパティはanimateBars内で動的に上書きされるため、初期値は機能に影響しない
            color: "#00ffff" 
        });
    }
}

/**
 * Canvasサイズをウィンドウにフィットさせ、バーを再計算する
 */
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // サイズ変更時にバーを再計算
    createBars();
}

/**
 * バーをアニメーションさせて描画する (色変更ロジック統合済)
 */

/**
 * バーをアニメーションさせて描画する (drawWaveとdrawBarsのロジックを統合)
 */
function animateBars() {
    // Canvasをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // analyserが存在し、音声入力があれば周波数データを取得
    if (analyser && dataArray && (isSpeaking || isRecording)) {
        analyser.getByteFrequencyData(dataArray);
    }

    // 描画色を決定するロジック
    let barColor = currentWaveColor;

    // レインボーモードの場合、動的に色を計算
    if (currentWaveColor === 'rainbow') {
        rainbowHue = (rainbowHue + 3) % 360;
        barColor = `hsla(${rainbowHue}, 100%, 70%, 0.9)`;
    }

    // 決定した色を塗りつぶし色として設定
    ctx.fillStyle = barColor;
    const currentWaveY = canvas.height / 2;

    bars.forEach((bar, i) => {
        let height = bar.height;

        // 音声入力中またはAI応答中の場合、波形を動かす
        if (isRecording && dataArray) {
            // 周波数データを単純にマッピング
            const dataIndex = Math.floor(i * (dataArray.length / BAR_COUNT));
            const rawHeight = dataArray[dataIndex] || 0;
            // 0-255を最大高さ（例: 200）にスケール
            height = (rawHeight / 255) * 200 + 5; 
        } else if (isSpeaking) {
            // AI応答中は、シンプルなサイン波で波形を動かす
            const waveAmplitude = 100;
            const waveFrequency = 0.05;
            const waveOffset = Math.sin(Date.now() * 0.005 + i * waveFrequency) * waveAmplitude;
            height = 10 + Math.abs(waveOffset);
        } else {
            // 待機中は最小の高さ
            height = 10;
        }

        // バーの高さと位置を更新
        bars[i].height = height;

        // 描画
        // barWidthは定数、BAR_WIDTHも定数。一貫性のためにBAR_WIDTHを使用
        ctx.fillRect(bar.x, currentWaveY - height / 2, BAR_WIDTH - 2, height);
    });

    animationFrameId = requestAnimationFrame(animateBars);
// function animateBars() {
    
//     // Canvasをクリア
//     ctx.clearRect(0, 0, canvas.width, canvas.height);

//     // isWaveActive フラグで描画が必要か判断
//     // isWaveActive = isSpeaking || isRecording; 
//     if (analyser && dataArray && isRecording) {
//         // 録音中のみ周波数データを取得
//         analyser.getByteFrequencyData(dataArray);
//     } 
// 　　let barColor = currentWaveColor; // ★★★ 修正箇所: 初期化する ★★★
//     // analyserが存在し、波形がアクティブであれば周波数データを取得
    
// // AI応答中、またはカスタムカラーが設定されている場合の色の動的変更ロジック
//     // 'rainbow' が設定されている場合のみ色相を動的に変える。
//     if (isSpeaking && currentWaveColor === 'rainbow') { 
//         // 速度調整
//         // 速度調整 (値を小さくするとゆっくり、大きくすると速くなります)
//         // 【修正後】: 正しい三項演算子
//         const cycleSpeed = currentWaveColor === 'rainbow' ? 3 : 1;// const cycleSpeed = 3 : 1; // 'rainbow'は速く、'custom_cycle'はゆっくり
        
//         // 色相を更新 (0〜360度)
//         rainbowHue = (rainbowHue + cycleSpeed) % 360;
        
//         // // 緑 (120) から始まり、黄色 (60) を経由して赤 (0/360) に向かうサイクルを作成
//         // // 応答のポジティブなイメージを保つため、赤や紫の領域は狭くし、緑と黄色を強調します。
        
//         // // 1. 緑 (120) から黄緑 (80) に向かう
//         // if (rainbowHue >= 80 && rainbowHue <= 120) {
//         //      // 120 (緑) -> 80 (黄緑) -> 120 (緑)
//         //      // 120 - (120-80) * f(t) のような変化
//         //      // 複雑なため、単純に 360度をベースにしたカラーサイクルの範囲を制限します
//         // }
        
//         // // 以下の設定で、緑(120) → 黄色(60) → 赤(0) → 紫(300) → 青(240) → 水色(180) → 緑(120) のサイクルを滑らかに表現します。
//         // // ご要望の色順（緑→黄緑→オレンジ→赤→紫→濃い青→水色→黄色）を色相環で表現するのは難しいため、
//         // // 以下のHSL標準サイクルを基本とし、速度で調整します。
        
//         // // HSLカラーサイクルで色相を動的に設定
//         barColor = `hsla(${rainbowHue}, 100%, 70%, 0.9)`;
//     }
     
    
    

//     // 描画色を決定するロジック
//  // 描画色を決定するロジック

//     // // レインボーモードの場合、動的に色を計算
//     // if (currentWaveColor === 'rainbow') {
//     //     rainbowHue = (rainbowHue + 3) % 360;
//     //     barColor = `hsla(${rainbowHue}, 100%, 70%, 0.9)`;
//     // }

//     // 決定した色を塗りつぶし色として設定 (バーの色が感情に連動)
//     ctx.fillStyle = barColor; 
//     const currentWaveY = canvas.height / 2;

//     bars.forEach((bar, i) => {
//         let height = bar.height;

//         // 波形がアクティブな場合のみ動かす
//         if (isWaveActive) {
//             if (isRecording && dataArray) {
//                 // 音声入力中: 周波数データを単純にマッピング
//                 const dataIndex = Math.floor(i * (dataArray.length / BAR_COUNT));
//                 const rawHeight = dataArray[dataIndex] || 0;
//                 // 0-255を最大高さ（例: 200）にスケール
//                 height = (rawHeight / 255) * 200 + 5; 
//             } else if (isSpeaking) {
//                 // AI応答中 (TTS): シンプルなサイン波で波形を動かす
//                 const waveAmplitude = 100;
//                 const waveFrequency = 0.05;
//                 const waveOffset = Math.sin(Date.now() * 0.005 + i * waveFrequency) * waveAmplitude;
//                 height = 10 + Math.abs(waveOffset);
//             } else {
//                 // 待機中だが波形アニメーションが動いている状態 (TTSプレビューなど)
//                  const waveAmplitude = 20;
//                  const waveFrequency = 0.1;
//             //      const waveAmplitude = 100;
//             // const waveFrequency = 0.05;
//                  const waveOffset = Math.sin(Date.now() * 0.01 + i * waveFrequency) * waveAmplitude;
//                  height = 10 + Math.abs(waveOffset);
//             }
//         } else {
//             // 完全に待機中は最小の高さ
//             height = 10;
//         }

//         // バーの高さと位置を更新
//         bars[i].height = height;

//         // 描画
//         ctx.fillRect(bar.x, currentWaveY - height / 2, BAR_WIDTH - 2, height);
//     });

//     animationFrameId = requestAnimationFrame(animateBars);
// }


// 【★ 修正点1: window.addEventListenerの重複を解消し、一つに統合 ★】
window.addEventListener("load", () => {
    resizeCanvas();
    animateBars();
    initAudioAndSTT(); // マイク初期化とSTTを自動で開始
    setStandbyStatus();
    document.getElementById('ui').style.opacity = 1;
});
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => {
    // 回転後の値が安定してから再計算
    setTimeout(resizeCanvas, 300);
});

/* --------------------------------------------------------------------------------- */
/* 2. 感情・色判定ロジック                                                           */
/* --------------------------------------------------------------------------------- */

/**
 * AIの回答テキストに基づいて波形の色を変更する関数
 * @param {string} responseText LLMからの回答テキスト
 */
function setWaveColorBasedOnResponse(responseText) {
    const text = responseText.toLowerCase();

    // 絵文字抽出関数（ローカルまたはグローバルで定義されている前提）
    const extractEmojis = (t) => {
        const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\p{Emoji_Modifier}*|\p{Emoji_Component}|\u200d/gu;
        const matches = t.match(emojiRegex);
        return matches ? matches.join('') : '';
    };

    // 1. 【本気の怒り・裏切り (紫)】：最も深刻なキーワードを優先
    const rageKeywords = ['裏切り', '許さない', '報復', 'どうしてくれる', '絶交', '失望'];
    const rageEmojis = ['😡', '😠', '🤬', '👿', '😾', '💀', '🔪', '💣']; 
    if (rageKeywords.some(k => text.includes(k)) || rageEmojis.some(e => text.includes(e))) {
        currentWaveColor = WAVE_COLORS.rage; 
        console.log("波形の色を【本気の怒り・裏切り】の紫に変更しました。");
        return;
    }

    // 2. 【お怒り (赤)】：強い否定や感情的な表現
    const angerKeywords = ['怒り', 'ふざけるな', 'やめろ', 'だめだ', '不可能だ', '違います', '否定', 'ありえない'];
    const angerEmojis = ['😤', '💢', '🔥', '💥', '👹', '😫', '😩']; 
    if (angerKeywords.some(k => text.includes(k)) || angerEmojis.some(e => text.includes(e))) {
        currentWaveColor = WAVE_COLORS.anger; 
        console.log("波形の色を【お怒り】の赤に変更しました。");
        return;
    }

    // 3. 【悲しい・号泣 (濃いブルー)】：深い悲しみや謝罪
    const sadnessKeywords = ['悲しい', '泣く', 'ごめんなさい', 'つらい', '寂しい', '涙', '耐えられない', '最悪', 'しんどい', '大変お詫び申し上げます', '大変申し訳ございませんでした', '誠に申し訳ございませんでした', '本当にごめんなさい','心からお詫び申し上げます','心よりお悔やみ申し上げます','お悔やみ申し上げます','お悔やみ申し上げます','お詫び申し上げます'];
    const sadnessEmojis = ['😭', '😢', '🥺', '💧', '😥', '💔', '🌧️', '☔','🙇']; 
    if (sadnessKeywords.some(k => text.includes(k)) || sadnessEmojis.some(e => text.includes(e))) {
        currentWaveColor = WAVE_COLORS.sadness; 
        console.log("波形の色を【悲しい・号泣】の濃いブルーに変更しました。");
        return;
    }

    // 4. 【ネガティブ (ブルー)】：一般的な懸念、問題、エラー
    const negativeKeywords = ['エラー', '失敗', 'できません', '警告', '問題', '懸念', '不明', '確認', '無理', '難しい', 'すみません', 'すみませんでした', 'すみませんできないです', 'すみません出来かねます','ごめん','ごめんね', 'できません', '出来ませんでした', '出来かねます', 'ごめんなさい','すいません','申し訳ございません','申し訳ございませんでした'];
    const negativeEmojis = ['😞', '😟', '😨', '🥶', '😰', '😵','m(__)m','(m´・ω・｀)m ｺﾞﾒﾝ…','🙏']; 
    if (negativeKeywords.some(k => text.includes(k)) || negativeEmojis.some(e => text.includes(e))) {
        currentWaveColor = WAVE_COLORS.negative; 
        console.log("波形の色を【ネガティブ】のブルーに変更しました。");
        return;
    }
    
    // 5. 【最高にハッピー (レインボー)】：新しい判定ロジック
    const superHappyKeywords = ['最高にハッピー', '神', '究極', 'パーフェクト', '完璧', '奇跡', '感無量', 'レジェンド'];
    const superHappyEmojis = ['🤩', '✨', '🥳', '💯', '👑', '🥇', '🚀', '🌈', '🎉🎉🎉']; 
    if (superHappyKeywords.some(k => text.includes(k)) || superHappyEmojis.some(e => text.includes(e))) {
        currentWaveColor = 'rainbow'; // 描画関数が処理する特別な値
        console.log("波形の色を【最高にハッピー】のレインボーに変更しました。");
        return;
    }

    // 6. 【ポジティブ (緑)】：一般的な肯定的 
    const positiveKeywords = ['ありがとう', '成功', '完了', '問題ありません', '良い', 'できます', '素晴らしい', '助かる', '了解', 'OK', 'ハッピー'];
    const positiveEmojis = ['😄', '😊', '😆', '👍', '👏', '✅', '🌟'];
    if (positiveKeywords.some(k => text.includes(k)) || positiveEmojis.some(e => text.includes(e))) {
        currentWaveColor = WAVE_COLORS.positive; 
        console.log("波形の色を【ポジティブ】の緑に変更しました。");
        return;
    }

    // どの条件にも合致しない場合はデフォルト色に戻す
    currentWaveColor = WAVE_COLORS.default; 
    console.log("波形の色をデフォルトの水色に戻しました。");
}

/* --------------------------------------------------------------------------------- */
/* 3. 機密保持/開発者ツールの無効化                                                */
/* --------------------------------------------------------------------------------- */

// 1. 右クリック（コンテキストメニュー）を禁止する
document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    console.log("右クリックは禁止されています。");
    return false;
});
document.body.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
});

// 2. キーボードショートカットを禁止する
document.onkeydown = function (e) {
    const key = e.key;
    const lowerKey = key.toLowerCase();

    // F12キー (開発者ツール)
    if (key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        return false;
    }

    // Ctrl/Cmd/Option/Alt キー状態のチェックを容易にする
    const isCmdOrCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const isAltOrOption = e.altKey;

    // 開発者ツールのショートカット (I, J, C)
    if (
        (isCmdOrCtrl && isShift && (lowerKey === 'i' || lowerKey === 'j' || lowerKey === 'c')) || // Ctrl/Cmd + Shift + I/J/C
        (e.metaKey && isAltOrOption && (lowerKey === 'i' || lowerKey === 'j' || lowerKey === 'c')) // Cmd + Option + I/J/C (macOS)
    ) {
        e.preventDefault();
        return false;
    }

    // その他、コンテンツ保護のためのショートカット (U, S, P)
    if (isCmdOrCtrl && (lowerKey === 'u' || lowerKey === 's' || lowerKey === 'p')) {
        e.preventDefault();
        return false;
    }
};

/* --------------------------------------------------------------------------------- */
/* 4. 音声読み上げ/認識/API連携関連                                                */
/* --------------------------------------------------------------------------------- */

// DOM要素の取得
const statusArea = document.getElementById("status-area");
const sendBtn = document.getElementById("sendBtn");
const input = document.getElementById("messageInput");
const ui = document.getElementById('ui');
const tapArea = document.getElementById('tapArea');

// API設定
const LLM_API_URL = "https://atjmuwnwmtjw-hello.hf.space/llm/generate";
const MQTT_API_URL = "https://atjmuwnwmtjw-hello.hf.space/iot/control";

// 状態管理変数
const synth = window.speechSynthesis;
let audioContext, analyser, mediaStream;
let recognition = null;
let currentTextToSpeak = '';
let debounceTimeout; // ★ デバウンス用のタイマーID

// --- ヘルパー関数 (色の補間) ---
function hexToRgb(hex) {

    // ✅ 修正: 無効な入力に対するチェックを追加
    if (typeof hex !== 'string') {
        // console.error("hexToRgb received non-string value:", hex);
        return [255, 255, 255]; // 白を返すか、適切なエラー処理
    }
    // #RGB または #RRGGBB 形式を処理
    const color = hex.startsWith('#') ? hex.slice(1) : hex;
    let bigint;

    if (color.length === 3) {
        // #RGB -> #RRGGBB に変換 (例: #f00 -> #ff0000)
        bigint = parseInt(color.split('').map(c => c + c).join(''), 16);
    } else if (color.length === 6) {
        bigint = parseInt(color, 16);
    } else {
        // 不正な値の場合は白を返す (エラー回避のため)
        return [255, 255, 255]; 
    }
    
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r, g, b];
}

function rgbToHex(r, g, b) {
    const toHex = (c) => ('0' + Math.max(0, Math.min(255, c)).toString(16)).slice(-2);
    return '#' + toHex(Math.round(r)) + toHex(Math.round(g)) + toHex(Math.round(b));
}

function startColorTransition(startColor, endColor, duration = 2000) {
    // 既にRGBA形式で渡されている可能性があるため、最初にHEX形式に変換
    // WAVE_COLORSから直接渡される場合は、この関数はあまり使用されないが、STT開始時のアニメーション用
    // この関数はUIのStatus Areaの色に使われるため、startColor, endColorがHEXであることを前提とする
    // ただし、startColorが'#ffff00'のようにHEX形式で渡されることを想定し、そのまま続行
    
    // startColorがRGBA形式の場合はHEXに変換する処理は複雑になるため、
    // ここでは startColor, endColor は '#RRGGBB' 形式であることを前提とする。
    if (!startColor.startsWith('#') || !endColor.startsWith('#')) return; 

    const startTime = performance.now();
    const startRgb = hexToRgb(startColor);
    const endRgb = hexToRgb(endColor);

    function interpolate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1, elapsed / duration);

        const r = startRgb[0] + (endRgb[0] - startRgb[0]) * progress;
        const g = startRgb[1] + (endRgb[1] - startRgb[1]) * progress;
        const b = startRgb[2] + (endRgb[2] - startRgb[2]) * progress;

        const currentColor = rgbToHex(r, g, b);

        statusArea.style.color = currentColor;
        statusArea.style.boxShadow = `0 0 20px ${currentColor}80`;

        if (progress < 1) {
            requestAnimationFrame(interpolate);
        }
    }
    requestAnimationFrame(interpolate);
}

/* ---------- UI helpers ---------- */

function updateStatus(message, color = '#00ffff') {
    statusArea.innerHTML = message;
    statusArea.style.color = color;
    statusArea.style.boxShadow = `0 0 20px ${color}80`;
}

function setStandbyStatus() {

    // 【✅ 修正: 待機状態に戻すとき、アニメーションを停止】
    stopSequentialColorTransition();
    const standbyMsg = `
        イマジナリーナンバー
        通称GAIイマさんAI
        AIアシスタント待機中...
        (モバイルでは画面タップで開始)
    `;
    updateStatus(standbyMsg.trim(), '#00ffff');
}

/* ---------- TTS (Speech Synthesis) ---------- */

// 【外部定義】絵文字抽出関数
const extractEmojis = (text) => {
    const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\p{Emoji_Modifier}*|\p{Emoji_Component}|\u200d/gu;
    const matches = text.match(emojiRegex);
    return matches ? matches.join('') : '';
};


/**
 * LLM応答など、AIからの正式な応答を読み上げ、終了後にSTTを再起動する
 * @param {string} text 読み上げるテキスト
 */
function speak(text) {
    if (!text) return;

    currentTextToSpeak = text;

    if (synth.speaking) synth.cancel();

    isSpeaking = true; // TTS開始

    // 【調整】TTSが開始される前に、既存の色遷移を停止（念のため）
    stopSequentialColorTransition();

    // LLM応答に基づいて波形の色を設定
    setWaveColorBasedOnResponse(text);

    // LLM応答に基づいて波形の色を設定 (波形の色は感情ベースで固定)
    setWaveColorBasedOnResponse(text);

    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 1.0;

    u.onstart = () => {
        // --- 【修正: ステータスカラーアニメーションを停止したまま、応答時の色を固定】 ---
        stopSequentialColorTransition(); // 念のため停止
        // --- 【✅ 修正: ステータスカラーアニメーションを開始】 ---
        startSequentialColorTransition(STATUS_TRANSITION_COLORS, 500); // 0.5秒ごとに次の色へ遷移
        const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
        const onlyEmojis = extractEmojis(text); 
        
        const formattedStatus = `
        ---==(_____[　イマジナリーナンバー通称GAIイマさんAI応答:  ?&!! ${onlyEmojis}　]_____)==--- __(V._.V)__
                      「${display}」
        `;
        // ここでは updateStatus() を使用せず、アニメーションロジックに色の設定を任せる
        statusArea.innerHTML = formattedStatus.trim(); 
        
        // statusArea.style.color と boxShadow は startSequentialColorTransition が設定するため、
        // ここでは updateStatus() を使わずに innerHTML の設定のみを行う
        // AI応答中の文字色はデフォルトの'#00ffaa'（または感情ベースの色）を使用
        // updateStatus(formattedStatus.trim(), '#00ffaa');
    };
    
    u.onend = () => {
        // 【✅ 修正箇所：TTS終了時にデフォルト色に戻す】
        currentWaveColor = WAVE_COLORS.default; // TTS終了時にデフォルト色に戻す
        isSpeaking = false; // TTS終了
        currentTextToSpeak = '';
        setStandbyStatus();
        input.value = '';
        currentWaveColor = WAVE_COLORS.default; // TTS終了時にデフォルト色に戻す
        

        // TTS終了後、STTが停止していれば自動で再起動を試みる
        if (recognition && !isRecording) {
            try {
                recognition.start();
            } catch (e) {
                console.warn('Recognition restart failed after TTS:', e);
            }
        }
    };
    u.onerror = (e) => {

        // --- 【✅ 修正: ステータスカラーアニメーションを停止】 ---
        stopSequentialColorTransition();
        console.error('TTS error:', e);
        isSpeaking = false; // TTSエラー
        currentTextToSpeak = '';
        setStandbyStatus();
        input.value = '';
        currentWaveColor = WAVE_COLORS.default;
    };

    synth.speak(u);
}

/**
 * テキスト入力時の即時プレビュー用読み上げ関数
 * @param {string} text 読み上げるテキスト
 */
function speakSentence(text) {
    // 完全に待機中のときのみ読み上げを許可する
    if (text.trim() === '' || isRecording || isSpeaking || text === currentTextToSpeak) {
        return;
    }

    if (synth.speaking) {
        synth.cancel();
    }

    currentTextToSpeak = text;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;

    // utterance.onstart = () => {
    //     // プレビュー中は isSpeaking を true にしない (TTSフラグを乱用しないため)
    //     const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
    //     updateStatus(`文章を読み上げ中 (プレビュー): 「${display}」`, '#00ffaa');
    //     // プレビュー読み上げ中も波形を動かすため、一時的にcurrentWaveColorをポジティブに設定
    //     currentWaveColor = WAVE_COLORS.positive;
    // };
    // speakSentence 関数内
    utterance.onstart = () => {
        // 【改善】一時的に isSpeaking を true にして波形を動かす
        isSpeaking = true; 
        const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
        updateStatus(`文章を読み上げ中 (プレビュー): 「${display}」`, '#00ffaa');
        currentWaveColor = WAVE_COLORS.positive;
    };

    // utterance.onend = () => {
    //     currentTextToSpeak = '';
    //     setStandbyStatus();
    //     currentWaveColor = WAVE_COLORS.default; // 終了したらデフォルトに戻す
    // };

    utterance.onend = () => {
        // 【改善】終了時に isSpeaking を false に戻す
        isSpeaking = false; 
        currentTextToSpeak = '';
        setStandbyStatus();
        currentWaveColor = WAVE_COLORS.default; 
    };

    utterance.onerror = (event) => {
        console.error('Speech Synthesis Error:', event);
        currentTextToSpeak = '';
        updateStatus('読み上げエラーが発生しました', '#ff0000');
        currentWaveColor = WAVE_COLORS.default;
    };

    synth.speak(utterance);
}

/* ---------- Speech Recognition (Browser STT) & Audio Init ---------- */

function restartRecognition() {
    isRecording = false;

    // TTSが動作中でなければ、待機状態に戻す
    if (!synth.speaking) {
        setStandbyStatus();
    }

    // continuous: true のため、ここで自動再起動は原則行わない
    // 自動再起動は onend でのみ処理する

    setTimeout(() => {
        try {
            // 既に認識が開始されている場合は何もしない
            if (!isRecording && !synth.speaking && recognition) recognition.start();
        } catch (e) {
            if (e.name !== 'InvalidStateError') {
                console.warn('Recognition restart failed:', e);
            }
        }
    }, 980);
}

function startBrowserRecognition() {
    if (isRecording) return;

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        updateStatus('Error: Speech Recognition not supported in this browser.', '#ff0000');
        return;
    }

    if (recognition) {
        recognition.stop();
        recognition = null;
    }
　　// ... (中略) ...
    recognition = new (window.webkitSpeechRecognition || window.SpeechRecognition)();
    // recognition.continuous = false;
    recognition.continuous = true; // ★★★ 修正: 連続認識を強制的にONに変更
    recognition.interimResults = true;
    recognition.lang = 'ja-JP';

    // 最後に確定されたテキストを保持するためのローカル変数
    // let lastFinalTranscript = '';
    // 【修正】onresultで使用する変数をローカルスコープ内で宣言します
    let lastFinalTranscript = '';
    let currentTranscript = ''; // STT結果全体を保持
    let finalTranscript = '';   // 確定した結果のみを保持

    // recognition.onstart = () => {
    //     isRecording = true;
    //     lastFinalTranscript = ''; // 認識開始時にリセット
    recognition.onstart = () => {
        isRecording = true;
        lastFinalTranscript = '';
        currentTranscript = ''; // ★ onstart でリセット
        finalTranscript = '';   // ★ onstart でリセット
        const standbyMsg = `
            Listening...
            話しかけてください...！
        `;
        updateStatus(standbyMsg.trim(), '#ffff00');
        startColorTransition('#ffff00', '#00ffaa', 2000);
        input.value = '';
        if (synth.speaking) synth.cancel();
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        // let finalTranscript = '';
        // 【修正】イベント結果全体を反復処理し、currentTranscriptとfinalTranscriptを更新
        currentTranscript = '';
        finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;// 最新の結果を累積
            if (event.results[i].isFinal) {
                // lastFinalTranscript = currentTranscript;
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        // input.value = finalTranscript || interimTranscript || currentTranscript;// 認識された最新のテキストをすぐに表示
        // 確定結果があればそれを、なければ最新の累積結果を表示
        input.value = finalTranscript || currentTranscript; 
        
        // 確定された最新のテキストを保持
        if (finalTranscript) {
            lastFinalTranscript = finalTranscript;
        }
    };

    recognition.onend = () => {
        isRecording = false;

        // TTSが動作していない場合に限り isSpeaking は false に 
        if (!synth.speaking) {
            currentWaveColor = WAVE_COLORS.default;
        }

        // 最後に確定されたテキスト、または onend 時の input の値を使用
        // ★★★ 修正: let を使用し、変数名を promptToProcess に変更 ★★★
        let promptToProcess = lastFinalTranscript || input.value.trim(); 
        
        if (promptToProcess && promptToProcess.length > 1 && !promptToProcess.startsWith("話しかけてください") && !promptToProcess.startsWith("イマジナリーナンバー 通称GAIイマさんAI応答:")) {
            updateStatus('Processing response...', '#00ffaa');
            // LLM処理を実行
            processRecognitionResult(promptToProcess).finally(() => { // promptToProcess を使用
                // TTSが終了した後に再起動させる
                if (!synth.speaking) {
                    // continuous: true のため、ここでは自動再起動せず待機状態に戻す
                    setStandbyStatus(); 
                    // 認識機能を完全にリセットし、次回タップを待つ
                    recognition = null; 
                }
            });
        } else {
            // 発話がなかったか、短すぎた場合
            input.value = '';
            setStandbyStatus(); // 待機状態に戻す
            recognition = null; // 認識機能を完全にリセット
        }
    };
    // recognition.onend = () => {
    //     isRecording = false;

    //     // TTSが動作していない場合に限り isSpeaking は false に 
    //     if (!synth.speaking) {
    //         currentWaveColor = WAVE_COLORS.default;
    //     }

    //     // 最後に確定されたテキスト、または onend 時の input の値を使用
    //     // ★★★ 修正: const ではなく var を使用し、スコープのエラーを回避 ★★★
    //     // 最後に確定されたテキスト、または onend 時の input の値を使用
    //     // ★★★ 修正: let を使用し、変数名を promptToProcess に変更 ★★★
    //     let finalPrompt = lastFinalTranscript || input.value.trim(); 
        
    //     if (finalPrompt && finalPrompt.length > 1 && !finalPrompt.startsWith("話しかけてください") && !finalPrompt.startsWith("イマジナリーナンバー 通称GAIイマさんAI応答:")) {
    //         updateStatus('Processing response...', '#00ffaa');
    //         // LLM処理を実行
    //         processRecognitionResult(finalPrompt).finally(() => {
    //             // TTSが終了した後に再起動させる
    //             if (!synth.speaking) {
    //                 // continuous: true のため、ここでは自動再起動せず待機状態に戻す
    //                 setStandbyStatus(); 
    //                 // 認識機能を完全にリセットし、次回タップを待つ
    //                 recognition = null; 
    //             }
    //         });
    //     } else {
    //         // 発話がなかったか、短すぎた場合
    //         input.value = '';
    //         setStandbyStatus(); // 待機状態に戻す
    //         recognition = null; // 認識機能を完全にリセット
    //     }
    // };
    // recognition.onend = () => {
    //     isRecording = false;

    //     // TTSが動作していない場合に限り isSpeaking は false に (TTSはspeak/speakSentenceで制御)
    //     if (!synth.speaking) {
    //         currentWaveColor = WAVE_COLORS.default;
    //     }

    //     const finalPrompt = input.value.trim();
    //     // 最後に確定されたテキスト、または onend 時の input の値を使用
    //     const finalPrompt = lastFinalTranscript || input.value.trim();

    //     if (finalPrompt && finalPrompt.length > 1 && !finalPrompt.startsWith("話しかけてください") && !finalPrompt.startsWith("イマジナリーナンバー 通称GAIイマさんAI応答:")) {
    //         updateStatus('Processing response...', '#00ffaa');
    //         // LLM処理中にSTTが自動で再起動しないように、.finallyでrestartRecognitionを呼ぶ
    //         processRecognitionResult(finalPrompt).finally(() => {
    //             // TTSが終了した後に再起動させる (speak関数内のonendでも実施されるため冗長ではあるが念のため)
    //             if (!synth.speaking) {
    //                 // continuous: true のため、ここでは自動再起動せず待機状態に戻す
    //                 setStandbyStatus(); 
    //                 // 認識機能を完全にリセットし、次回タップを待つ
    //                 recognition = null;
    //                 // restartRecognition();
    //             }
    //         });
    //     } else {
    //         // 発話がなかったか、短すぎた場合
    //         input.value = '';
    //         setStandbyStatus(); //restartRecognition();
    //         // 認識機能を完全にリセットし、次回タップを待つ
    //         recognition = null;
    //     }
    // };

    recognition.onerror = (event) => {
        isRecording = false;
        console.error('Speech Recognition Error:', event.error);

        if (event.error !== 'not-allowed' && event.error !== 'aborted'&& event.error !== 'audio-capture') {
            // エラーが発生したら、認識機能を完全にリセット
             recognition = null;
            setStandbyStatus(); // restartRecognition();
        } else if (event.error === 'aborted') {
            recognition = null;
            setStandbyStatus(); //restartRecognition();
        } else {
            updateStatus('Error: Microphone permission denied or failed.', '#ff0000');
        }
    };

    try {
        recognition.start();
    } catch (e) {
        console.warn('Initial recognition start failed:', e);
    }
}

async function initAudioAndSTT() {
    if (analyser) {
        startBrowserRecognition();
        return;
    }
    updateStatus('Requesting microphone access...');

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        dataArray = new Uint8Array(analyser.frequencyBinCount);

        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const sourceNode = audioContext.createMediaStreamSource(mediaStream);

        sourceNode.connect(analyser);

        startBrowserRecognition();

        updateStatus('Listening...', '#ffff00');
    } catch (e) {
        console.error('Audio initialization failed:', e);
        updateStatus('Error: Microphone access denied or failed to initialize.', '#ff0000');
    }
}

/**
 * FastAPI/MQTTバックエンドにコマンドを送信する関数
 */
async function sendIoTCommand(command) {
    updateStatus(`Executing IoT command: ${command}...`, '#00ffaa');

    try {
        const response = await fetch(MQTT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: command })
        });

        const data = await response.json();

        if (response.ok) {
            const successMsg = `承知しました。${command === 'ON' ? '電気をつけました' : '電気を消しました'}。`;
            speak(successMsg);
        } else {
            const detail = data.detail || "サーバーエラー";
            const errorMsg = `エラーが発生しました。IoTコマンド '${command}' の実行に失敗しました。詳細: ${detail}`;
            speak(errorMsg);
        }
    } catch (error) {
        const networkErrorMsg = `🔴 ネットワークエラー: IoTバックエンドサーバーに接続できません (${error.message})`;
        speak(networkErrorMsg);
    }
}

/* ---------- 統合されたメイン処理関数 (IoT or LLM) ---------- */

async function processRecognitionResult(finalPrompt) {
    // 1. IoTコマンドの判定と振り分け
    const lowerPrompt = finalPrompt.toLowerCase();
    let iotCommand = null;

    if ((lowerPrompt.includes('ライト') || lowerPrompt.includes('電気')) && (lowerPrompt.includes('つけ') || lowerPrompt.includes('オン') || lowerPrompt.includes('点け'))) {
        iotCommand = 'ON';
    } else if ((lowerPrompt.includes('ライト') || lowerPrompt.includes('電気')) && (lowerPrompt.includes('けし') || lowerPrompt.includes('オフ') || lowerPrompt.includes('消し'))) {
        iotCommand = 'OFF';
    }

    if (iotCommand) {
        await sendIoTCommand(iotCommand);
        return;
    }

    // 2. LLM応答生成（IoTコマンドでなかった場合）
    await generateAndSpeakResponse(finalPrompt);
}

/* ---------- LLM (Gemini) API & TTS 連携 ---------- */

async function generateAndSpeakResponse(prompt) {
    // 【✅ 修正箇所: ここにレインボー設定を追加します】
    currentWaveColor = 'rainbow';
    // segmentDurationを短く設定することで、より速いレインボー効果を狙う
    startSequentialColorTransition(STATUS_TRANSITION_COLORS, 200);
    updateStatus('Generating response (ks903 whisper Fast API)...', '#00ffaa');

    // ユーザープロンプトから不要なプレフィックスを除去（念のため）
    const cleanedPrompt = prompt.replace(/^イマジナリーナンバー 通称GAIイマさんAI応答:\s*/, '').trim();
    if (!cleanedPrompt) {
        speak("すみません、何も聞こえませんでした。もう一度話しかけてください。");
        return;
    }

    const systemInstruction = "あなたは「イマジナリーナンバー 通称GAIイマさん」という名前のKS-903model8800-a1-90dという音声アシスタントです。ユーザーの質問に日本語で、簡潔かつ丁寧に答えてください。";

    const payload = {
        prompt: cleanedPrompt,
        contents: [{ parts: [{ text: cleanedPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        tools: [{ "google_search": {} }],
    };

    const MAX_RETRIES = 3;
    let responseText = "エラーが発生しました。イマジナリーナンバー 通称GAIイマさんAIのKS-903model8800-a1-90d応答を取得できませんでした。";

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const response = await fetch(LLM_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: `HTTP ${response.status} Error.` }));
                throw new Error(`FastAPI Error! Status: ${response.status}. Detail: ${errorData.detail}`);
            }

            const result = await response.json();

            if (result && result.text) {
                responseText = result.text;
                break;
            } else {
                throw new Error("Empty response or invalid imasan response structure from ks903 whisper Fast API.");
            }

        } catch (e) {
            console.error(`ks903 whisper Fast API call error on attempt ${i + 1}:`, e);
            if (i === MAX_RETRIES - 1) {
                responseText = "エラーが発生しました。イマジナリーナンバー 通称GAIイマさんAIKS-903model8800-a1-90dの応答を取得できませんでした。Generaltebバックエンドサーバー (ポート8001) の実行状態とAPIキーを確認してください。";
            } else {
                const delay = 2 ** i * 1000 + Math.random() * 500;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    // LLMからの応答を取得するループ
    // ... (中略) ...

    // LLM応答の取得が完了したら、speak関数を呼ぶ直前でアニメーションを停止する
    // speak関数内で再びアニメーションを開始/停止するロジックがあるため、
    // ここで停止させることで、応答後のアニメーションと干渉しないようにします。
    // （※ 厳密にはspeak関数のonstartで停止が優先されるが、安全のためここで停止）
    stopSequentialColorTransition();

    updateStatus('Speaking response...', '#00ffaa');
    speak(responseText);

    return Promise.resolve();
}

/* ---------- イベントハンドラの統合と定義 ---------- */

// テキスト入力欄のイベントを追加 (Enterキーで処理)
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();

        // ★ デバウンスタイマーをクリア (即時実行のため)
        clearTimeout(debounceTimeout); 
        
        const textPrompt = input.value.trim();

        if (textPrompt) {
            if (recognition && isRecording) {
                recognition.stop();
            }
            if (synth.speaking) synth.cancel();

            updateStatus('Processing text input...', '#ffff00');

            // LLM処理を実行
            processRecognitionResult(textPrompt).catch(error => {
                console.error("Text input processing failed:", error);
            });
        }
    }
});





// ★★★ ここから下のコードがすべてファイルの末尾まで記述され、閉じられているか確認してください ★★★

// テキスト入力のたびに現在の内容を読み上げる機能の追加 (TTS即時プレビュー)
input.addEventListener('input', (event) => {
    const currentText = input.value.trim();

    // デバウンス処理を開始/リセット
    clearTimeout(debounceTimeout);

    if (currentText.length > 0) {
        // 1000ms (1秒) のデバウンスをかける
        debounceTimeout = setTimeout(() => {
            // 音声認識が実行中でない、かつ、AIが応答中でない場合にのみ実行
            if (!isRecording && !synth.speaking && currentText !== currentTextToSpeak) {
                speakSentence(currentText);
            }
        }, 1000);
    } else if (currentText.length === 0 && synth.speaking) {
        // テキストが全て削除され、かつ読み上げ中の場合はキャンセルして待機状態に戻す
        synth.cancel();
        setStandbyStatus();
        currentWaveColor = WAVE_COLORS.default;
        currentTextToSpeak = '';
    }
}); // <--- この閉じカッコが重要

// リセットボタンの機能 (STTとTTSの強制停止と再起動)
sendBtn.addEventListener("click", () => {
    if (recognition) {
        // 認識中の場合は、ここで認識を停止させ、onend に処理を委ねる
        recognition.stop(); 
        isRecording = false; // 連続モードの場合、ボタンで停止させる
    } else {
        // 認識中でない場合は、リセットとして認識を開始する
        if (synth.speaking) synth.cancel();

        isSpeaking = false;
        currentWaveColor = WAVE_COLORS.default;
        clearTimeout(debounceTimeout); // リセット時にもデバウンスをクリア

        initAudioAndSTT();
    }
}); // <--- この閉じカッコが重要


// UI トグル機能 (画面タップ)
let uiVisible = true;
tapArea.addEventListener('click', (e) => {
    // リセットボタンへのタップは無視
    if (e.target.closest('#input-controls')) {
        return;
    }

   

    // ... (中略：tapArea.addEventListener('click', ...))

    uiVisible = !uiVisible;
    if (uiVisible) {
        ui.style.opacity = 1;
    } else {
        ui.style.opacity = 0;
    }
}); // <--- ファイルの末尾はここで終わる

// (ファイル末尾)
// }); // <--- この閉じカッコが最後のイベントリスナーの終わり

// ★★★ JSファイルの最終行はこれだけで終わりか、</script>タグで閉じているか確認 ★★★
// テキスト入力のたびに現在の内容を読み上げる機能の追加 (TTS即時プレビュー)
// input.addEventListener('input', (event) => {
//     const currentText = input.value.trim();

//     // デバウンス処理を開始/リセット
//     clearTimeout(debounceTimeout);

//     if (currentText.length > 0) {
//         // 1000ms (1秒) のデバウンスをかける
//         debounceTimeout = setTimeout(() => {
//             // 音声認識が実行中でない、かつ、AIが応答中でない場合にのみ実行
//             if (!isRecording && !synth.speaking && currentText !== currentTextToSpeak) {
//                 speakSentence(currentText);
//             }
//         }, 1000);
//     } else if (currentText.length === 0 && synth.speaking) {
//         // テキストが全て削除され、かつ読み上げ中の場合はキャンセルして待機状態に戻す
//         synth.cancel();
//         setStandbyStatus();
//         currentWaveColor = WAVE_COLORS.default;
//         currentTextToSpeak = '';
//     }
// });

// // リセットボタンの機能 (STTとTTSの強制停止と再起動)
// sendBtn.addEventListener("click", () => {
//     if (recognition) {
//         // 認識中の場合は、ここで認識を停止させ、onend に処理を委ねる
//         recognition.stop();
//         // recognition = null;
//         isRecording = false;// 連続モードの場合、ボタンで停止させる

//         // recognitionはonendでnull化されるため、ここでは何もしない
//         // ただし、onendで処理が走らない場合の保険としてisRecordingをfalseにする
//     }else {
//         // 認識中でない場合は、リセットとして認識を開始する
//     if (synth.speaking) synth.cancel();

//     isSpeaking = false;
//     currentWaveColor = WAVE_COLORS.default;
//     clearTimeout(debounceTimeout); // リセット時にもデバウンスをクリア

//     initAudioAndSTT();
//     updateStatus('リセットしました。マイク入力を開始しています...');
//     }
// });


// // UI トグル機能 (画面タップ)
// let uiVisible = true;
// tapArea.addEventListener('click', (e) => {
//     // リセットボタンへのタップは無視
//     if (e.target.closest('#input-controls')) {
//         return;
//     }


//     // 初回タップで音声認識を開始する
//     // if (!recognition) {
//     //     initAudioAndSTT();
//     // }
    
//     // ★★★ ここまで ★★★
//     uiVisible = !uiVisible;
//     if (uiVisible) {
//         ui.style.opacity = 1;
//     } else {
//         ui.style.opacity = 0;
//     }
// });

// /// imakunAI.js #

// /* --------------------------------------------------------------------------------- */
// /* 1. Canvasアニメーションとレスポンシブ対応                                         */
// /* --------------------------------------------------------------------------------- */

// const canvas = document.getElementById("waveCanvas");
// const ctx = canvas.getContext("2d");

// // Canvasの初期サイズ設定は、resizeCanvas関数で処理するため、ここでは変数宣言に留める
// let bars = [];
// const BAR_COUNT = 40; 
// const BAR_WIDTH = 8;
// let dataArray;

// let animationFrameId;
// let isSpeaking = false;      // ★ TTS (AI応答) のアクティブ状態
// let isRecording = false;     // ★ STT (ユーザー入力) のアクティブ状態
// let isWaveActive = false;    // ★ 波形アニメーションを実行するかどうかを制御するフラグ (新設)
// let currentWaveColor = 'rgba(50, 200, 255, 0.7)'; 
// let rainbowHue = 0; 

// // const WAVE_COLORS = {
// //     default: 'rgba(50, 200, 255, 0.7)',
// //     positive: 'rgba(50, 255, 50, 0.7)',
// //     anger: 'rgba(255, 50, 50, 0.7)',
// //     rage: 'rgba(150, 50, 255, 0.7)',
// //     negative: 'rgba(50, 100, 255, 0.7)',
// //     sadness: 'rgba(0, 0, 150, 0.7)'
// // };

// // 【色の定義】感情に応じた色と、レインボーアニメーション用の色相変数
// const WAVE_COLORS = {
//     // デフォルト: 水色 (待機状態)
//     default: 'rgba(50, 200, 255, 0.7)', 
//     // ポジティブな回答: 緑
//     positive: 'rgba(50, 255, 50, 0.7)', 
//     // お怒り: 赤
//     anger: 'rgba(255, 50, 50, 0.7)', 
//     // 本気の怒り/裏切り: 紫
//     rage: 'rgba(150, 50, 255, 0.7)', 
//     // ネガティブ (一般的): 明るめのブルー
//     negative: 'rgba(50, 100, 255, 0.7)', 
//     // 悲しい/号泣: 濃いブルー
//     sadness: 'rgba(0, 0, 150, 0.7)'
// };

// // 現在の波形の色を保持する変数 (デフォルトは水色)
// let currentWaveColor = WAVE_COLORS.default; 
// // レインボーアニメーション用の色相を保持する変数 (0〜360度)
// let rainbowHue = 0;

// /**
//  * バーのデータを再計算する
//  */
// function createBars() {
//     bars = [];
//     // 中央揃えでバーを配置
//     const startX = canvas.width / 2 - (BAR_COUNT * BAR_WIDTH) / 2;
//     for (let i = 0; i < BAR_COUNT; i++) {
//         bars.push({
//             x: startX + i * BAR_WIDTH,
//             height: 10,
//             color: "#00ffff"
//         });
//     }
// }

// /**
//  * Canvasサイズをウィンドウにフィットさせ、バーを再計算する
//  */
// function resizeCanvas() {
//     canvas.width = window.innerWidth;
//     canvas.height = window.innerHeight;
//     // サイズ変更時にバーを再計算
//     createBars();
// }

// /**
//  * バーをアニメーションさせて描画する
//  */
// function animateBars() {
//     // Canvasをクリア
//     ctx.clearRect(0, 0, canvas.width, canvas.height);

//     // isWaveActive フラグで描画が必要か判断
//     isWaveActive = isSpeaking || isRecording; 

//     // analyserが存在し、波形がアクティブであれば周波数データを取得
//     if (analyser && dataArray && isRecording) {
//         // 録音中のみ周波数データを取得
//         analyser.getByteFrequencyData(dataArray);
//     }

//     // 描画色を決定するロジック
//     let barColor = currentWaveColor;

//     // レインボーモードの場合、動的に色を計算
//     if (currentWaveColor === 'rainbow') {
//         rainbowHue = (rainbowHue + 3) % 360;
//         barColor = `hsla(${rainbowHue}, 100%, 70%, 0.9)`;
//     }

//     // 決定した色を塗りつぶし色として設定
//     ctx.fillStyle = barColor;
//     const currentWaveY = canvas.height / 2;

//     bars.forEach((bar, i) => {
//         let height = bar.height;

//         // 波形がアクティブな場合のみ動かす
//         if (isWaveActive) {
//             if (isRecording && dataArray) {
//                 // 音声入力中: 周波数データを単純にマッピング
//                 const dataIndex = Math.floor(i * (dataArray.length / BAR_COUNT));
//                 const rawHeight = dataArray[dataIndex] || 0;
//                 // 0-255を最大高さ（例: 200）にスケール
//                 height = (rawHeight / 255) * 200 + 5; 
//             } else if (isSpeaking) {
//                 // AI応答中 (TTS): シンプルなサイン波で波形を動かす
//                 const waveAmplitude = 100;
//                 const waveFrequency = 0.05;
//                 const waveOffset = Math.sin(Date.now() * 0.005 + i * waveFrequency) * waveAmplitude;
//                 height = 10 + Math.abs(waveOffset);
//             } else {
//                 // 待機中だが波形アニメーションが動いている状態 (TTSプレビューなど)
//                  const waveAmplitude = 20;
//                  const waveFrequency = 0.1;
//                  const waveOffset = Math.sin(Date.now() * 0.01 + i * waveFrequency) * waveAmplitude;
//                  height = 10 + Math.abs(waveOffset);
//             }
//         } else {
//             // 完全に待機中は最小の高さ
//             height = 10;
//         }

//         // バーの高さと位置を更新
//         bars[i].height = height;

//         // 描画
//         ctx.fillRect(bar.x, currentWaveY - height / 2, BAR_WIDTH - 2, height);
//     });

//     animationFrameId = requestAnimationFrame(animateBars);
// }

// window.addEventListener("load", () => {
//     resizeCanvas();
//     animateBars();
//     initAudioAndSTT(); 
//     setStandbyStatus();
//     document.getElementById('ui').style.opacity = 1;
// });
// window.addEventListener("resize", resizeCanvas);
// window.addEventListener("orientationchange", () => {
//     setTimeout(resizeCanvas, 300);
// });

// /* --------------------------------------------------------------------------------- */
// /* 2. 感情・色判定ロジック                                                           */
// /* --------------------------------------------------------------------------------- */

// // /**
// //  * AIの回答テキストに基づいて波形の色を変更する関数
// //  * @param {string} responseText LLMからの回答テキスト
// //  */
// // function setWaveColorBasedOnResponse(responseText) {
// //     const text = responseText.toLowerCase();

// //     // 絵文字抽出関数（ローカルまたはグローバルで定義されている前提）
// //     const extractEmojis = (t) => {
// //         const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\p{Emoji_Modifier}*|\p{Emoji_Component}|\u200d/gu;
// //         const matches = t.match(emojiRegex);
// //         return matches ? matches.join('') : '';
// //     };

// //     // 判定ロジック（優先順位順）

// //     // 1. 【本気の怒り・裏切り (紫)】
// //     const rageKeywords = ['裏切り', '許さない', '報復', 'どうしてくれる', '絶交', '失望'];
// //     const rageEmojis = ['😡', '😠', '🤬', '👿', '😾', '💀', '🔪', '💣'];
// //     if (rageKeywords.some(k => text.includes(k)) || rageEmojis.some(e => text.includes(e))) {
// //         currentWaveColor = WAVE_COLORS.rage;
// //         console.log("波形の色を【本気の怒り・裏切り】の紫に変更しました。");
// //         return;
// //     }

// //     // 2. 【最高にハッピー (レインボー)】
// //     const superHappyKeywords = ['最高にハッピー', '神', '究極', 'パーフェクト', '完璧', '奇跡', '感無量', 'レジェンド'];
// //     const superHappyEmojis = ['🤩', '✨', '🥳', '💯', '👑', '🥇', '🚀', '🌈', '🎉🎉🎉'];
// //     if (superHappyKeywords.some(k => text.includes(k)) || superHappyEmojis.some(e => text.includes(e))) {
// //         currentWaveColor = 'rainbow';
// //         console.log("波形の色を【最高にハッピー】のレインボーに変更しました。");
// //         return;
// //     }

// //     // 3. 【お怒り (赤)】
// //     const angerKeywords = ['怒り', 'ふざけるな', 'やめろ', 'だめだ', '不可能だ', '違います', '否定', 'ありえない'];
// //     const angerEmojis = ['😤', '💢', '🔥', '💥', '👹', '😫', '😩'];
// //     if (angerKeywords.some(k => text.includes(k)) || angerEmojis.some(e => text.includes(e))) {
// //         currentWaveColor = WAVE_COLORS.anger;
// //         console.log("波形の色を【お怒り】の赤に変更しました。");
// //         return;
// //     }

// //     // 4. 【悲しい・号泣 (濃いブルー)】
// //     const sadnessKeywords = ['悲しい', '泣く', 'ごめんなさい', 'つらい', '寂しい', '涙', '耐えられない', '最悪', 'しんどい'];
// //     const sadnessEmojis = ['😭', '😢', '🥺', '💧', '😥', '💔', '🌧️', '☔'];
// //     if (sadnessKeywords.some(k => text.includes(k)) || sadnessEmojis.some(e => text.includes(e))) {
// //         currentWaveColor = WAVE_COLORS.sadness;
// //         console.log("波形の色を【悲しい・号泣】の濃いブルーに変更しました。");
// //         return;
// //     }

// //     // 5. 【ネガティブ (ブルー)】
// //     const negativeKeywords = ['エラー', '失敗', 'できません', '警告', '問題', '懸念', '不明', '確認', '無理', '難しい'];
// //     const negativeEmojis = ['😞', '😟', '😨', '🥶', '😰', '😵'];
// //     if (negativeKeywords.some(k => text.includes(k)) || negativeEmojis.some(e => text.includes(e))) {
// //         currentWaveColor = WAVE_COLORS.negative;
// //         console.log("波形の色を【ネガティブ】のブルーに変更しました。");
// //         return;
// //     }

// //     // 6. 【ポジティブ (緑)】
// //     const positiveKeywords = ['ありがとう', '成功', '完了', '問題ありません', '良い', 'できます', '素晴らしい', '助かる', '了解', 'OK', 'ハッピー'];
// //     const positiveEmojis = ['😄', '😊', '😆', '👍', '👏', '✅', '🌟'];
// //     if (positiveKeywords.some(k => text.includes(k)) || positiveEmojis.some(e => text.includes(e))) {
// //         currentWaveColor = WAVE_COLORS.positive;
// //         console.log("波形の色を【ポジティブ】の緑に変更しました。");
// //         return;
// //     }

// //     // デフォルト色
// //     currentWaveColor = WAVE_COLORS.default;
// //     console.log("波形の色をデフォルトの水色に戻しました。");
// // }



// /**
//  * AIの回答テキストに基づいて波形の色を変更する関数 (柔軟なキーワード＆絵文字対応)
//  * @param {string} responseText LLMからの回答テキスト
//  */
// function setWaveColorBasedOnResponse(responseText) {
//     const text = responseText.toLowerCase();

//     // 1. 【本気の怒り・裏切り (紫)】：最も深刻なキーワードを優先
//     const rageKeywords = ['裏切り', '許さない', '報復', 'どうしてくれる', '絶交', '失望'];
//     const rageEmojis = ['😡', '😠', '🤬', '👿', '😾', '💀', '🔪', '💣']; 
//     if (rageKeywords.some(k => text.includes(k)) || rageEmojis.some(e => text.includes(e))) {
//         currentWaveColor = WAVE_COLORS.rage; 
//         console.log("波形の色を【本気の怒り・裏切り】の紫に変更しました。");
//         return;
//     }

//     // 2. 【お怒り (赤)】：強い否定や感情的な表現
//     const angerKeywords = ['怒り', 'ふざけるな', 'やめろ', 'だめだ', '不可能だ', '違います', '否定', 'ありえない'];
//     const angerEmojis = ['😤', '💢', '🔥', '💥', '👹', '😫', '😩']; 
//     if (angerKeywords.some(k => text.includes(k)) || angerEmojis.some(e => text.includes(e))) {
//         currentWaveColor = WAVE_COLORS.anger; 
//         console.log("波形の色を【お怒り】の赤に変更しました。");
//         return;
//     }

//     // 3. 【悲しい・号泣 (濃いブルー)】：深い悲しみや謝罪
//     const sadnessKeywords = ['悲しい', '泣く', 'ごめんなさい', 'つらい', '寂しい', '涙', '耐えられない', '最悪', 'しんどい'];
//     const sadnessEmojis = ['😭', '😢', '🥺', '💧', '😥', '💔', '🌧️', '☔']; 
//     if (sadnessKeywords.some(k => text.includes(k)) || sadnessEmojis.some(e => text.includes(e))) {
//         currentWaveColor = WAVE_COLORS.sadness; 
//         console.log("波形の色を【悲しい・号泣】の濃いブルーに変更しました。");
//         return;
//     }

//     // 4. 【ネガティブ (ブルー)】：一般的な懸念、問題、エラー
//     const negativeKeywords = ['エラー', '失敗', 'できません', '警告', '問題', '懸念', '不明', '確認', '無理', '難しい'];
//     const negativeEmojis = ['😞', '😟', '😨', '🥶', '😰', '😵']; 
//     if (negativeKeywords.some(k => text.includes(k)) || negativeEmojis.some(e => text.includes(e))) {
//         currentWaveColor = WAVE_COLORS.negative; 
//         console.log("波形の色を【ネガティブ】のブルーに変更しました。");
//         return;
//     }
    
//     // 5. 【最高にハッピー (レインボー)】：新しい判定ロジック
//     const superHappyKeywords = ['最高にハッピー', '神', '究極', 'パーフェクト', '完璧', '奇跡', '感無量', 'レジェンド'];
//     const superHappyEmojis = ['🤩', '✨', '🥳', '💯', '👑', '🥇', '🚀', '🌈', '🎉🎉🎉']; 
//     if (superHappyKeywords.some(k => text.includes(k)) || superHappyEmojis.some(e => text.includes(e))) {
//         currentWaveColor = 'rainbow'; // 描画関数が処理する特別な値
//         console.log("波形の色を【最高にハッピー】のレインボーに変更しました。");
//         return;
//     }

//     // 6. 【ポジティブ (緑)】：一般的な肯定的 
//     const positiveKeywords = ['ありがとう', '成功', '完了', '問題ありません', '良い', 'できます', '素晴らしい', '助かる', '了解', 'OK', 'ハッピー'];
//     const positiveEmojis = ['😄', '😊', '😆', '👍', '👏', '✅', '🌟'];
//     if (positiveKeywords.some(k => text.includes(k)) || positiveEmojis.some(e => text.includes(e))) {
//         currentWaveColor = WAVE_COLORS.positive; 
//         console.log("波形の色を【ポジティブ】の緑に変更しました。");
//         return;
//     }

//     // どの条件にも合致しない場合はデフォルト色に戻す
//     currentWaveColor = WAVE_COLORS.default; 
//     console.log("波形の色をデフォルトの水色に戻しました。");
// }

// /* --------------------------------------------------------------------------------- */
// /* 3. 機密保持/開発者ツールの無効化                                                   */
// /* --------------------------------------------------------------------------------- */

// // 1. 右クリック（コンテキストメニュー）を禁止する
// document.addEventListener('contextmenu', function (e) {
//     e.preventDefault();
//     console.log("右クリックは禁止されています。");
//     return false;
// });
// document.body.addEventListener('contextmenu', function (e) {
//     e.preventDefault();
//     return false;
// });

// // 2. キーボードショートカットを禁止する
// document.onkeydown = function (e) {
//     const key = e.key;
//     const lowerKey = key.toLowerCase();

//     // F12キー (開発者ツール)
//     if (key === 'F12' || e.keyCode === 123) {
//         e.preventDefault();
//         return false;
//     }

//     // Ctrl/Cmd/Option/Alt キー状態のチェックを容易にする
//     const isCmdOrCtrl = e.ctrlKey || e.metaKey;
//     const isShift = e.shiftKey;
//     const isAltOrOption = e.altKey;

//     // 開発者ツールのショートカット (I, J, C)
//     if (
//         (isCmdOrCtrl && isShift && (lowerKey === 'i' || lowerKey === 'j' || lowerKey === 'c')) || // Ctrl/Cmd + Shift + I/J/C
//         (e.metaKey && isAltOrOption && (lowerKey === 'i' || lowerKey === 'j' || lowerKey === 'c')) // Cmd + Option + I/J/C (macOS)
//     ) {
//         e.preventDefault();
//         return false;
//     }

//     // その他、コンテンツ保護のためのショートカット (U, S, P)
//     if (isCmdOrCtrl && (lowerKey === 'u' || lowerKey === 's' || lowerKey === 'p')) {
//         e.preventDefault();
//         return false;
//     }
// };

// /* --------------------------------------------------------------------------------- */
// /* 4. 音声読み上げ/認識/API連携関連                                                  */
// /* --------------------------------------------------------------------------------- */

// // DOM要素の取得
// const statusArea = document.getElementById("status-area");
// const sendBtn = document.getElementById("sendBtn");
// const input = document.getElementById("messageInput");
// const ui = document.getElementById('ui');
// const tapArea = document.getElementById('tapArea');

// // API設定
// const LLM_API_URL = "https://atjmuwnwmtjw-hello.hf.space/llm/generate";
// const MQTT_API_URL = "https://atjmuwnwmtjw-hello.hf.space/iot/control";

// // 状態管理変数
// const synth = window.speechSynthesis;
// let audioContext, analyser, mediaStream;
// let recognition = null;
// let currentTextToSpeak = '';
// let debounceTimeout; // ★ デバウンス用のタイマーID (新規追加)

// // --- ヘルパー関数 (色の補間) ---
// function hexToRgb(hex) {
//     const bigint = parseInt(hex.slice(1), 16);
//     const r = (bigint >> 16) & 255;
//     const g = (bigint >> 8) & 255;
//     const b = bigint & 255;
//     return [r, g, b];
// }

// function rgbToHex(r, g, b) {
//     const toHex = (c) => ('0' + Math.max(0, Math.min(255, c)).toString(16)).slice(-2);
//     return '#' + toHex(Math.round(r)) + toHex(Math.round(g)) + toHex(Math.round(b));
// }

// function startColorTransition(startColor, endColor, duration = 2000) {
//     const startTime = performance.now();
//     const startRgb = hexToRgb(startColor);
//     const endRgb = hexToRgb(endColor);

//     function interpolate(currentTime) {
//         const elapsed = currentTime - startTime;
//         const progress = Math.min(1, elapsed / duration);

//         const r = startRgb[0] + (endRgb[0] - startRgb[0]) * progress;
//         const g = startRgb[1] + (endRgb[1] - startRgb[1]) * progress;
//         const b = startRgb[2] + (endRgb[2] - startRgb[2]) * progress;

//         const currentColor = rgbToHex(r, g, b);

//         statusArea.style.color = currentColor;
//         statusArea.style.boxShadow = `0 0 20px ${currentColor}80`;

//         if (progress < 1) {
//             requestAnimationFrame(interpolate);
//         }
//     }
//     requestAnimationFrame(interpolate);
// }

// /* ---------- UI helpers ---------- */

// function updateStatus(message, color = '#00ffff') {
//     statusArea.innerHTML = message;
//     statusArea.style.color = color;
//     statusArea.style.boxShadow = `0 0 20px ${color}80`;
// }

// function setStandbyStatus() {
//     const standbyMsg = `
//         イマジナリーナンバー
//         通称GAIイマさんAI
//         AIアシスタント待機中...
//     `;
//     updateStatus(standbyMsg.trim(), '#00ffff');
// }

// /* ---------- TTS (Speech Synthesis) ---------- */

// // 【外部定義】絵文字抽出関数
// const extractEmojis = (text) => {
//     const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\p{Emoji_Modifier}*|\p{Emoji_Component}|\u200d/gu;
//     const matches = text.match(emojiRegex);
//     return matches ? matches.join('') : '';
// };


// /**
//  * LLM応答など、AIからの正式な応答を読み上げ、終了後にSTTを再起動する
//  * @param {string} text 読み上げるテキスト
//  */
// function speak(text) {
//     if (!text) return;

//     currentTextToSpeak = text;

//     if (synth.speaking) synth.cancel();

//     isSpeaking = true; // TTS開始

//     // LLM応答に基づいて波形の色を設定
//     setWaveColorBasedOnResponse(text);

//     const u = new SpeechSynthesisUtterance(text);
//     u.lang = 'ja-JP';
//     u.rate = 1.0;

//     u.onstart = () => {
//         const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
//         const onlyEmojis = extractEmojis(text); 
        
//         const formattedStatus = `
//         ---==(_____[　イマジナリーナンバー通称GAIイマさんAI応答:  ?&!! ${onlyEmojis}　]_____)==--- __(V._.V)__
//                       「${display}」
//         `;
//         updateStatus(formattedStatus.trim(), '#00ffaa');
//     };
    
//     u.onend = () => {
//         isSpeaking = false; // TTS終了
//         currentTextToSpeak = '';
//         setStandbyStatus();
//         input.value = '';
//         currentWaveColor = WAVE_COLORS.default;

//         // TTS終了後、STTが停止していれば自動で再起動を試みる
//         if (recognition && !isRecording) {
//             try {
//                 recognition.start();
//             } catch (e) {
//                 console.warn('Recognition restart failed after TTS:', e);
//             }
//         }
//     };
//     u.onerror = (e) => {
//         console.error('TTS error:', e);
//         isSpeaking = false; // TTSエラー
//         currentTextToSpeak = '';
//         setStandbyStatus();
//         input.value = '';
//         currentWaveColor = WAVE_COLORS.default;
//     };

//     synth.speak(u);
// }

// /**
//  * テキスト入力時の即時プレビュー用読み上げ関数
//  * @param {string} text 読み上げるテキスト
//  */
// function speakSentence(text) {
//     // 完全に待機中のときのみ読み上げを許可する
//     if (text.trim() === '' || isRecording || isSpeaking || text === currentTextToSpeak) {
//         return;
//     }

//     if (synth.speaking) {
//         synth.cancel();
//     }

//     currentTextToSpeak = text;

//     const utterance = new SpeechSynthesisUtterance(text);
//     utterance.lang = 'ja-JP';
//     utterance.rate = 1.0;

//     utterance.onstart = () => {
//         // プレビュー中は isSpeaking を true にしない (TTSフラグを乱用しないため)
//         // isWaveActive の制御は animateBars に任せる
//         const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
//         updateStatus(`文章を読み上げ中 (プレビュー): 「${display}」`, '#00ffaa');
//         // プレビュー読み上げ中も波形を動かすため、一時的にcurrentWaveColorをポジティブに設定
//         currentWaveColor = WAVE_COLORS.positive;
//     };

//     utterance.onend = () => {
//         currentTextToSpeak = '';
//         setStandbyStatus();
//         currentWaveColor = WAVE_COLORS.default; // 終了したらデフォルトに戻す
//     };

//     utterance.onerror = (event) => {
//         console.error('Speech Synthesis Error:', event);
//         currentTextToSpeak = '';
//         updateStatus('読み上げエラーが発生しました', '#ff0000');
//         currentWaveColor = WAVE_COLORS.default;
//     };

//     synth.speak(utterance);
// }

// /* ---------- Speech Recognition (Browser STT) & Audio Init ---------- */

// function restartRecognition() {
//     isRecording = false;

//     // TTSが動作中でなければ、待機状態に戻す
//     if (!synth.speaking) {
//         setStandbyStatus();
//     }

//     setTimeout(() => {
//         try {
//             // 既に認識が開始されている場合は何もしない
//             if (!isRecording && !synth.speaking && recognition) recognition.start();
//         } catch (e) {
//             if (e.name !== 'InvalidStateError') {
//                 console.warn('Recognition restart failed:', e);
//             }
//         }
//     }, 500);
// }

// function startBrowserRecognition() {
//     if (isRecording) return;

//     if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
//         updateStatus('Error: Speech Recognition not supported in this browser.', '#ff0000');
//         return;
//     }

//     if (recognition) {
//         recognition.stop();
//         recognition = null;
//     }

//     recognition = new (window.webkitSpeechRecognition || window.SpeechRecognition)();
//     recognition.continuous = false;
//     recognition.interimResults = true;
//     recognition.lang = 'ja-JP';

//     recognition.onstart = () => {
//         isRecording = true;
        
//         const standbyMsg = `
//             Listening...
//             話しかけてください...！
//         `;
//         updateStatus(standbyMsg.trim(), '#ffff00');
//         startColorTransition('#ffff00', '#00ffaa', 2000);
//         input.value = '';
//         if (synth.speaking) synth.cancel();
//     };

//     recognition.onresult = (event) => {
//         let interimTranscript = '';
//         let finalTranscript = '';

//         for (let i = event.resultIndex; i < event.results.length; ++i) {
//             if (event.results[i].isFinal) {
//                 finalTranscript += event.results[i][0].transcript;
//             } else {
//                 interimTranscript += event.results[i][0].transcript;
//             }
//         }
//         input.value = finalTranscript || interimTranscript;
//     };
    
//     recognition.onend = () => {
//         isRecording = false;

//         // TTSが動作していない場合に限り isSpeaking は false に (TTSはspeak/speakSentenceで制御)
//         if (!synth.speaking) {
//             currentWaveColor = WAVE_COLORS.default;
//         }

//         const finalPrompt = input.value.trim();

//         if (finalPrompt && finalPrompt.length > 1 && !finalPrompt.startsWith("話しかけてください") && !finalPrompt.startsWith("イマジナリーナンバー 通称GAIイマさんAI応答:")) {
//             updateStatus('Processing response...', '#00ffaa');
//             // LLM処理中にSTTが自動で再起動しないように、.finallyでrestartRecognitionを呼ぶ
//             processRecognitionResult(finalPrompt).finally(() => {
//                 // TTSが終了した後に再起動させる (speak関数内のonendでも実施されるため冗長ではあるが念のため)
//                 if (!synth.speaking) {
//                     restartRecognition();
//                 }
//             });
//         } else {
//             // 発話がなかったか、短すぎた場合
//             input.value = '';
//             restartRecognition();
//         }
//     };

//     recognition.onerror = (event) => {
//         isRecording = false;
//         console.error('Speech Recognition Error:', event.error);

//         if (event.error !== 'not-allowed' && event.error !== 'aborted') {
//             restartRecognition();
//         } else if (event.error === 'aborted') {
//             restartRecognition();
//         } else {
//             updateStatus('Error: Microphone permission denied or failed.', '#ff0000');
//         }
//     };

//     try {
//         recognition.start();
//     } catch (e) {
//         console.warn('Initial recognition start failed:', e);
//     }
// }

// async function initAudioAndSTT() {
//     if (analyser) {
//         startBrowserRecognition();
//         return;
//     }
//     updateStatus('Requesting microphone access...');

//     try {
//         audioContext = new (window.AudioContext || window.webkitAudioContext)();
//         analyser = audioContext.createAnalyser();
//         analyser.fftSize = 2048;

//         dataArray = new Uint8Array(analyser.frequencyBinCount);

//         mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
//         const sourceNode = audioContext.createMediaStreamSource(mediaStream);

//         sourceNode.connect(analyser);

//         startBrowserRecognition();

//         updateStatus('Listening...', '#ffff00');
//     } catch (e) {
//         console.error('Audio initialization failed:', e);
//         updateStatus('Error: Microphone access denied or failed to initialize.', '#ff0000');
//     }
// }

// /**
//  * FastAPI/MQTTバックエンドにコマンドを送信する関数
//  */
// async function sendIoTCommand(command) {
//     updateStatus(`Executing IoT command: ${command}...`, '#00ffaa');

//     try {
//         const response = await fetch(MQTT_API_URL, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ command: command })
//         });

//         const data = await response.json();

//         if (response.ok) {
//             const successMsg = `承知しました。${command === 'ON' ? '電気をつけました' : '電気を消しました'}。`;
//             speak(successMsg);
//         } else {
//             const detail = data.detail || "サーバーエラー";
//             const errorMsg = `エラーが発生しました。IoTコマンド '${command}' の実行に失敗しました。詳細: ${detail}`;
//             speak(errorMsg);
//         }
//     } catch (error) {
//         const networkErrorMsg = `🔴 ネットワークエラー: IoTバックエンドサーバーに接続できません (${error.message})`;
//         speak(networkErrorMsg);
//     }
// }

// /* ---------- 統合されたメイン処理関数 (IoT or LLM) ---------- */

// async function processRecognitionResult(finalPrompt) {
//     // 1. IoTコマンドの判定と振り分け
//     const lowerPrompt = finalPrompt.toLowerCase();
//     let iotCommand = null;

//     if ((lowerPrompt.includes('ライト') || lowerPrompt.includes('電気')) && (lowerPrompt.includes('つけ') || lowerPrompt.includes('オン') || lowerPrompt.includes('点け'))) {
//         iotCommand = 'ON';
//     } else if ((lowerPrompt.includes('ライト') || lowerPrompt.includes('電気')) && (lowerPrompt.includes('けし') || lowerPrompt.includes('オフ') || lowerPrompt.includes('消し'))) {
//         iotCommand = 'OFF';
//     }

//     if (iotCommand) {
//         await sendIoTCommand(iotCommand);
//         return;
//     }

//     // 2. LLM応答生成（IoTコマンドでなかった場合）
//     await generateAndSpeakResponse(finalPrompt);
// }

// /* ---------- LLM (Gemini) API & TTS 連携 ---------- */

// async function generateAndSpeakResponse(prompt) {
//     updateStatus('Generating response (via FastAPI)...', '#00ffaa');

//     // ユーザープロンプトから不要なプレフィックスを除去（念のため）
//     const cleanedPrompt = prompt.replace(/^イマジナリーナンバー 通称GAIイマさんAI応答:\s*/, '').trim();
//     if (!cleanedPrompt) {
//         speak("すみません、何も聞こえませんでした。もう一度話しかけてください。");
//         return;
//     }

//     const systemInstruction = "あなたは「イマジナリーナンバー 通称GAIイマさん」という名前のKS-903model8800-a1-90dという音声アシスタントです。ユーザーの質問に日本語で、簡潔かつ丁寧に答えてください。";

//     const payload = {
//         prompt: cleanedPrompt,
//         contents: [{ parts: [{ text: cleanedPrompt }] }],
//         systemInstruction: { parts: [{ text: systemInstruction }] },
//         tools: [{ "google_search": {} }],
//     };

//     const MAX_RETRIES = 3;
//     let responseText = "エラーが発生しました。イマジナリーナンバー 通称GAIイマさんAIのKS-903model8800-a1-90d応答を取得できませんでした。";

//     for (let i = 0; i < MAX_RETRIES; i++) {
//         try {
//             const response = await fetch(LLM_API_URL, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(payload)
//             });

//             if (!response.ok) {
//                 const errorData = await response.json().catch(() => ({ detail: `HTTP ${response.status} Error.` }));
//                 throw new Error(`FastAPI Error! Status: ${response.status}. Detail: ${errorData.detail}`);
//             }

//             const result = await response.json();

//             if (result && result.text) {
//                 responseText = result.text;
//                 break;
//             } else {
//                 throw new Error("Empty response or invalid JSON structure from FastAPI.");
//             }

//         } catch (e) {
//             console.error(`FastAPI call error on attempt ${i + 1}:`, e);
//             if (i === MAX_RETRIES - 1) {
//                 responseText = "エラーが発生しました。イマジナリーナンバー 通称GAIイマさんAIKS-903model8800-a1-90dの応答を取得できませんでした。Generaltebバックエンドサーバー (ポート8001) の実行状態とAPIキーを確認してください。";
//             } else {
//                 const delay = 2 ** i * 1000 + Math.random() * 500;
//                 await new Promise(resolve => setTimeout(resolve, delay));
//             }
//         }
//     }

//     updateStatus('Speaking response...', '#00ffaa');
//     speak(responseText);

//     return Promise.resolve();
// }

// /* ---------- イベントハンドラの統合と定義 ---------- */

// // テキスト入力欄のイベントを追加 (Enterキーで処理)
// input.addEventListener('keydown', (e) => {
//     if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
//         e.preventDefault();

//         // ★ デバウンスタイマーをクリア (即時実行のため)
//         clearTimeout(debounceTimeout); 
        
//         const textPrompt = input.value.trim();

//         if (textPrompt) {
//             if (recognition && isRecording) {
//                 recognition.stop();
//             }
//             if (synth.speaking) synth.cancel();

//             updateStatus('Processing text input...', '#ffff00');

//             // LLM処理を実行
//             processRecognitionResult(textPrompt).catch(error => {
//                 console.error("Text input processing failed:", error);
//             });
//         }
//     }
// });

// // テキスト入力のたびに現在の内容を読み上げる機能の追加 (TTS即時プレビュー)
// input.addEventListener('input', (event) => {
//     const currentText = input.value.trim();

//     // デバウンス処理を開始/リセット
//     clearTimeout(debounceTimeout);

//     if (currentText.length > 0) {
//         // 1000ms (1秒) のデバウンスをかける
//         debounceTimeout = setTimeout(() => {
//             // 音声認識が実行中でない、かつ、AIが応答中でない場合にのみ実行
//             // isSpeakingはTTS全体で利用されているため、ここではsynth.speakingで確認
//             if (!isRecording && !synth.speaking && currentText !== currentTextToSpeak) {
//                 speakSentence(currentText);
//             }
//         }, 1000);
//     } else if (currentText.length === 0 && synth.speaking) {
//         // テキストが全て削除され、かつ読み上げ中の場合はキャンセルして待機状態に戻す
//         synth.cancel();
//         setStandbyStatus();
//         currentWaveColor = WAVE_COLORS.default;
//         currentTextToSpeak = '';
//     }
// });

// // リセットボタンの機能 (STTとTTSの強制停止と再起動)
// sendBtn.addEventListener("click", () => {
//     if (recognition) {
//         recognition.stop();
//         recognition = null;
//         isRecording = false;
//     }
//     if (synth.speaking) synth.cancel();

//     isSpeaking = false;
//     currentWaveColor = WAVE_COLORS.default;
//     clearTimeout(debounceTimeout); // リセット時にもデバウンスをクリア
//     initAudioAndSTT();
//     updateStatus('リセットしました。マイク入力を開始しています...');
// });
// // UI トグル機能 (画面タップ)
// let uiVisible = true;
// tapArea.addEventListener('click', (e) => {
//     // リセットボタンへのタップは無視
//     if (e.target.closest('#input-controls')) {
//         return;
//     }
//     uiVisible = !uiVisible;
//     if (uiVisible) {
//         ui.style.opacity = 1;
//     } else {
//         ui.style.opacity = 0;
//     } });*/
