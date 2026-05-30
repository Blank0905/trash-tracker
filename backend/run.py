import os
from flask import Flask, send_from_directory, request, abort
from linebot.v3 import WebhookHandler
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import (
    Configuration,
    ApiClient,
    MessagingApi,
    ReplyMessageRequest,
    TextMessage
)
from linebot.v3.webhooks import MessageEvent, TextMessageContent
from flask_cors import CORS

# 創建最純粹的 Flask，不呼叫任何組員的 create_app()
app = Flask(__name__)
CORS(app)

# ==================== 🔑 塞入你真正的金鑰與 LIFF ID 🔑 ====================
LINE_CHANNEL_ACCESS_TOKEN = "5gh3210Wm/rsNMu8pBhmjCWFLXtOOIrbzJXgT5z0nOHDN9JxIN6BSIbwBlf8Ww2zCFBbhkMDjorvpSp4FeUYR71i3qbkDjQPpth01/Qh3YeYUJK62cjclfEh42IDrXHRqPl8aLRxrL5nkc5nJuwdJAdB04t89/1O/w1cDnyilFU="
LINE_CHANNEL_SECRET = "7fa0792a69ec5bf3b25aad22a0cb6bfa"
LINE_LIFF_ID = "2010234950-UBn3CteF" 
# ==============================================================================

configuration = Configuration(access_token=LINE_CHANNEL_ACCESS_TOKEN)
handler = WebhookHandler(LINE_CHANNEL_SECRET)

# 讓網頁掛載前端 build 資料夾
app.static_folder = 'build'
app.static_url_path = ''

@app.route('/')
def serve_frontend():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_routes(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

# 精準對接原本組員設定的網址路由 /api/webhooks/line
@app.route('/api/webhooks/line', methods=['POST'])
def callback():
    signature = request.headers.get('X-Line-Signature')
    if not signature:
        abort(400)
    body = request.get_data(as_text=True)
    try:
        handler.handle(body, signature)
    except InvalidSignatureError:
        abort(400)
    except Exception as e:
        return 'Internal Error', 500
    return 'OK'

@handler.add(MessageEvent, message=TextMessageContent)
def handle_message(event):
    user_text = event.message.text.strip()
    reply_token = event.reply_token

    if reply_token in ["00000000000000000000000000000000", "ffffffffffffffffffffffffffffffff"]:
        return

    if user_text in ['註冊', '綁定帳號']:
        liff_url = f"https://liff.line.me/{LINE_LIFF_ID}"
        reply_content = f"歡迎使用垃圾車追蹤系統！\n\n請點擊下方專屬連結進行帳號註冊與綁定：\n{liff_url}"

        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            line_bot_api.reply_message_with_http_info(
                ReplyMessageRequest(
                    replyToken=reply_token,
                    messages=[TextMessage(text=reply_content)]
                )
            )
        print("🎯 [系統提示] 成功發送註冊連結！")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
