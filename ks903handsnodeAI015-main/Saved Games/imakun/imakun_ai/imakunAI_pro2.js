/// imakunAI.js # 完全補正版 (Audio, Canvas, STT, TTS, YouTube 統合)
/* --------------------------------------------------------------------------------- */
/* 1. Canvasアニメーションとレスポンシブ対応                                          */
/* --------------------------------------------------------------------------------- */
const canvas = document.getElementById("waveCanvas");
const ctx = canvas.getContext("2d");
let bars = [];
const BAR_COUNT = 40; // ★統一★ 棒の数
const BAR_WIDTH = 8;
let dataArray;
let animationFrameId;
let transitionFrameId; 
let isSpeaking = false;
let isRecording = false;
let isTtsSpeaking = false; // ★TTSがアクティブかどうかを判定するフラグ
let currentWaveColor = 'rgba(50, 200, 255, 0.7)'; 
let rainbowHue = 0; 
const WAVE_COLORS = {
    default: 'rgba(50, 200, 255, 0.7)',
    positive: 'rgba(50, 255, 50, 0.7)',
    anger: 'rgba(255, 50, 50, 0.7)',
    rage: 'rgba(150, 50, 255, 0.7)',
    negative: 'rgba(50, 100, 255, 0.7)',
    sadness: 'rgba(0, 0, 150, 0.7)'
};
const STATUS_TRANSITION_COLORS = [
    '#32CD32', '#ADFF2F', '#FFA500', '#FF4500', 
    '#8A2BE2', '#00008B', '#00FFFF', '#FFFF00'
]; 

// DOM要素の取得
const statusArea = document.getElementById("status-area");
const sendBtn = document.getElementById("sendBtn");
const input = document.getElementById("messageInput");
const ui = document.getElementById('ui');
const tapArea = document.getElementById('tapArea');

// API設定
const LLM_API_URL = "https://atjmuwnwmtjw-hello.hf.space/llm/generate";
const MQTT_API_URL = "https://atjmuwnwmtjw-hello.hf.space/iot/control";
const synth = window.speechSynthesis;

// 状態管理変数
let audioContext, analyser, mediaStream;
let recognition = null;
let currentTextToSpeak = '';
let isMusicPlayerEnabled = true; 
const MUSIC_VOLUME = 15; // ★重要★ 音楽の音量レベル (0-100)

/* --------------------------------------------------------------------------------- */
/* 2. キャンバス波形アニメーション */
/* --------------------------------------------------------------------------------- */

function createBars() {
    bars = [];
    const startX = canvas.width / 2 - (BAR_COUNT * BAR_WIDTH) / 2;
    for (let i = 0; i < BAR_COUNT; i++) {
        bars.push({
            x: startX + i * BAR_WIDTH,
            height: 10,
            color: "#00ffff"
        });
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    createBars();
}

function animateBars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- 色決定ロジック ---
    let barColor = currentWaveColor;
    // ... (standby_transition, rainbow の色決定ロジックは変更なし) ...
    if (currentWaveColor === 'standby_transition') {
        const segmentDuration = 890;
        const totalDuration = STATUS_TRANSITION_COLORS.length * segmentDuration;
        const elapsed = performance.now() % totalDuration;
        const numSegments = STATUS_TRANSITION_COLORS.length;
        const progress = elapsed / totalDuration;
        const currentSegmentIndex = Math.floor(progress * numSegments);
        const nextSegmentIndex = (currentSegmentIndex + 1) % numSegments;
        const segmentProgress = (elapsed % segmentDuration) / segmentDuration;
        const startRgb = hexToRgb(STATUS_TRANSITION_COLORS[currentSegmentIndex]);
        const endRgb = hexToRgb(STATUS_TRANSITION_COLORS[nextSegmentIndex]);
        const r = startRgb[0] + (endRgb[0] - startRgb[0]) * segmentProgress;
        const g = startRgb[1] + (endRgb[1] - startRgb[1]) * segmentProgress;
        const b = startRgb[2] + (endRgb[2] - startRgb[2]) * segmentProgress;
        barColor = rgbToHex(r, g, b) + 'b3';
    } else if (currentWaveColor === 'rainbow') {
        rainbowHue = (rainbowHue + 3) % 360;
        barColor = `hsla(${rainbowHue}, 100%, 70%, 0.9)`;
    }

    ctx.fillStyle = barColor;
    const currentWaveY = canvas.height / 2;
    
    /* ========================================================
       ① 音声認識中の「リアル波形」
    ======================================================== */
    if (isRecording && analyser && audioContext && audioContext.state === 'running' && dataArray) {
        analyser.getByteFrequencyData(dataArray);

        // ★修正点★ barCount の代わりに BAR_COUNT を使用
        const step = Math.floor(dataArray.length / BAR_COUNT); 

        bars.forEach((bar, i) => {
            const volume = dataArray[i * step] / 255;
            let height = volume * 180 + 20;

            bars[i].height = height;
        });
    }
    /* ========================================================
       ② TTS応答中（isTtsSpeaking）
    ======================================================== */
    else if (isTtsSpeaking) {
      bars.forEach((bar, i) => {
           const waveAmplitude = 100;
           const waveFrequency = 0.05;
           const waveOffset = Math.sin(Date.now() * 0.005 + i * waveFrequency) * waveAmplitude;
           let height = 10 + Math.abs(waveOffset);

           bars[i].height = height;
      });
    }
    /* ========================================================
       ③ 待機中・AI応答中（波形は固定）
    ======================================================== */
    else {
        bars.forEach((bar) => {
             bar.height = 10;  
        });
    }
    /* ========================================================
       ④ 描画
    ======================================================== */
    bars.forEach(bar => {
        ctx.fillRect(bar.x, currentWaveY - bar.height / 2, BAR_WIDTH - 2, bar.height);
    });

    animationFrameId = requestAnimationFrame(animateBars);
}

