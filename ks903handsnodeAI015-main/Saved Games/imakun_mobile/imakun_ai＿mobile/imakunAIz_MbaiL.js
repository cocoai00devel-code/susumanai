
/* ----------- スマホ回転時にもCanvasをフィットさせる ----------- */
function resizeCanvas() {
    const canvas = document.getElementById("waveCanvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    createBars(); // サイズ変更時にバーを再計算
}

window.addEventListener("load", resizeCanvas);
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => {
    setTimeout(resizeCanvas, 300); // 回転後の値が安定してから再計算
});

/* ---------- Canvasアニメーション関連 ---------- */
const canvas = document.getElementById("waveCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let rainbowHue = 0; // レインボーアニメーション用の色相を保持
let bars = [];      // バーのデータを保持する配列
const barCount = 100; // バーの数（任意の数値）
const barWidth = 8; // バーの幅（任意の数値）

let animationFrameId;
let isSpeaking = false; 
let isRecording = false; 

// 現在の波形の色を保持する変数
let currentWaveColor = 'rgba(50, 200, 255, 0.7)';


const WAVE_COLORS = {
    // デフォルト: 水色
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

/**
 * AIの回答テキストに基づいて波形の色を変更する関数 (柔軟なキーワード＆絵文字対応)
 * @param {string} responseText LLMからの回答テキスト
 */
function setWaveColorBasedOnResponse(responseText) {
    const text = responseText.toLowerCase();

    // 1. 【本気の怒り・裏切り (紫)】：最も深刻なキーワードを優先
    const rageKeywords = ['裏切り', '許さない', '報復', 'どうしてくれる', '絶交', '失望'];
    const rageEmojis = ['😡', '😠', '🤬', '👿', '😾', '💀', '🔪', '💣']; 
    if (rageKeywords.some(k => text.includes(k)) || rageEmojis.some(e => text.includes(e))) {
        currentWaveColor = WAVE_COLORS.rage; 
        console.log("波形の色を【本気の怒り・裏切り】の紫に変更しました。");
        return;
    }

    // 2. 【お怒り (赤)】
    const angerKeywords = ['怒り', 'ふざけるな', 'やめろ', 'だめだ', '不可能だ', '違います', '否定', 'ありえない'];
    const angerEmojis = ['😤', '💢', '🔥', '💥', '👹', '😫', '😩']; 
    if (angerKeywords.some(k => text.includes(k)) || angerEmojis.some(e => text.includes(e))) {
        currentWaveColor = WAVE_COLORS.anger; 
        console.log("波形の色を【お怒り】の赤に変更しました。");
        return;
    }

    // 3. 【悲しい・号泣 (濃いブルー)】
    const sadnessKeywords = ['悲しい', '泣く', 'ごめんなさい', 'つらい', '寂しい', '涙', '耐えられない', '最悪', 'しんどい'];
    const sadnessEmojis = ['😭', '😢', '🥺', '💧', '😥', '💔', '🌧️', '☔']; 
    if (sadnessKeywords.some(k => text.includes(k)) || sadnessEmojis.some(e => text.includes(e))) {
        currentWaveColor = WAVE_COLORS.sadness; 
        console.log("波形の色を【悲しい・号泣】の濃いブルーに変更しました。");
        return;
    }

    // 4. 【ネガティブ (ブルー)】
    const negativeKeywords = ['エラー', '失敗', 'できません', '警告', '問題', '懸念', '不明', '無理', '難しい'];
    const negativeEmojis = ['😞', '😟', '😨', '🥶', '😰', '😵']; 
    if (negativeKeywords.some(k => text.includes(k)) || negativeEmojis.some(e => text.includes(e))) {
        currentWaveColor = WAVE_COLORS.negative; 
        console.log("波形の色を【ネガティブ】のブルーに変更しました。");
        return;
    }
    
    // 5. 【最高にハッピー (レインボー)】
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

/**
 * 棒グラフの初期化/再計算
 */
function createBars() {
    bars = [];
    const startX = canvas.width / 2 - (barCount * barWidth) / 2;
    for (let i = 0; i < barCount; i++) {
        bars.push({
            x: startX + i * barWidth,
            height: 10,
            // color: "#00ffff" // 固定色は使用しないため削除
        });
    }
}

/**
 * 棒グラフの描画
 */
function drawBars() {
    // 【修正点3: 描画時に最新の中央位置を計算】
    const currentWaveY = canvas.height / 2;
    
    // 描画色を決定するロジック
    let barColor = currentWaveColor;
    
    // レインボーモードの場合、動的に色を計算
    if (currentWaveColor === 'rainbow') {
        // drawWave()の代わりにここで色相を変化させる
        rainbowHue = (rainbowHue + 3) % 360; // 3度ずつ色相を変化
        // HSL形式で色相を変化させ、レインボー効果を適用
        barColor = `hsla(${rainbowHue}, 100%, 70%, 0.9)`; 
    } else if (currentWaveColor.startsWith('rgba(')) {
        // rgba形式（透明度付き）の単色
        barColor = currentWaveColor;
    }
    
    // 決定した色を塗りつぶし色として設定
    ctx.fillStyle = barColor;
    
    bars.forEach(bar => {
        // 全てのバーで、動的に設定された同じ barColor が使われます
        ctx.fillRect(bar.x, currentWaveY - bar.height / 2, barWidth - 2, bar.height); 
    });
}

/**
 * アニメーションループ（波形アニメーション）
 */
function animateBars() {
    // 【修正点4: canvas.clearRectをアニメーションの最初に配置】
    ctx.clearRect(0, 0, canvas.width, canvas.height); 

    if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        
        const currentWaveY = canvas.height / 2;
        const barStep = Math.floor(dataArray.length / barCount);
        
        for (let i = 0; i < barCount; i++) {
            // 周波数データから高さを計算
            const barHeight = dataArray[i * barStep] * (canvas.height / 255);
            
            // 描画するバーの高さにスムーズに遷移させる
            // 既存の高さと新しい高さの間を補間
            bars[i].height = bars[i].height * 0.9 + barHeight * 0.1;

            // 振幅の減衰処理（発話がない場合）
            if (!isRecording && !isSpeaking) {
                // 静止状態に戻すように、高さをわずかに減少させる
                bars[i].height *= 0.98;
                if (bars[i].height < 10) bars[i].height = 10; // 最小のベースラインを維持
            }
        }
    } else {
         // アナライザがない場合、静的なバーを維持
         bars.forEach(bar => {
            bar.height = bar.height * 0.9 + 10 * 0.1; // ベースラインに戻るアニメーション
            if (bar.height < 10) bar.height = 10;
        });
    }

    drawBars(); // 棒グラフの描画
    animationFrameId = requestAnimationFrame(animateBars);
}

// 初期化とアニメーション開始
createBars();
animateBars();

/* --- 2.機密保持/開発/コードを開く関連 --- */

/* ============================================== */
/* 開発者ツールと右クリックの無効化        */
/* ============================================== */

// 1. 右クリック（コンテキストメニュー）を禁止する
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    console.log("右クリックは禁止されています。");
    return false;
});

