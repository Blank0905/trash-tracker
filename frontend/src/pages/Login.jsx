import React, { useState, useEffect } from 'react'; // 🟢 1. 補上 useEffect 監聽螢幕
import { getBackendUrl } from '../utils/api';
import { theme } from '../utils/theme';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // 🟢 2. 新增即時寬度監聽，偵測目前是不是手機
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🟢 3. 取得目前裝置專屬的 RWD 樣式物件
  const styles = getStyles(isMobile);

  const loginBgImage = "https://images.unsplash.com/photo-1519501025264-65ba15a82390?q=80&w=1200&auto=format&fit=crop";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('請填寫所有欄位');
      return;
    }

    try {
      const baseUrl = await getBackendUrl(); 
      
      const response = await fetch(`${baseUrl}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '登入失敗');
      
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('admin_email', data.user.email);
      localStorage.setItem('admin_id', data.user.user_id);
      alert(`驗證成功！歡迎回來，${data.user.username}。`);
      onLoginSuccess();
    } catch (err) {
      setError(err.message || '伺服器連線失敗');
    }
  };

  return (
    <div style={styles.outerContainer}>
      <div style={styles.splitWrapper}>
        
        {/* === 左半邊：圖片與品牌區 (在手機上會自動隱藏，不佔空間) === */}
        <div style={styles.imageSection}>
          <img src={loginBgImage} alt="Trash Tracker City" style={styles.sideImage} />
          <div style={styles.brandOverlay}>
            <h1 style={styles.brandTitle}>垃圾車<br/>清運追蹤系統</h1>
            <p style={styles.brandSubtitle}>精準排班，智慧管理，打造潔淨家園</p>
          </div>
        </div>

        {/* === 右半邊：管理者登入表單 (在手機上會自動撐滿) === */}
        <div style={styles.formSection}>
          <div style={styles.formCard}>
            <div style={styles.header}>
              <h2 style={styles.title}>管理者登入</h2>
              <p style={styles.subtitle}>請輸入管理員帳密登入管理系統</p>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              {error && <div style={styles.errorAlert}>{error}</div>}

              <div style={styles.inputGroup}>
                <label style={styles.label}>電子郵件 (Email)</label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@trash.tracker.com"
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>密碼 (Password)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={styles.input}
                />
              </div>

              <button type="submit" style={styles.button}>
                安全登入
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};

// 深色現代 SaaS 風（GitHub Dark / Vercel-ish）。RWD 自適應手機/桌面。
// 共用 design tokens 見 src/utils/theme.js
const __c = theme.colors;
const __r = theme.radius;

const getStyles = (isMobile) => ({
  outerContainer: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: __c.bg,
    backgroundImage: [
      // 亮色下用淡淡的 indigo / blue 漸層光暈，給平淡白底一點呼吸感
      'radial-gradient(ellipse 70% 50% at 20% 10%, rgba(79, 70, 229, 0.08), transparent 60%)',
      'radial-gradient(ellipse 50% 35% at 85% 90%, rgba(9, 105, 218, 0.06), transparent 60%)',
    ].join(','),
    fontFamily: theme.fonts.sans,
    color: __c.text,
    padding: isMobile ? '16px' : '24px',
    WebkitFontSmoothing: 'antialiased',
  },
  splitWrapper: {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    width: isMobile ? '100%' : '960px',
    maxWidth: isMobile ? '420px' : '100%',
    height: isMobile ? 'auto' : '600px',
    maxHeight: isMobile ? 'none' : '100vh',
    borderRadius: __r.xl,
    overflow: 'hidden',
    border: `1px solid ${__c.border}`,
    boxShadow: theme.shadow.lg,
    backgroundColor: __c.surface1,
  },
  imageSection: {
    display: isMobile ? 'none' : 'flex',
    flex: '1.15',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    background: __c.surface2,
    overflow: 'hidden',
  },
  sideImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    // 亮色版仍稍微壓暗 + 加 indigo 色調，讓圖跟整體 indigo 主色協調、不喧賓奪主
    filter: 'brightness(0.75) saturate(0.85) hue-rotate(-10deg)',
  },
  brandOverlay: {
    position: 'absolute',
    bottom: '40px',
    left: '40px',
    right: '40px',
    color: '#ffffff',
  },
  brandTitle: {
    margin: 0,
    fontSize: '34px',
    fontWeight: '700',
    lineHeight: '1.15',
    letterSpacing: '-0.02em',
    textShadow: '0 2px 12px rgba(0,0,0,0.45)',
  },
  brandSubtitle: {
    margin: '14px 0 0 0',
    fontSize: '14px',
    color: 'rgba(230,237,243,0.85)',
    letterSpacing: '0.01em',
    lineHeight: '1.55',
    textShadow: '0 1px 6px rgba(0,0,0,0.45)',
  },
  formSection: {
    flex: '1',
    background: __c.surface1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: isMobile ? '36px 24px' : '48px',
  },
  formCard: {
    width: '100%',
    maxWidth: '340px',
  },
  header: {
    textAlign: 'left',
    marginBottom: '28px',
  },
  // 「管理者登入」主標
  title: {
    margin: '0 0 6px 0',
    color: __c.text,
    fontSize: '22px',
    fontWeight: '600',
    letterSpacing: '-0.015em',
  },
  subtitle: {
    margin: 0,
    color: __c.textDim,
    fontSize: '13px',
    lineHeight: '1.55',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  // 小標籤：uppercase mono 風，看起來像 SaaS 表單常見的 micro label
  label: {
    fontSize: '11px',
    color: __c.textDim,
    fontWeight: '500',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontFamily: theme.fonts.sans,
  },
  input: {
    padding: '11px 14px',
    borderRadius: __r.md,
    border: `1px solid ${__c.border}`,
    backgroundColor: __c.bg,
    color: __c.text,
    fontSize: '14px',
    fontFamily: theme.fonts.sans,
    outline: 'none',
    transition: `border-color 0.15s ease, box-shadow 0.15s ease`,
    // focus 用 box-shadow ring 而非 outline：圓角更乾淨；JS 端綁 onFocus/onBlur 可動但保留 default visual focus
  },
  // 主按鈕：indigo 實心 + 細微 brand shadow
  button: {
    padding: '12px',
    borderRadius: __r.md,
    border: `1px solid ${__c.brand}`,
    backgroundColor: __c.brand,
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    letterSpacing: '0.01em',
    cursor: 'pointer',
    marginTop: '6px',
    boxShadow: theme.shadow.brand,
    transition: 'background 0.15s ease, transform 0.1s ease',
    fontFamily: theme.fonts.sans,
  },
  errorAlert: {
    backgroundColor: __c.redSoft,
    color: __c.red,
    border: `1px solid rgba(248, 81, 73, 0.25)`,
    padding: '10px 14px',
    borderRadius: __r.md,
    fontSize: '13px',
    lineHeight: '1.5',
    textAlign: 'left',
  }
});

export default Login;