/* --------------------------------------------------------------------------------- */
/* 3. ステータスアニメーションヘルパー */
/* --------------------------------------------------------------------------------- */
let blinkFrameId; 
let statusRainbowFrameId; 

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

function updateStatus(message, color = '#00ffff') {
    statusArea.innerHTML = message;
    statusArea.style.color = color;
    statusArea.style.boxShadow = `0 0 20px ${color}80`;
}

function setStandbyStatus() {
    stopSequentialColorTransition(); 
    stopStatusRainbow();
    stopStatusBlink();
    const standbyMsg = `
        イマジナリーナンバー
        通称GAIイマさんAI
        AIアシスタント待機中...
    `;
    updateStatus(standbyMsg.trim(), '#00ffff');
}

function startColorTransition(startColor, endColor, duration = 2000) {
    // ... (カラー遷移ロジックは変更なし) ...
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

function startStatusBlink() {
    // レインボーの場合は点滅を停止し、連続色遷移を開始
    if (currentWaveColor === 'rainbow') {      
        stopStatusBlink();
        startSequentialColorTransition(STATUS_TRANSITION_COLORS, 500); 
        return; 
    }
    stopSequentialColorTransition(); 
    stopStatusRainbow();
    if (blinkFrameId) cancelAnimationFrame(blinkFrameId);
    
    // 現在の感情色を取得
    const baseColor = currentWaveColor.replace(/,\s*0\.\d+\)/, ', 1)'); 
    const startTime = performance.now();
    
    function animate(currentTime) {
        // TTS中またはLLM処理中（isSpeaking）の間だけアニメーションを継続
        if (!isSpeaking) { 
            stopStatusBlink();
            return;
        }
        const elapsed = currentTime - startTime;
        const blinkSpeed = 0.005; 
        const intensity = 0.65 + Math.sin(elapsed * blinkSpeed) * 0.35; 
        const shadowColor = baseColor.replace(/1\)/, `${intensity.toFixed(2)})`);        
        statusArea.style.color = baseColor;        
        statusArea.style.boxShadow = `0 0 20px ${baseColor.replace(/1\)/, '0.8)')}, 0 0 50px ${shadowColor}`;
        blinkFrameId = requestAnimationFrame(animate);
    }
    blinkFrameId = requestAnimationFrame(animate);
}

function stopStatusBlink() {
    if (blinkFrameId) {
        cancelAnimationFrame(blinkFrameId);
        blinkFrameId = null;
    }
}

