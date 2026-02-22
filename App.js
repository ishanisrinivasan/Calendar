import { useState, useEffect } from 'react';
import AriaCalendar from './AriaCalendar';

const PASSWORD = process.env.REACT_APP_PASSWORD || 'aria2024';
const SESSION_KEY = 'aria_auth';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [shake, setShake] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === 'yes') setAuthed(true);
  }, []);

  const tryLogin = () => {
    if (pw === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'yes');
      setAuthed(true);
    } else {
      setShake(true);
      setPw('');
      setTimeout(() => setShake(false), 600);
    }
  };

  if (authed) return <AriaCalendar />;

  return (
    <div style={{
      minHeight: '100vh', background: '#070a12',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Outfit', sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Sora:wght@700&display=swap');
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-10px)}
          40%{transform:translateX(10px)}
          60%{transform:translateX(-8px)}
          80%{transform:translateX(8px)}
        }
        @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .login-box { animation: fadeIn .4s ease; }
        input:focus { outline: none; }
      `}</style>

      <div className="login-box" style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20, padding: '48px 40px', width: 340,
        textAlign: 'center',
        boxShadow: '0 0 60px rgba(99,102,241,0.08)'
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, margin: '0 auto 20px',
          boxShadow: '0 0 30px #6366f133'
        }}>✦</div>

        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 700, color: '#e0e4f5', marginBottom: 6 }}>
          Aria <span style={{ color: '#6366f1' }}>Calendar</span>
        </div>
        <div style={{ fontSize: 13, color: '#2e3550', marginBottom: 32 }}>Your personal AI planner</div>

        <div style={{ animation: shake ? 'shake .5s ease' : 'none' }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, display: 'flex', alignItems: 'center',
            padding: '4px 4px 4px 16px', marginBottom: 12,
            transition: 'border-color .2s'
          }}
            onFocusCapture={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'}
            onBlurCapture={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
          >
            <input
              type={showPw ? 'text' : 'password'}
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && tryLogin()}
              placeholder="Enter your password"
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: '#dde2f0', fontSize: 15, padding: '10px 0', fontFamily: 'inherit'
              }}
            />
            <button onClick={() => setShowPw(s => !s)} style={{
              background: 'none', border: 'none', color: '#333a52',
              cursor: 'pointer', padding: '8px 10px', fontSize: 16
            }}>{showPw ? '🙈' : '👁️'}</button>
          </div>

          <button onClick={tryLogin} style={{
            width: '100%', padding: '13px 0',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            border: 'none', borderRadius: 12, color: 'white',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', letterSpacing: 0.3,
            boxShadow: '0 0 20px #6366f133', transition: 'opacity .2s'
          }}
            onMouseEnter={e => e.target.style.opacity = '.88'}
            onMouseLeave={e => e.target.style.opacity = '1'}
          >
            Unlock →
          </button>
        </div>

        <div style={{ marginTop: 24, fontSize: 11, color: '#1e2235', lineHeight: 1.7 }}>
          🔒 Private — only you can access this
        </div>
      </div>
    </div>
  );
}
