/** @jsxImportSource react */
import React, { useState } from 'react';

export default function App() {
  const [status, setStatus] = useState<string>('待機中');
  const [inputText, setInputText] = useState<string>('');
  const [timeline, setTimeline] = useState<{verdict: string, time: string}[]>([]);

  // ⚖️ 執行エンジン (Vercel Rust API) への送信ロジック
  const executeJudgment = async () => {
    if (!inputText) return;

    setStatus('⚖️ 判決中 (Rust Engine 起動)...');
    
    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: inputText }),
      });

      if (!response.ok) throw new Error('通信エラー');

      const data = await response.json();

      // 判決（AIの回答）をタイムラインに追加
      setTimeline(prev => [{
        verdict: data.verdict,
        time: new Date(data.timestamp).toLocaleString()
      }, ...prev]);

      setStatus('✅ 執行完了');
      setInputText(''); // 入力をクリア
    } catch (err) {
      console.error(err);
      setStatus('❌ 執行失敗：要塞が拒絶しました');
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <h1>🛡️ Fortress SNS: 2026</h1>
      
      {/* 入力セクション (LINE形式) */}
      <div style={{ margin: '20px auto', maxWidth: '500px', padding: '20px', backgroundColor: 'white', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <p>ステータス: <strong>{status}</strong></p>
        <input 
          type="text" 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="メッセージを入力..."
          style={{ width: '80%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <button 
          onClick={executeJudgment}
          style={{ padding: '10px 20px', marginLeft: '10px', borderRadius: '5px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          送信
        </button>
      </div>

      {/* タイムラインセクション (掲示板形式) */}
      <div style={{ margin: '20px auto', maxWidth: '600px', textAlign: 'left' }}>
        <h3>📜 執行記録（タイムライン）</h3>
        {timeline.map((item, index) => (
          <div key={index} style={{ marginBottom: '10px', padding: '15px', backgroundColor: 'white', borderRadius: '10px', borderLeft: '5px solid #007bff' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>判決内容:</p>
            <p style={{ margin: '5px 0' }}>{item.verdict}</p>
            <small style={{ color: '#888' }}>{item.time}</small>
          </div>
        ))}
      </div>
    </div>
  );
}