function startSequentialColorTransition(colors, segmentDuration = 500) {     
    stopStatusRainbow();
    stopStatusBlink();
    if (transitionFrameId) cancelAnimationFrame(transitionFrameId);    
    const startTime = performance.now();
    const numSegments = colors.length;
    
    function animate(currentTime) {    
        if (!isSpeaking && !synth.speaking) {
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
        const r = startRgb[0] + (endRgb[0] - startRgb[0]) * segmentProgress;
        const g = startRgb[1] + (endRgb[1] - startRgb[1]) * segmentProgress;
        const b = startRgb[2] + (endRgb[2] - startRgb[2]) * segmentProgress;
        const currentColor = rgbToHex(r, g, b);
        statusArea.style.color = currentColor;
        statusArea.style.boxShadow = `0 0 20px ${currentColor}80`;
        transitionFrameId = requestAnimationFrame(animate);
    }
    transitionFrameId = requestAnimationFrame(animate);
}

function stopSequentialColorTransition() {
    if (transitionFrameId) {
        cancelAnimationFrame(transitionFrameId);
        transitionFrameId = null;
    }
}

function startStatusRainbow() {
    stopSequentialColorTransition(); 
    if (statusRainbowFrameId) cancelAnimationFrame(statusRainbowFrameId);
    function animate() {
        if (!isSpeaking) {
            stopStatusRainbow();
            return;
        }
        rainbowHue = (rainbowHue + 3) % 360; 
        const currentColor = `hsl(${rainbowHue}, 100%, 50%)`;
        statusArea.style.color = currentColor;
        statusArea.style.boxShadow = `0 0 20px ${currentColor}80`;
        statusRainbowFrameId = requestAnimationFrame(animate);
    }
    statusRainbowFrameId = requestAnimationFrame(animate);
}

function stopStatusRainbow() {
    if (statusRainbowFrameId) {
        cancelAnimationFrame(statusRainbowFrameId);
        statusRainbowFrameId = null;
    }
}

function startGreenToRainbowTransition(duration = 750) {
    stopSequentialColorTransition(); 
    stopStatusRainbow();
    // 遷移開始色：緑
    const startColor = '#00ffaa'; 
    // 遷移終了色：レインボーの開始色 (hue 0 = 赤)
    const endColor = '#FF0000'; 
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
        } else {
            // トランジション完了後、連続レインボーをシームレスに開始
            startStatusRainbow();
        }
    }
    requestAnimationFrame(interpolate);
}

/* --------------------------------------------------------------------------------- */
/* 4. YouTube IFrame Player API 統合 (音量制御含む) */
/* --------------------------------------------------------------------------------- */
let player = null; 
let currentPlaylistId = null;
let playerLoadQueue = []; 

const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
    console.log("YouTube IFrame API Ready. 待機中のロードリクエストを処理します。");
    while (playerLoadQueue.length > 0) {
        const query = playerLoadQueue.shift(); 
        loadYouTubePlayer(query, true); 
    }
}

function loadYouTubePlayer(query, fromQueue = false) {
    const container = document.getElementById("musicPlayerContainer");
    
    if (!container) {
        console.error("音楽プレイヤーのコンテナ要素 (musicPlayerContainer) が見つかりません。");
        return;
    }

    // 📢 プレイリストIDの決定ロジック (既存維持)
    let playlistId = 'PLTL76Jp3n2wF-t6l-2V7s2-g5V-8K_4S2'; 
    if (query.includes('ハッピー') || query.includes('アップテンポ') || query.includes('ポジティブ')) {
        playlistId = 'PLTL76Jp3n2wE1D94i8-j3y0X4k_1I0X4k'; 
    } else if (query.includes('怒り') || query.includes('ロック') || query.includes('絶望')) {
        playlistId = 'PLTL76Jp3n2wFV6N5Y1z9-Z5t8R-v1y1a1'; 
    } 
    currentPlaylistId = playlistId;

    // 既存のプレイヤーが存在する場合
    if (player && player.loadPlaylist) {
        player.loadPlaylist({
            list: playlistId,
            listType: 'playlist',
        });
        // ★修正点1★ 既存プレイヤーに音量を設定し、再生を試みる
        try {
            player.setVolume(MUSIC_VOLUME); 
            player.playVideo();
        } catch (e) {
            console.warn("既存プレイヤーの playVideo 呼び出しに失敗。");
        }
        container.style.opacity = 1;
        console.log(`[YouTube Player] 既存プレイヤーにプレイリスト ${playlistId} をロード、音量 ${MUSIC_VOLUME}% で再生を試みました。`);
        return;
    }
    
    // APIがまだ利用できない場合、キューに追加
    if (typeof YT === 'undefined' || !YT.Player) {
        if (!fromQueue) { 
            playerLoadQueue.push(query);
        } else {
            console.error("キューからの実行時にYT.Playerが利用できませんでした。");
        }
        return;
    }
    
    // プレイヤーの準備完了後に自動的に実行される関数
    function onPlayerReady(event) {
        // ★修正点2★ 準備完了時に音量を設定し、再生を試みる
        event.target.setVolume(MUSIC_VOLUME); // プレイヤーに音量を設定
        event.target.playVideo(); 
        container.style.opacity = 1;
        console.log(`[YouTube Player] API経由で再生を試みました (音量: ${MUSIC_VOLUME}%)。`);
    }

    // プレイヤーを作成
    player = new YT.Player('musicPlayerContainer', {
        playerVars: {
            'listType': 'playlist',
            'list': playlistId,
            'autoplay': 1, 
            'enablejsapi': 1,
            'controls': 0, 
            'mute': 0      
        },
        events: {
            'onReady': onPlayerReady, 
        }
    });
}

