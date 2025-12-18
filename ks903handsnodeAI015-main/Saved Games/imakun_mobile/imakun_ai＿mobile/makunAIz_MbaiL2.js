/* --------------------------------------------------------------------------------- */
/* 0. DOM要素・定数・状態変数の定義 */
/* --------------------------------------------------------------------------------- */

// DOM要素の取得
const canvas = document.getElementById("waveCanvas");
const ctx = canvas.getContext("2d");
const statusArea = document.getElementById("status-area");
const sendBtn = document.getElementById("sendBtn");
const input = document.getElementById("messageInput");
const tapArea = document.getElementById('tapArea');

// Audio/Canvas 定数と変数
let bars = [];
const BAR_COUNT = 40;
const BAR_WIDTH = 8;
let dataArray;
let audioContext, analyser, mediaStream;

// 状態フラグとアニメーションID
let animationFrameId;
let transitionFrameId;
let isSpeaking = false;     // TTS (AI応答) のアクティブ状態
let isRecording = false;    // STT (ユーザー入力) のアクティブ状態
let currentTextToSpeak = '';
let debounceTimeout;

// API設定
const LLM_API_URL = "https://atjmuwnwmtjw-hello.hf.space/llm/generate";
const MQTT_API_URL = "https://atjmuwnwmtjw-hello.hf.space/iot/control";

// STT インスタンス
const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
let recognition = null;
let lastFinalTranscript = ''; // 確定した最新の発話結果を保持

/* --------------------------------------------------------------------------------- */
/* 1. Canvasアニメーションとレスポンシブ対応 */
/* --------------------------------------------------------------------------------- */

// 【色の定義】感情に応じた色と、レインボーアニメーション用の色相変数
const WAVE_COLORS = {
    default: 'rgba(50, 200, 255, 0.7)',
    positive: 'rgba(50, 255, 50, 0.7)',
    anger: 'rgba(255, 50, 50, 0.7)',
    rage: 'rgba(150, 50, 255, 0.7)',
    negative: 'rgba(50, 100, 255, 0.7)',
    sadness: 'rgba(0, 0, 150, 0.7)'
};
let currentWaveColor = WAVE_COLORS.default;
let rainbowHue = 0;

// ステータスエリアの色遷移配列
const STATUS_TRANSITION_COLORS = [
    '#32CD32', '#ADFF2F', '#FFA500', '#FF4500', 
    '#8A2BE2', '#00008B', '#00FFFF', '#FFFF00'
];

/**
 * HEXをRGB配列に変換
 */
function hexToRgb(hex) {
    if (typeof hex !== 'string') return [255, 255, 255];
    const color = hex.startsWith('#') ? hex.slice(1) : hex;
    let bigint;

    if (color.length === 3) {
        bigint = parseInt(color.split('').map(c => c + c).join(''), 16);
    } else if (color.length === 6) {
        bigint = parseInt(color, 16);
    } else {
        return [255, 255, 255];
    }
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

/**
 * RGB値をHEX文字列に変換
 */
function rgbToHex(r, g, b) {
    const toHex = (c) => ('0' + Math.max(0, Math.min(255, c)).toString(16)).slice(-2);
    return '#' + toHex(Math.round(r)) + toHex(Math.round(g)) + toHex(Math.round(b));
}

/**
 * 連続色遷移アニメーションを開始 (ステータスエリア用)
 */
function startSequentialColorTransition(colors, segmentDuration = 500) {
    if (transitionFrameId) cancelAnimationFrame(transitionFrameId);
    
    const startTime = performance.now();
    const numSegments = colors.length;

    function animate(currentTime) {
        if (!isSpeaking) { // TTSが終了したら停止
            stopSequentialColorTransition();
            return;
        }

        const elapsed = currentTime - startTime;
        const totalDuration = numSegments * segmentDuration;
        const progress = (elapsed % totalDuration) / totalDuration;
        const currentSegmentIndex = Math.floor(progress * numSegments);
        const nextSegmentIndex = (currentSegmentIndex + 1) % numSegments;
        const segmentProgress = (elapsed % segmentDuration) / segmentDuration;

        const startRgb = hexToRgb(colors[currentSegmentIndex]);
        const endRgb = hexToRgb(colors[nextSegmentIndex]);

        // 補間
        const r = startRgb[0] + (endRgb[0] - startRgb[0]) * segmentProgress;
        const g = startRgb[1] + (endRgb[1] - startRgb[1]) * segmentProgress;
        const b = startRgb[2] + (endRgb[2] - startRgb[2]) * segmentProgress;

        const currentColor = rgbToHex(r, g, b);

        statusArea.style.color = currentColor;
        statusArea.style.boxShadow = `0 0 20px ${currentColor}80`;

        transitionFrameId = requestAnimationFrame(animate);
    }
    animate(startTime);
}

/**
 * 連続色遷移アニメーションを停止
 */
function stopSequentialColorTransition() {
    if (transitionFrameId) {
        cancelAnimationFrame(transitionFrameId);
        transitionFrameId = null;
    }
}

/**
 * バーのデータを再計算し、中央に配置
 */
function createBars() {
    bars = [];
    const startX = canvas.width / 2 - (BAR_COUNT * BAR_WIDTH) / 2;
    for (let i = 0; i < BAR_COUNT; i++) {
        bars.push({ x: startX + i * BAR_WIDTH, height: 10, color: "#00ffff" });
    }
}

/**
 * Canvasサイズをウィンドウにフィットさせ、バーを再計算
 */
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    createBars();
}