document.body.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
});

// 2. キーボードショートカットを禁止する

document.onkeydown = function(e) {
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

    // --- 開発者ツールのショートカット (I, J, C) ---
    
    // Ctrl/Cmd + Shift + I/J/C
    if (isCmdOrCtrl && isShift && (lowerKey === 'i' || lowerKey === 'j' || lowerKey === 'c')) {
        e.preventDefault();
        return false;
    }
    
    // Cmd + Option + I/J/C (macOSの一般的な検証ショートカット)
    if (e.metaKey && isAltOrOption && (lowerKey === 'i' || lowerKey === 'j' || lowerKey === 'c')) {
        e.preventDefault();
        return false;
    }

    // --- その他、コンテンツ保護のためのショートカット ---

    // Ctrl/Cmd + U (ソース表示)
    if (isCmdOrCtrl && lowerKey === 'u') {
        e.preventDefault();
        return false;
    }
    
    // Ctrl/Cmd + S (保存)
    if (isCmdOrCtrl && lowerKey === 's') { 
        e.preventDefault();
        return false;
    }
    
    // Ctrl/Cmd + P (印刷)
    if (isCmdOrCtrl && lowerKey === 'p') {
        e.preventDefault();
        return false;
    }
};

/* --- 2. 音声読み上げ/認識/API連携関連 --- */