function playEmotionMusic(emotion, text) {
    if (!isMusicPlayerEnabled) {
        stopEmotionMusic();
        return;
    }
    // ... (query決定ロジックは既存維持) ...
    let query = '';
    switch (emotion) {
        case 'Rage': query = `本気の怒りや絶望のロック`; break;
        case 'SuperHappy': query = `最高にハッピーなポップヒット`; break;
        case 'Anger': query = `激しいロックや怒りを鎮めるクラシック`; break;
        case 'Sadness': query = `心が癒されるバラード`; break;
        case 'Negative': query = `落ち着くアンビエント`; break;
        case 'Positive': query = `元気が出るアップテンポ`; break;
        default: query = `穏やかなリラックスミュージック`; break;
    }
    loadYouTubePlayer(query);
}

function stopEmotionMusic() {
    const container = document.getElementById("musicPlayerContainer");

    if (player && player.stopVideo) {
        try {
            player.stopVideo();
            player.destroy();
            player = null; 
        } catch (e) {
             console.error("プレイヤーの停止/破棄中にエラー:", e);
        }
    }
    
    if (container) {
        container.innerHTML = '';
        container.style.opacity = 0; 
    }
    
    playerLoadQueue = [];
    currentPlaylistId = null;
    console.log("音楽プレイヤーを停止し、破棄しました。");
}

/* --------------------------------------------------------------------------------- */
/* 5. 感情・色判定ロジック */
/* --------------------------------------------------------------------------------- */

const extractEmojis = (t) => {
    const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\p{Emoji_Modifier}*|\p{Emoji_Component}|\u200d/gu;
    const matches = t.match(emojiRegex);
    return matches ? matches.join('') : '';
};

function setWaveColorBasedOnResponse(responseText) {
    const text = responseText.toLowerCase();

    // 1. 【本気の怒り・裏切り (紫)】
    const rageKeywords = ['裏切り', '許さない', '報復', 'どうしてくれる', '絶交', '失望'];
    const rageEmojis = ['😡', '😠', '🤬', '👿', '😾', '💀', '🔪', '💣'];
    if (rageKeywords.some(k => text.includes(k)) || rageEmojis.some(e => text.includes(e))) {
        currentWaveColor = WAVE_COLORS.rage;
        playEmotionMusic('Rage', responseText);
        return;
    }

    // 5. 【最高にハッピー (レインボー)】
    const superHappyKeywords = ['最高にハッピー', '神', '究極', 'パーフェクト', '完璧', '奇跡', '感無量', 'レジェンド'];
    const superHappyEmojis = ['🤩', '✨', '🥳', '💯', '👑', '🥇', '🚀', '🌈', '🎉🎉🎉'];
    if (superHappyKeywords.some(k => text.includes(k)) || superHappyEmojis.some(e => text.includes(e))) {
        currentWaveColor = 'rainbow';
        playEmotionMusic('SuperHappy', responseText);
        return;
    }

    // 2. 【お怒り (赤)】
    const angerKeywords = ['怒り', 'ふざけるな', 'やめろ', 'だめだ', '不可能だ', '違います', '否定', 'ありえない'];
    const angerEmojis = ['😤', '💢', '🔥', '💥', '👹', '😫', '😩'];
    if (angerKeywords.some(k => text.includes(k)) || angerEmojis.some(e => text.includes(e))) {
        currentWaveColor = WAVE_COLORS.anger;
        playEmotionMusic('Anger', responseText);
        return;
    }
    // 3. 【悲しい・号泣 (濃いブルー)】
    const sadnessKeywords = ['悲しい', '泣く', 'ごめんなさい', 'つらい', '寂しい', '涙', '耐えられない', '最悪', 'しんどい'];
    const sadnessEmojis = ['😭', '😢', '🥺', '💧', '😥', '💔', '🌧️', '☔'];
    if (sadnessKeywords.some(k => text.includes(k)) || sadnessEmojis.some(e => text.includes(e))) {
        currentWaveColor = WAVE_COLORS.sadness;
        playEmotionMusic('Sadness', responseText);
        return;
    }
    // 4. 【ネガティブ (ブルー)】
    const negativeKeywords = ['エラー', '失敗', 'できません', '警告', '問題', '懸念', '不明', '確認', '無理', '難しい'];
    const negativeEmojis = ['😞', '😟', '😨', '🥶', '😰', '😵'];
    if (negativeKeywords.some(k => text.includes(k)) || negativeEmojis.some(e => text.includes(e))) {
        currentWaveColor = WAVE_COLORS.negative;
        playEmotionMusic('Negative', responseText);
        return;
    }
    // 6. 【ポジティブ (緑)】
    const positiveKeywords = ['ありがとう', '成功', '完了', '問題ありません', '良い', 'できます', '素晴らしい', '助かる', '了解', 'OK', 'ハッピー'];
    const positiveEmojis = ['😄', '😊', '😆', '👍', '👏', '✅', '🌟'];
    if (positiveKeywords.some(k => text.includes(k)) || positiveEmojis.some(e => text.includes(e))) {
        currentWaveColor = WAVE_COLORS.positive;
        playEmotionMusic('Positive', responseText);
        return;
    }
    // デフォルト
    currentWaveColor = WAVE_COLORS.default;
    playEmotionMusic('Default', responseText);
}


/* --------------------------------------------------------------------------------- */
/* 6. 音声読み上げ/認識/API連携 */
/* --------------------------------------------------------------------------------- */

/**
 * LLM応答など、AIからの正式な応答を読み上げ、終了後にSTTを再起動する
 * @param {string} text 読み上げるテキスト */
function speak(text) {
    if (!text) return;
    currentTextToSpeak = text;
    if (synth.speaking) synth.cancel();
    isSpeaking = true;
    setWaveColorBasedOnResponse(text); // この中で playEmotionMusic() が呼ばれる
    
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 1.0;
    
    u.onstart = () => {
        isTtsSpeaking = true; 
        
        // ★修正点★ 感情が'rainbow'なら、緑からレインボーへの遷移を開始
        if (currentWaveColor === 'rainbow') {
             startGreenToRainbowTransition(750); 
        } else {
             // それ以外は通常の点滅アニメーション (内部で連続色遷移に分岐する)
             startStatusBlink();
        }

        const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
        const onlyEmojis = extractEmojis(text); 
        const formattedStatus = `
        ---==(_____[　イマジナリーナンバー通称GAIイマさんAI応答:  ?&!! ${onlyEmojis}　]_____)==--- __(V._.V)__
                      「${display}」
        `;
        statusArea.innerHTML = formattedStatus.trim();
    };
    
    u.onend = () => {
        isTtsSpeaking = false; 
        isSpeaking = false;
        stopSequentialColorTransition();
        stopStatusRainbow(); 
        setStandbyStatus();
        input.value = ''; 
        currentWaveColor = WAVE_COLORS.default; 
        if (recognition && !isRecording) {
            try {
                recognition.start();
            } catch (e) {
                console.warn('Recognition restart failed after TTS:', e);
            }
        }
    };
    
    u.onerror = (e) => {
        isTtsSpeaking = false; 
        console.error('TTS error:', e);
        isSpeaking = false;
        currentTextToSpeak = '';
        setStandbyStatus();
        stopStatusRainbow(); 
        input.value = '';
        currentWaveColor = WAVE_COLORS.default;
    };
    synth.speak(u);
}