/**
 * バーをアニメーションさせて描画するメインループ
 */
function animateBars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isWaveActive = isSpeaking || isRecording;

    if (analyser && dataArray && isRecording) {
        // 録音中のみ周波数データを取得
        analyser.getByteFrequencyData(dataArray);
    }

    let barColor = currentWaveColor;

    // レインボーモードの場合、動的に色を計算
    if (currentWaveColor === 'rainbow' && isWaveActive) {
        rainbowHue = (rainbowHue + 3) % 360;
        barColor = `hsla(${rainbowHue}, 100%, 70%, 0.9)`;
    }

    ctx.fillStyle = barColor;
    const currentWaveY = canvas.height / 2;

    bars.forEach((bar, i) => {
        let height = 10;

        if (isWaveActive) {
            if (isRecording && dataArray) {
                // STT中 (ユーザーの音声入力)
                const dataIndex = Math.floor(i * (dataArray.length / BAR_COUNT));
                const rawHeight = dataArray[dataIndex] || 0;
                height = (rawHeight / 255) * 200 + 5;
            } else if (isSpeaking) {
                // TTS中 (AI応答) またはプレビュー中
                const waveAmplitude = 100;
                const waveFrequency = 0.05;
                const waveOffset = Math.sin(Date.now() * 0.005 + i * waveFrequency) * waveAmplitude;
                height = 10 + Math.abs(waveOffset);
            }
        }

        bars[i].height = height;

        // 描画
        ctx.fillRect(bar.x, currentWaveY - height / 2, BAR_WIDTH - 2, height);
    });

    animationFrameId = requestAnimationFrame(animateBars);
}

/* --------------------------------------------------------------------------------- */
/* 2. 感情・色判定ロジック */
/* --------------------------------------------------------------------------------- */

/**
 * LLM応答から絵文字を抽出
 */
const extractEmojis = (text) => {
    const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\p{Emoji_Modifier}*|\p{Emoji_Component}|\u200d/gu;
    const matches = text.match(emojiRegex);
    return matches ? matches.join('') : '';
};

/**
 * AIの回答テキストに基づいて波形の色を変更する関数
 * @param {string} responseText LLMからの回答テキスト
 */
