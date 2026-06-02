import React, { useState, useEffect } from 'react'; // 🟢 1. 補上 useEffect 監聽螢幕
import { getBackendUrl } from '../utils/api';

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
                  type="email"
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

// 🟢 4. 升級為 RWD 動態樣式引擎
const getStyles = (isMobile) => ({
  outerContainer: {
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#eceff1', 
    fontFamily: '"PingFang TC", "Helvetica Neue", Arial, sans-serif',
    padding: isMobile ? '10px' : '20px', // 手機版縮小內邊距
  },
  splitWrapper: {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    width: isMobile ? '100%' : '1000px',
    maxWidth: isMobile ? '400px' : '100%', // 手機版鎖定表單黃金寬度
    height: isMobile ? 'auto' : '650px',
    maxHeight: isMobile ? 'none' : '100vh',
    borderRadius: '24px',
    overflow: 'hidden',
    boxShadow: '0 15px 50px -10px rgba(0, 0, 0, 0.15)',
    backgroundColor: '#ffffff',
  },
  imageSection: {
    display: isMobile ? 'none' : 'flex', // ⚡ 核心關鍵：手機版直接隱藏大圖，不破壞排版
    flex: '1.2',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#1e3c72',
  },
  sideImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  brandOverlay: {
    position: 'absolute',
    bottom: '50px',
    left: '50px',
    color: 'white',
    textShadow: '0 3px 15px rgba(0,0,0,0.6)', 
  },
  brandTitle: {
    margin: 0,
    fontSize: '38px',
    fontWeight: '800',
    lineHeight: '1.2',
    letterSpacing: '1px',
  },
  brandSubtitle: {
    margin: '12px 0 0 0',
    fontSize: '15px',
    opacity: 0.9,
    letterSpacing: '0.5px',
  },
  formSection: {
    flex: '1',
    background: 'white',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: isMobile ? '35px 25px' : '40px', // 手機版收縮 padding
  },
  formCard: {
    width: '100%',
    maxWidth: '350px',
  },
  header: {
    textAlign: 'left',
    marginBottom: '35px',
  },
  title: {
    margin: '0 0 8px 0',
    color: '#1e3c72',
    fontSize: '26px',
    fontWeight: 'bold',
  },
  subtitle: {
    margin: 0,
    color: '#757575',
    fontSize: '14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    color: '#455a64',
    fontWeight: '600',
    letterSpacing: '0.5px',
  },
  input: {
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px solid #cfd8dc',
    backgroundColor: '#fafbfc',
    fontSize: '16px',
    outline: 'none',
  },
  button: {
    padding: '15px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#1e3c72',
    color: 'white',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '10px',
  },
  errorAlert: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'center',
  }
});

export default Login;