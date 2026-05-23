from flask import Blueprint, request, abort
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
from config import Config

bp = Blueprint('line_webhook', __name__, url_prefix='/api/webhooks')

# LINE Bot 設定
configuration = Configuration(access_token=Config.LINE_CHANNEL_ACCESS_TOKEN)
handler = WebhookHandler(Config.LINE_CHANNEL_SECRET)

@bp.route('/line', methods=['POST'])
def callback():
    # 獲取 X-Line-Signature 請求標頭值 (驗證用)
    signature = request.headers.get('X-Line-Signature')

    # 以文字形式獲取請求正文
    body = request.get_data(as_text=True)

    # 處理 Webhook 正文
    try:
        handler.handle(body, signature)
    except InvalidSignatureError:
        abort(400)

    return 'OK'

# 當收到文字訊息時的處理邏輯
@handler.add(MessageEvent, message=TextMessageContent)
def handle_message(event):
    user_text = event.message.text

    # 只在使用者輸入註冊關鍵字時回覆 LIFF 連結；其餘訊息不回覆 (echo 已移除)
    if user_text in ['註冊', '綁定帳號']:
        liff_url = f"https://liff.line.me/{Config.LINE_LIFF_ID}"
        reply_content = f"歡迎使用垃圾車追蹤系統！\n\n請點擊下方專屬連結進行帳號註冊與綁定：\n{liff_url}"

        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            line_bot_api.reply_message_with_http_info(
                ReplyMessageRequest(
                    replyToken=event.reply_token,
                    messages=[TextMessage(text=reply_content)]
                )
            )