function setWaveColorBasedOnResponse(responseText) {
    const text = responseText.toLowerCase();

    const checkKeywords = (keywords, emojis, color, emotion) => {
        if (keywords.some(k => text.includes(k)) || emojis.some(e => text.includes(e))) {
            currentWaveColor = color;
            console.log(`波形の色を【${emotion}】の${color === 'rainbow' ? 'レインボー' : color}に変更しました。`);
            return true;
        }
        return false;
    };

    // 1. 本気の怒り・裏切り (紫)
    if (checkKeywords(['裏切り', '許さない', '報復', '絶交', '失望'], ['😡', '😠', '🤬', '👿', '💀', '🔪'], WAVE_COLORS.rage, '本気の怒り')) return;

    // 2. お怒り (赤)
    if (checkKeywords(['怒り', 'ふざけるな', 'やめろ', '不可能だ', '違います', '否定', 'ありえない'], ['😤', '💢', '🔥', '💥', '👹'], WAVE_COLORS.anger, 'お怒り')) return;

    // 3. 悲しい・号泣 (濃いブルー)
    if (checkKeywords(['悲しい', '泣く', 'ごめんなさい', 'つらい', '寂しい', '涙', '最悪', 'お詫び申し上げます', '申し訳ございませんでした', 'お悔やみ申し上げます'], ['😭', '😢', '🥺', '💧', '💔', '🙇'], WAVE_COLORS.sadness, '悲しい')) return;

    // 4. ネガティブ (ブルー)
    if (checkKeywords(['エラー', '失敗', 'できません', '警告', '問題', '懸念', '不明', '無理', '難しい', 'すみません', '出来かねます'], ['😞', '😟', '😨', '🥶', '😰', '😵', '🙏'], WAVE_COLORS.negative, 'ネガティブ')) return;

    // 5. 最高にハッピー (レインボー)
    if (checkKeywords(['最高にハッピー', '神', '究極', 'パーフェクト', '完璧', '奇跡', '感無量', 'レジェンド'], ['🤩', '✨', '🥳', '💯', '👑', '🥇', '🚀', '🌈', '🎉'], 'rainbow', '最高にハッピー')) return;

    // 6. ポジティブ (緑)
    if (checkKeywords(['ありがとう', '成功', '完了', '問題ありません', '良い', 'できます', '素晴らしい', '助かる', '了解', 'OK', 'ハッピー'], ['😄', '😊', '😆', '👍', '👏', '✅', '🌟'], WAVE_COLORS.positive, 'ポジティブ')) return;

    // デフォルト
    currentWaveColor = WAVE_COLORS.default;
    console.log("波形の色をデフォルトの水色に戻しました。");
}

/* --------------------------------------------------------------------------------- */
/* 3. 機密保持/開発者ツールの無効化 */
/* --------------------------------------------------------------------------------- */
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
});

document.onkeydown = function (e) {
    const key = e.key;
    const lowerKey = key.toLowerCase();
    const isCmdOrCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const isAltOrOption = e.altKey;

    // F12キー (開発者ツール)
    if (key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        return false;
    }

    // 開発者ツールのショートカット (I, J, C)
    if (isCmdOrCtrl && isShift && (lowerKey === 'i' || lowerKey === 'j' || lowerKey === 'c')) {
        e.preventDefault();
        return false;
    }

    // その他、コンテンツ保護のためのショートカット (U:ソース表示, S:保存, P:印刷)
    if (isCmdOrCtrl && (lowerKey === 'u' || lowerKey === 's' || lowerKey === 'p')) {
        e.preventDefault();
        return false;
    }
};

/* --------------------------------------------------------------------------------- */
/* 4. 音声読み上げ/認識/API連携関連 */
/* --------------------------------------------------------------------------------- */

// --- UI helpers ---

function updateStatus(message, color = '#00ffff') {
    statusArea.innerHTML = message;
    statusArea.style.color = color;
    statusArea.style.boxShadow = `0 0 20px ${color}80`;
}

function setStandbyStatus() {
    stopSequentialColorTransition(); // 待機時はアニメーション停止
    const standbyMsg = `
        イマジナリーナンバー
        通称GAIイマさんAI
        AIアシスタント待機中...
        (モバイルでは画面タップで開始)
    `;
    updateStatus(standbyMsg.trim(), '#00ffff');
}

// --- TTS (Speech Synthesis) ---

/**
 * LLM応答など、AIからの正式な応答を読み上げ、終了後にSTTを再起動する
 */
