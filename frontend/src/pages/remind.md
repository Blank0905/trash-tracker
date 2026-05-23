因為還沒用後端API
Login.jsx的handleSubmit現在是模擬 之後API好了要改成透過網路fetch 改這裡: 
{
localStorage.setItem('access_token', 'mock_token_123456');
localStorage.setItem('admin_email', email);
......
onLoginSuccess();
}

Dashboard.jsx的<div style={styles.badge}>資料庫狀態：🟢 已連線 (MySQL)</div> 是假的還沒用好