function speakSentence(text) {
    // ... (TTS即時プレビューロジックは既存維持) ...
    if (text.trim() === '' || text === currentTextToSpeak) {
        return;
    }
    if (synth.speaking) {
        synth.cancel();
    }
    currentTextToSpeak = text;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;
    utterance.onstart = () => {
        isSpeaking = true;
        const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
        updateStatus(`文章を読み上げ中: 「${display}」`, '#00ffaa');
        currentWaveColor = WAVE_COLORS.positive;
    };
    utterance.onend = () => {
        isSpeaking = false;
        setStandbyStatus();
        currentWaveColor = WAVE_COLORS.default;
    };
    utterance.onerror = (event) => {
        console.error('Speech Synthesis Error:', event);
        isSpeaking = false;
        updateStatus('読み上げエラーが発生しました', '#ff0000');
        currentWaveColor = WAVE_COLORS.default;
    };
    synth.speak(utterance);
}

function restartRecognition() {
    isRecording = false; 
    if (!synth.speaking) {
        isSpeaking = false;
        setStandbyStatus();
    }
    setTimeout(() => {
        try {
            if (!isRecording && !synth.speaking && recognition) recognition.start();
        } catch (e) {
            if (e.name !== 'InvalidStateError') {
                console.warn('Recognition restart failed:', e);
            }
        }
    }, 500);
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
    
    recognition = new (window.webkitSpeechRecognition || window.SpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'ja-JP';
    
    recognition.onstart = () => {
        isRecording = true;
        isSpeaking = true; 
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
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        input.value = finalTranscript || interimTranscript;
    };
    
    recognition.onend = () => {
        isRecording = false; 
        if (!synth.speaking) {
            isSpeaking = false;
        }
        const finalPrompt = input.value.trim();
        if (finalPrompt && finalPrompt.length > 1 && !finalPrompt.startsWith("話しかけてください") && !finalPrompt.startsWith("イマジナリーナンバー 通称GAIイマさんAI応答:")) {
            updateStatus('Processing response...', '#00ffaa');
            processRecognitionResult(finalPrompt).finally(() => {
                if (!synth.speaking) {
                    restartRecognition();
                }
            });
        } else {
            input.value = '';
            restartRecognition();
        }
    };
    
    recognition.onerror = (event) => {
        isRecording = false;
        console.error('Speech Recognition Error:', event.error);
        if (event.error !== 'not-allowed' && event.error !== 'aborted') {
            restartRecognition();
        } else if (event.error === 'aborted') {
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

/**
 * Audio Context/Analyserを初期化し、マイク入力を接続する
 */
async function initAudioAndSTT() {
    if (analyser) {
        startBrowserRecognition();
        return;
    }
    updateStatus('Requesting microphone access...');
    try {
        // AudioContextの初期化
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // ★修正点★ AudioContextが一時停止状態であれば再開する
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        // AnalyserNodeの初期化
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        // マイクアクセスをリクエスト
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

async function processRecognitionResult(finalPrompt) {     
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
    await generateAndSpeakResponse(finalPrompt);
}

async function generateAndSpeakResponse(prompt) { 
    currentWaveColor = 'standby_transition'; 
    isSpeaking = true; 
    updateStatus('Generating response (via FastAPI)...', '#00ffaa');
    rainbowHue = 0;
    startGreenToRainbowTransition(750); 
    
    const cleanedPrompt = prompt.replace(/^イマジナリーナンバー 通称GAIイマさんAI応答:\s*/, '').trim();
    if (!cleanedPrompt) {
        isSpeaking = false;
        currentWaveColor = WAVE_COLORS.default;
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
                throw new Error("Empty response or invalid JSON structure from FastAPI.");
            }
        } catch (e) {
            console.error(`FastAPI call error on attempt ${i + 1}:`, e);
            if (i === MAX_RETRIES - 1) {
                responseText = "エラーが発生しました。イマジナリーナンバー 通称GAIイマさんAIKS-903model8800-a1-90dの応答を取得できませんでした。Generaltebバックエンドサーバー (ポート8001) の実行状態とAPIキーを確認してください。";
            } else {
                const delay = 2 ** i * 1000 + Math.random() * 500;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    setWaveColorBasedOnResponse(responseText);
    updateStatus('Speaking response...', '#ffd000ff');
    speak(responseText);
    return Promise.resolve();
}

/* --------------------------------------------------------------------------------- */
/* 7. イベントハンドラの統合と定義 */
/* --------------------------------------------------------------------------------- */

window.addEventListener("load", () => {
    resizeCanvas();
    animateBars();
    initAudioAndSTT(); // マイク初期化とSTTを自動で開始
    setStandbyStatus();
    document.getElementById('ui').style.opacity = 1;
});
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => {
    setTimeout(resizeCanvas, 300);
});

// ミュージックトグルスイッチの処理
document.addEventListener('DOMContentLoaded', () => {
    const musicToggle = document.getElementById('music-toggle-checkbox'); 
    musicToggle.checked = isMusicPlayerEnabled; 
    musicToggle.addEventListener('change', toggleMusicPlayer);
});

function toggleMusicPlayer() {
    isMusicPlayerEnabled = !isMusicPlayerEnabled;   
    if (isMusicPlayerEnabled) {
        updateStatus('ミュージックプレイヤー: ON 🎶', WAVE_COLORS.positive);
    } else {
        stopEmotionMusic(); 
        updateStatus('ミュージックプレイヤー: OFF 🔇', WAVE_COLORS.negative);
    }
}

// テキスト入力の処理
input.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const textPrompt = input.value.trim();
        if (textPrompt) { 
            if (recognition && isRecording) {
                recognition.stop();
            }    
            if (synth.speaking) synth.cancel();
            updateStatus('Processing text input...', '#ffff00');   
            processRecognitionResult(textPrompt).catch(error => {
                console.error("Text input processing failed:", error);
            });
        }
    }
});
input.addEventListener('input', (event) => { 
    const currentText = input.value.trim();
    if (!isRecording && !isSpeaking && currentText.length > 0 && currentText !== currentTextToSpeak) {
        speakSentence(currentText);
    } else if (currentText.length === 0 && synth.speaking) {
        synth.cancel();
        isSpeaking = false;
        setStandbyStatus();
    }
});

// リセットボタンの機能
sendBtn.addEventListener("click", () => {
    if (recognition) {
        recognition.stop();
        recognition = null;         
        isRecording = false;
    }
    if (synth.speaking) synth.cancel();      
    isSpeaking = false;
    currentWaveColor = WAVE_COLORS.default;
    stopEmotionMusic(); // 音楽も停止
    stopSequentialColorTransition(); 
    stopStatusRainbow();
    initAudioAndSTT();
    updateStatus('リセットしました。マイク入力を開始しています...');
});

// UI トグル機能 (画面タップ)
let uiVisible = true;
tapArea.addEventListener('click', (e) => { 
    if (e.target.closest('#input-controls')) {
        return;
    }
    uiVisible = !uiVisible;
    if (uiVisible) {
        ui.style.opacity = 1;
    } else {
        ui.style.opacity = 0;
    }
    
    // ★重要追加ロジック★ ユーザー操作によるYouTubeプレイヤーの再生再試行
    if (player && currentPlaylistId) {
        try {
            // ミュート解除と音量設定
            if (player.isMuted()) {
                player.unMute();
            }
            player.setVolume(MUSIC_VOLUME);
            
            // 再生を試みる (ブラウザ制限回避)
            player.playVideo();
            console.log(`ユーザー操作によりYouTubeプレイヤーの再生を再試行しました (音量: ${MUSIC_VOLUME}%)。`);
        } catch (error) {
            console.error("ユーザー操作時の再生再試行に失敗:", error);
        }
    }
});


/* --------------------------------------------------------------------------------- */
/* 8. 機密保持/開発者ツールの無効化 (既存維持) */
/* --------------------------------------------------------------------------------- */
document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
});
document.body.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
});

document.onkeydown = function (e) {
    const key = e.key;
    const lowerKey = key.toLowerCase();
    
    if (key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        return false;
    }
    
    const isCmdOrCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const isAltOrOption = e.altKey;

    if (
        (isCmdOrCtrl && isShift && (lowerKey === 'i' || lowerKey === 'j' || lowerKey === 'c')) ||
        (e.metaKey && isAltOrOption && (lowerKey === 'i' || lowerKey === 'j' || lowerKey === 'c'))
    ) {
        e.preventDefault();
        return false;
    }

    if (isCmdOrCtrl && (lowerKey === 'u' || lowerKey === 's' || lowerKey === 'p')) {
        e.preventDefault();
        return false;
    }
};