function speak(text) {
    if (!text || window.speechSynthesis.speaking) return;

    // STTが動作中であれば強制停止し、状態を更新
    if (recognition && isRecording) {
        recognition.stop();
        // onendが呼ばれるが、isSpeaking=trueで状態は上書きされる
    }
    isSpeaking = true;
    currentTextToSpeak = text;
    setWaveColorBasedOnResponse(text); // 波形の色を設定

    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 1.0;

    u.onstart = () => {
        startSequentialColorTransition(STATUS_TRANSITION_COLORS, 500); // ステータス色アニメーション開始
        const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
        const onlyEmojis = extractEmojis(text);
        
        const formattedStatus = `
        ---==(_____[　イマジナリーナンバー通称GAIイマさんAI応答: ?&!! ${onlyEmojis}　]_____)==--- __(V._.V)__
                      「${display}」
        `;
        statusArea.innerHTML = formattedStatus.trim();
    };
    
    u.onend = () => {
        isSpeaking = false;
        currentWaveColor = WAVE_COLORS.default;
        currentTextToSpeak = '';
        input.value = '';
        
        // 状態を待機に戻し、STTをリセットまたは再開
        setStandbyStatus(); 
        
        // TTS終了後、STTを再開（recognition=nullの状態を回避）
        if (!recognition) {
            initAudioAndSTT(); // マイクの再初期化も含めて実行
        } else {
             try { recognition.start(); } catch (e) { /* ignore */ }
        }
    };
    u.onerror = (e) => {
        console.error('TTS error:', e);
        isSpeaking = false;
        currentWaveColor = WAVE_COLORS.default;
        setStandbyStatus();
        input.value = '';
    };

    window.speechSynthesis.speak(u);
}

/**
 * テキスト入力時の即時プレビュー用読み上げ関数
 */
function speakSentence(text) {
    if (text.trim() === '' || isRecording || currentTextToSpeak === text) return;
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();

    isSpeaking = true; // プレビュー中も波形を動かす
    currentTextToSpeak = text;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;

    utterance.onstart = () => {
        const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
        updateStatus(`文章を読み上げ中 (プレビュー): 「${display}」`, '#00ffaa');
        currentWaveColor = WAVE_COLORS.positive;
    };

    utterance.onend = () => {
        isSpeaking = false;
        currentTextToSpeak = '';
        currentWaveColor = WAVE_COLORS.default;
        setStandbyStatus();
    };

    utterance.onerror = (event) => {
        console.error('Speech Synthesis Error:', event);
        isSpeaking = false;
        currentTextToSpeak = '';
        currentWaveColor = WAVE_COLORS.default;
        updateStatus('読み上げエラーが発生しました', '#ff0000');
    };

    window.speechSynthesis.speak(utterance);
}

// --- Speech Recognition (Browser STT) & Audio Init ---

/**
 * Speech Recognitionを開始/再開する
 */
function startBrowserRecognition() {
    if (isRecording || isSpeaking || !SpeechRecognition) return;

    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            /* ignore stop error */
        }
        recognition = null;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ja-JP';

    let currentTranscript = '';

    recognition.onstart = () => {
        isRecording = true;
        lastFinalTranscript = '';
        currentTranscript = '';
        
        const standbyMsg = `
            Listening...
            話しかけてください...！
        `;
        updateStatus(standbyMsg.trim(), '#ffff00');
        // STT開始時の色遷移アニメーション (黄→緑)
        statusArea.style.boxShadow = `0 0 20px #ffff0080`;
        // startColorTransition('#ffff00', '#00ffaa', 2000); // 長いためコメントアウト
        input.value = '';
        if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    };

    recognition.onresult = (event) => {
        currentTranscript = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            currentTranscript += transcript;
            if (event.results[i].isFinal) {
                final += transcript;
            }
        }
        
        input.value = final || currentTranscript;
        if (final) {
            lastFinalTranscript = final; // 確定した結果を保持
        }
    };

    recognition.onend = () => {
        isRecording = false;

        if (isSpeaking) return; // TTSがすぐに始まる場合は、この後の処理はspeak.onendに任せる

        currentWaveColor = WAVE_COLORS.default;
        
        let promptToProcess = lastFinalTranscript || input.value.trim();
        
        // 有効な発話があったか判定
        if (promptToProcess && promptToProcess.length > 1 && !/話しかけてください|イマジナリーナンバー/.test(promptToProcess)) {
            updateStatus('Processing response...', '#00ffaa');
            // LLM処理を実行
            processRecognitionResult(promptToProcess).finally(() => {
                // LLM処理後、TTSが動いていなければ完全にリセット
                if (!isSpeaking) {
                    recognition = null; // 次回タップまたは speak.onend で再初期化を待つ
                    setStandbyStatus();
                }
            });
        } else {
            // 発話がなかったか、短すぎた場合
            input.value = '';
            recognition = null; // リセット
            setStandbyStatus();
        }
    };

    recognition.onerror = (event) => {
        isRecording = false;
        console.error('Speech Recognition Error:', event.error);
        
        // 許可拒否以外のエラーや、終了を意味するエラーの場合、インスタンスをリセット
        if (event.error !== 'not-allowed' && event.error !== 'audio-capture') {
            recognition = null;
        }
        
        if (!isSpeaking) {
            setStandbyStatus();
        }
    };

    try {
        recognition.start();
    } catch (e) {
        console.warn('Recognition start failed:', e);
    }
}