// DOM要素の取得
const statusArea = document.getElementById("status-area");
const sendBtn = document.getElementById("sendBtn"); 
const input = document.getElementById("messageInput"); 
const transcriptBox = document.getElementById('transcript');
const ui = document.getElementById('ui'); 
const tapArea = document.getElementById('tapArea'); 

// API設定 (ご自身の環境に合わせて変更してください)
const API_KEY = ""; 
// const LLM_API_URL = "http://127.0.0.1:8001/generate";
// const MQTT_API_URL = "http://127.0.0.1:8000/control"; 
const LLM_API_URL = "https://atjmuwnwmtjw-hello.hf.space/llm/generate";
const MQTT_API_URL = "https://atjmuwnwmtjw-hello.hf.space/iot/control"; 

// 状態管理変数
const synth = window.speechSynthesis;
let audioContext, analyser, mediaStream;
let recognition = null; 
let currentTextToSpeak = ''; 

// --- ヘルパー関数 (色の補間) ---
function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
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
    const startTime = performance.now();
    
    // #RGB または RGBA から 16進数への変換が必要
    const tempElement = document.createElement('div');
    tempElement.style.color = startColor;
    document.body.appendChild(tempElement);
    const startRgbColor = window.getComputedStyle(tempElement).color;
    tempElement.style.color = endColor;
    const endRgbColor = window.getComputedStyle(tempElement).color;
    document.body.removeChild(tempElement);
    
    const parseRgb = (rgb) => {
        const match = rgb.match(/\d+/g);
        return match ? [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])] : [0, 0, 0];
    };
    
    const startRgb = parseRgb(startRgbColor);
    const endRgb = parseRgb(endRgbColor);

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
    const standbyMsg = `
    イマジナリーナンバー<br>
    通称GAIイマさんAI<br>
    AIアシスタント待機中...
    `;
    updateStatus(standbyMsg.trim(), '#00ffff');
    currentWaveColor = WAVE_COLORS.default; // 波形の色もデフォルトに戻す
}

/* ---------- TTS (Speech Synthesis) ---------- */

// 【外部定義】絵文字抽出関数 
const extractEmojis = (text) => {
    // 最新のブラウザ・環境向け
    const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\p{Emoji_Modifier}*|\p{Emoji_Component}|\u200d/gu;
    const matches = text.match(emojiRegex);
    return matches ? matches.join('') : '';
};


function speak(text){ 
    if(!text) return; 
    
    currentTextToSpeak = text; 
    
    if(synth.speaking) synth.cancel(); 
    
    isSpeaking = true; 
    
    // LLM応答に応じて波形の色を設定
    setWaveColorBasedOnResponse(text);

    const u = new SpeechSynthesisUtterance(text); 
    u.lang='ja-JP'; 
    u.rate=1.0; 

    // u.onstart イベントハンドラを修正
    u.onstart=()=>{ 
        // 1. 表示用のテキストを切り出す 
        const display = text.length > 20 ? text.substring(0, 20) + '...' : text;

        // 2. 絵文字のみを抽出する
        const onlyEmojis = extractEmojis(text); 

        // 3. formattedStatusに絵文字を含めて表示する 
        const formattedStatus = `
    ---==(_____[　イマジナリーナンバー通称GAIイマさんAI応答:  ?&!! ${onlyEmojis}　]_____)==--- __(V._.V)__<br>
                                                 「${display}」
    `;
        updateStatus(formattedStatus.trim(), '#00ffaa');
    }; 
    
    u.onend=()=>{ 
        isSpeaking = false; 
        currentTextToSpeak = ''; 
        setStandbyStatus();
        input.value = '';

        // TTS終了後、STTが停止していれば自動で再起動を試みる
        if (recognition && !isRecording) {
            try {
                recognition.start();
            } catch(e) {
                console.warn('Recognition restart failed after TTS:', e);
            }
        }
    }; 
    
    u.onerror = (e) => {
        console.error('TTS error:', e);
        isSpeaking = false;
        currentTextToSpeak = '';
        setStandbyStatus();
        input.value = '';
    };

    // スピーチをキューに追加
    synth.speak(u); 
}

/**
 * テキスト入力時の即時プレビュー用読み上げ関数
 */
