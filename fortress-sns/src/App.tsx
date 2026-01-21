import React, { useState } from 'react';

export default function App() {
  const [msg, setMsg] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [isJudging, setIsJudging] = useState(false);

  const send = async () => {
    if (!msg) return;
    setIsJudging(true);
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msg })
      });
      const data = await res.json();
      setLogs([{ text: data.verdict, time: new Date().toLocaleTimeString() }, ...logs]);
      setMsg('');
    } catch (e) {
      console.error("要塞通信エラー", e);
    } finally {
      setIsJudging(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif' }}>
      {/* 🟦 Facebook風ヘッダー */}
      <header style={{ 
        backgroundColor: '#1877f2', color: 'white', padding: '10px 20px', 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 100
      }}>
        <h1 style={{ fontSize: '24px', margin: 0, fontWeight: 'bold' }}>ks903_イマちゃんとふぉーとれすSNS</h1>
        <div style={{ fontSize: '14px' }}>🛡️ Fortress Meta Architecture Active</div>
      </header>

      {/* 📄 メインコンテンツ */}
      <main style={{ maxWidth: '600px', margin: '20px auto', padding: '0 10px' }}>
        
        {/* ✍️ 投稿エリア */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '15px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#ddd', borderRadius: '50%' }}></div>
            <textarea 
              style={{ 
                flex: 1, border: 'none', backgroundColor: '#f0f2f5', borderRadius: '20px', 
                padding: '12px 15px', resize: 'none', outline: 'none', fontSize: '16px'
              }}
              rows={1}
              value={msg} 
              onChange={e => setMsg(e.target.value)} 
              placeholder="今、何を執行しますか？" 
            />
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid #e5e5e5', margin: '10px 0' }} />
          <button 
            onClick={send} 
            disabled={isJudging}
            style={{ 
              width: '100%', padding: '8px', borderRadius: '6px', border: 'none', 
              backgroundColor: isJudging ? '#ccc' : '#1877f2', color: 'white', 
              fontWeight: 'bold', cursor: 'pointer', fontSize: '15px'
            }}
          >
            {isJudging ? '⚖️ 判決を仰いでいます...' : 'ポストを執行する'}
          </button>
        </div>

        {/* 📜 フィードエリア */}
        <div>
          {logs.map((l, i) => (
            <div key={i} style={{ 
              backgroundColor: 'white', borderRadius: '8px', padding: '15px', 
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)', marginBottom: '15px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '36px', height: '36px', backgroundColor: '#1877f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px' }}>🛡️</div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>要塞守護 AI Gemini-2.0</div>
                  <div style={{ fontSize: '12px', color: '#65676b' }}>{l.time} · 🌍</div>
                </div>
              </div>
              <div style={{ fontSize: '15px', lineHeight: '1.4', color: '#050505' }}>
                {l.text}
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid #e5e5e5', margin: '10px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-around', color: '#65676b', fontWeight: 'bold', fontSize: '14px' }}>
                <span>👍 いいね！</span>
                <span>💬 コメントする</span>
                <span>🔄 執行シェア</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}


// import React, { useState } from 'react';

// export default function App() {
//   const [msg, setMsg] = useState('');
//   const [logs, setLogs] = useState<any[]>([]);

//   const send = async () => {
//     if (!msg) return;
//     const res = await fetch('/api/execute', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ content: msg })
//     });
//     const data = await res.json();
//     setLogs([{text: data.verdict, time: data.timestamp}, ...logs]);
//     setMsg('');
//   };

//   return (
//     <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
//       <h2 style={{ borderBottom: '2px solid #333' }}>🛡️ Fortress SNS Core</h2>
//       <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
//         <input 
//           style={{ flex: 1, padding: '10px' }}
//           value={msg} 
//           onChange={e => setMsg(e.target.value)} 
//           placeholder="要塞へ送信..." 
//         />
//         <button onClick={send} style={{ padding: '10px 20px', cursor: 'pointer' }}>執行</button>
//       </div>
//       <div>
//         {logs.map((l, i) => (
//           <div key={i} style={{ padding: '10px', background: '#f9f9f9', marginBottom: '5px', borderRadius: '4px' }}>
//             <strong>判決:</strong> {l.text} <br/>
//             <small style={{ color: '#999' }}>{l.time}</small>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }