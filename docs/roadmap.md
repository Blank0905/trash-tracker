一、短期收尾（一兩週內就能做）

1. 完成 P1.3：移除 verify_password 的明文 fallback、移除 email 自動補 @gmail.com。這是 Demo 期權宜，正式 Demo 給老師看之前該清掉。
2. SECRET_KEY 啟動時強檢查：若沒設環境變數就直接 raise 拒絕啟動，不要走 dev fallback。現在的 fallback 是個「沉默的洞」——你不知道 token 已經形同虛設。
3. Docker 部署文件對齊：README 的 Docker 段沒提到 SECRET_KEY、新版 LIFF webhook URL 等，更新一下避免下次部署踩雷。
4. 加一個操作 log 表：誰升了誰、誰停權誰、誰改了哪條公告。/promote 跟 /suspend 是高危操作，沒 log 就無法追蹤。

二、產品方向（依優先度排序）

- 通知的「漏推」與「重推」測試：notifier 用記憶體 set 去重，重啟就會重推；如果剛好在 60 秒間隔的邊界，可能漏推。這條沒打磨好，使用者覺得「不可靠」就會棄用。
- 使用者一鍵延後/略過今天通知：在 LINE Flex 訊息上加按鈕，避免使用者在外時被打擾。
- 異常停收公告：颱風、過年、補上班日。可半自動：管理員按一鍵「今天全市停收」，自動產出公告 + 推播 + 暫停當日通知。