function speakSentence(text) {
    // テキストが空か、既に同じテキストの読み上げが開始されている場合は何もしない
    if (text.trim() === '' || text === currentTextToSpeak) {
        return;
    }

    // 新しい読み上げが開始されるので、現在の読み上げをキャンセル
    if (synth.speaking) {
        synth.cancel();
    }
    
    currentTextToSpeak = text; // 新しい文章を記憶

    const utterance = new SpeechSynthesisUtterance(text); // const/let を使用
    utterance.lang = 'ja-JP'; // 日本語を設定
    utterance.rate = 1.0; 

    utterance.onstart = () => {
        isSpeaking = true;
        // 読み上げ中の文章を一部表示
        const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
        updateStatus(`文章を読み上げ中: 「${display}」`, '#00ffaa');
    };
    
    utterance.onend = () => {
        isSpeaking = false;
        // 即時プレビューが終わっても、待機中のステータスに戻すだけ
        setStandbyStatus(); 
    };

    utterance.onerror = (event) => {
        console.error('Speech Synthesis Error:', event);
        isSpeaking = false;
        updateStatus('読み上げエラーが発生しました', '#ff0000');
    };

    synth.speak(utterance);
}

/* ---------- Speech Recognition (Browser STT) & Audio Init ---------- */

function startBrowserRecognition() {
    if (isRecording) return;
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        updateStatus('Error: Speech Recognition not supported in this browser.', '#ff0000');
        return;
    }

    if (recognition) {
        // 既存の認識インスタンスがあれば停止
        try {
            recognition.stop();
        } catch (e) {
            console.warn("Recognition stop failed:", e);
        }
        recognition = null;
    }

    recognition = new (window.webkitSpeechRecognition || window.SpeechRecognition)();
    recognition.continuous = false; 
    recognition.interimResults = true; 
    recognition.lang = 'ja-JP';

    recognition.onstart = () => {
        isRecording = true;
        isSpeaking = true; // 録音中はTTSが止まるので isSpeaking は true にしておく
        const standbyMsg = `
        Listening...<br>
        話しかけてください...！
        `;
        updateStatus(standbyMsg.trim(), '#ffff00');
        startColorTransition('#ffff00', '#00ffaa', 2000); 
        
        input.value = ''; 
        if (synth.speaking) synth.cancel(); 
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        input.value = finalTranscript || interimTranscript; // 入力欄には反映
    };

    // 発話終了またはエラー時の自動再スタートロジック
    const restartRecognition = () => {
        isRecording = false;
        
        // TTSが動作中でなければ、待機状態に戻す
        if (!synth.speaking) {
            isSpeaking = false; 
            setStandbyStatus();
        }
        
        setTimeout(() => {
            try {
                // 既に認識が開始されているか、TTSが動いていなければ再スタート
                if (!isRecording && !synth.speaking) recognition.start(); 
            } catch (e) {
                if (e.name !== 'InvalidStateError') {
                    console.warn('Recognition start failed:', e);
                }
            }
        }, 500); 
    };
    
    recognition.onend = () => {
        isRecording = false;
        
        // TTSが動作していない場合に限り isSpeaking を false に
        if (!synth.speaking) {
            isSpeaking = false; 
        }
        
        const finalPrompt = input.value.trim();
        
        // 認識結果が空でない、またはデフォルトメッセージでない場合のみ処理
        if (finalPrompt && finalPrompt.length > 1 && !finalPrompt.startsWith("話しかけてください") && !finalPrompt.startsWith("イマジナリーナンバー 通称GAIイマさんAI応答:")) {
            updateStatus('Processing response...', '#00ffaa');
            
            // LLM処理中にSTTが自動で再起動しないように、.finallyでrestartRecognitionを呼ぶ
            // ただし、speak()のonendでも再起動するので、ここではLLM処理後にSTTを強制停止/リセットする
            processRecognitionResult(finalPrompt).catch(error => {
                 console.error("LLM処理中にエラー:", error);
                 // エラー時もTTSが終わったら再起動
            });
        } else {
            // 空の認識結果の場合、すぐに再起動
            restartRecognition();
        }
    };

    recognition.onerror = (event) => {
        isRecording = false;
        isSpeaking = false;
        console.error('Speech Recognition Error:', event.error);
        
        if (event.error !== 'not-allowed' && event.error !== 'aborted') {
            restartRecognition();
        } else if (event.error === 'aborted') {
            // 意図的な停止（stop()呼び出し）の場合もあるため、再起動
            restartRecognition(); 
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

async function initAudioAndSTT(){
    if(analyser) {
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
    updateStatus('Generating response (via FastAPI)...', '#00ffaa');
    
    const cleanedPrompt = prompt.trim();
    if (!cleanedPrompt) {
        speak("何も話されていません。もう一度お話しください。");
        return;
    }

    try {
        const response = await fetch(LLM_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: cleanedPrompt })
        });

        const data = await response.json();

        if (response.ok) {
            const responseText = data.response || "応答がありませんでした。";
            speak(responseText);
        } else {
            const detail = data.detail || "サーバーエラー";
            const errorMsg = `LLMエラー: 応答生成に失敗しました。詳細: ${detail}`;
            speak(errorMsg);
        }
    } catch (error) {
        const networkErrorMsg = `🔴 ネットワークエラー: LLMバックエンドサーバーに接続できません (${error.message})`;
        speak(networkErrorMsg);
    }
}