/**
 * AudioContextとAnalyserを初期化し、STTを開始する (モバイルタップ対応)
 */
async function initAudioAndSTT() {
    if (analyser) {
        // Audioが既に初期化されていれば、STTのみ開始
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

        // AudioContextの初期化が成功したらSTTを開始
        startBrowserRecognition();
    } catch (err) {
        console.error('Microphone access denied or error:', err);
        updateStatus('Error: Microphone access denied or unsupported.', '#ff0000');
    }
}

// --- LLM API Call Simulation ---

/**
 * LLMへのプロンプト送信をシミュレートする関数
 */
async function processRecognitionResult(prompt) {
    // 応答のシミュレーション（感情判定のテスト用）
    const simulatedResponses = [
        "裏切りは許さない。これは報復です。", // rage
        "すみません、その情報は確認できませんでした。大変申し訳ございませんでした。", // sadness (謝罪優先)
        "ありがとうございます！成功しました。", // positive
        "最高にハッピーです！パーフェクト！🎉🎉🎉", // rainbow
        "ふざけるな！そんな要求はありえない！", // anger
        "このデータは不明です。確認が必要です。", // negative
        "現在の時刻は午後1時1分です。" // default
    ];
    const randomIndex = Math.floor(Math.random() * simulatedResponses.length);
    const responseText = simulatedResponses[randomIndex];

    // ダミーのAPI呼び出しの遅延をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1500));

    // LLM応答をTTSで読み上げ
    speak(responseText);

    // 実際のAPIロジックではここに fetch() が入る
    // const response = await fetch(LLM_API_URL, { ... });
    // const responseText = await response.text();
    // speak(responseText);
}

/* --------------------------------------------------------------------------------- */
/* 5. イベントリスナーと初期化 */
/* --------------------------------------------------------------------------------- */

// 初期化処理
window.addEventListener("load", () => {
    resizeCanvas();
    animateBars();
    setStandbyStatus();
    document.getElementById('ui').style.opacity = 1;
    // 初回ロード時は STT/Audio の自動起動は行わず、タップを待つ
});

// リサイズ対応
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => {
    setTimeout(resizeCanvas, 300);
});

// モバイルでのSTT開始トリガー
tapArea.addEventListener('click', () => {
    // TTSが動作しておらず、STTがアクティブでない場合のみ開始
    if (!isRecording && !isSpeaking) {
        initAudioAndSTT();
    }
});

// エンターキー/送信ボタンによるLLM呼び出し
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendBtn.click();
    }
});

sendBtn.addEventListener('click', async () => {
    const prompt = input.value.trim();
    if (!prompt || isSpeaking || isRecording) return;

    // STTが動作中であれば強制停止
    if (recognition) {
        recognition.stop(); 
        recognition = null; 
    }

    updateStatus('Processing response...', '#00ffaa');
    await processRecognitionResult(prompt).finally(() => {
        // LLM処理後、TTSが動いていなければ待機状態に戻す
        if (!isSpeaking) {
            setStandbyStatus();
        }
    });
});

// input.onkeyup イベントハンドラ (デバウンスによるプレビュー読み上げ)
input.addEventListener('keyup', () => {
    clearTimeout(debounceTimeout);
    const text = input.value.trim();
    debounceTimeout = setTimeout(() => {
        if (text) {
             speakSentence(text);
        } else {
            if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
            setStandbyStatus();
        }
    }, 2000); 
});
