import React, { useState } from 'react';

// 接收來自 App.jsx 的 onLoginSuccess 函式
const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginBgImage = "https://images.unsplash.com/photo-1519501025264-65ba15a82390?q=80&w=1200&auto=format&fit=crop";

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('請填寫所有欄位');
      return;
    }

    // 💡 模擬後端 API 驗證成功後的跳轉行為
    // 1. 先把模擬的 Token 與 Email 存在瀏覽器
    localStorage.setItem('access_token', 'mock_token_123456');
    localStorage.setItem('admin_email', email);
    
    // 2. 彈出提示並執行跳轉通知
    alert('驗證成功！即將跳轉至管理後台。');
    onLoginSuccess(); // 👈 觸發跳轉邏輯
  };

  return (
    <div style={styles.outerContainer}>
      <div style={styles.splitWrapper}>
        
        {/* === 左半邊：圖片與品牌區 === */}
        <div style={styles.imageSection}>
          <img src={loginBgImage} alt="Trash Tracker City" style={styles.sideImage} />
          <div style={styles.brandOverlay}>
            <h1 style={styles.brandTitle}>垃圾車<br/>清運追蹤系統</h1>
            <p style={styles.brandSubtitle}>精準排班，智慧管理，打造潔淨家園</p>
          </div>
        </div>

        {/* === 右半邊：管理者登入表單 === */}
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

const styles = {
  outerContainer: {
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#eceff1', 
    fontFamily: '"PingFang TC", "Helvetica Neue", Arial, sans-serif',
    padding: '20px',
  },
  splitWrapper: {
    display: 'flex',
    width: '1000px',
    maxWidth: '100%',
    height: '650px',
    maxHeight: '100vh',
    borderRadius: '24px',
    overflow: 'hidden',
    boxShadow: '0 15px 50px -10px rgba(0, 0, 0, 0.15)',
  },
  imageSection: {
    flex: '1.2',
    position: 'relative',
    display: 'flex',
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
    padding: '40px',
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
  },
  footerLinks: {
    textAlign: 'center',
    marginTop: '15px',
  },
  footerText: {
    fontSize: '14px',
    color: '#90a4ae',
    cursor: 'pointer',
  }
};

export default Login;