/* ---------- Event Listeners ---------- */

// 画面中央タップでUIを隠す (UIトグル)
tapArea.addEventListener('click', () => {
    // ui.style.opacity = ui.style.opacity === '0' ? '1' : '0';
    // 常にマイクを起動するロジックを優先し、トグルは一旦保留
    if (!analyser) {
        initAudioAndSTT();
    }
});

// テキスト入力の確定 (Enterキー)
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const text = input.value.trim();
        if (text) {
            // STTが動作していれば停止
            if (recognition && isRecording) {
                recognition.stop();
            }
            // LLM処理を実行
            processRecognitionResult(text);
        }
    }
});

// テキスト入力時の即時プレビュー (句読点や改行で一時的に読み上げ)
let debounceTimeout;
input.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        const text = input.value.trim();
        const lastChar = text.slice(-1);

        // 句読点（。、！？）や改行（\n）で文の終わりを検出
        if (text.length > 5 && (lastChar === '。' || lastChar === '、' || lastChar === '！' || lastChar === '？')) {
            // 直前の短い部分を読み上げ（例: 最後の句読点までの部分）
            const lastPeriodIndex = Math.max(text.lastIndexOf('。'), text.lastIndexOf('！'), text.lastIndexOf('？'));
            const lastCommaIndex = text.lastIndexOf('、');
            
            // 最後の文の区切りを探す
            let startIndex = 0;
            if (lastPeriodIndex !== -1) {
                startIndex = lastPeriodIndex + 1; // 句読点の次から
            } else if (lastCommaIndex !== -1) {
                startIndex = lastCommaIndex + 1;
            }
            
            const segmentToSpeak = text.substring(startIndex).trim();
            if (segmentToSpeak.length > 0) {
                 // 念のため、現在応答中/発話中の文章と重複しないようにチェック
                if (!isSpeaking || currentTextToSpeak.indexOf(segmentToSpeak) === -1) {
                    speakSentence(segmentToSpeak);
                }
            }
        }
    }, 500); // 500msのディレイ
});


// 送信ボタン (マイク/AIリセットボタン)
sendBtn.addEventListener('click', () => {
    // 1. STTを停止（二重スタート防止）
    if (recognition) {
        try {
            recognition.stop();
        } catch(e) {
            console.warn('Recognition stop on button click failed:', e);
        }
    }
    isRecording = false; // 状態をリセット

    // 2. TTSを停止
    if (synth.speaking) {
        synth.cancel();
    }
    isSpeaking = false; // 状態をリセット
    currentTextToSpeak = '';
    
    // 3. 入力欄をクリア
    input.value = '';

    // 4. ステータスと波形をデフォルトに戻す
    setStandbyStatus(); 

    // 5. STTを再起動
    setTimeout(() => {
        if (analyser) {
            startBrowserRecognition();
        } else {
             // 初回起動処理
            initAudioAndSTT();
        }
    }, 100);
});

// ページロード時に初回起動を試みる
window.addEventListener('load', () => {
    // initAudioAndSTT(); // 自動起動は許可が必要なため、タップエリアで起動を促す
    setStandbyStatus(); 
});
