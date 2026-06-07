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
from linebot.v3.webhooks import MessageEvent, TextMessageContent, FollowEvent
import os
from app.db import get_db_connection

bp = Blueprint('line_webhook', __name__, url_prefix='/api/webhooks')

# LINE Bot 設定
configuration = Configuration(access_token=os.environ.get("LINE_CHANNEL_ACCESS_TOKEN", ""))
handler = WebhookHandler(os.environ.get("LINE_CHANNEL_SECRET", ""))


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


def _bind_line_user(line_user_id, display_name):
    """把 LINE 使用者寫入 users 資料表（免帳密，只存 line_user_id 與暱稱）。

    回傳要回覆給使用者的訊息字串；已綁定過則不重複寫入。
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT user_id FROM users WHERE line_user_id = %s", (line_user_id,))
            if cursor.fetchone():
                return "你已經綁定過囉，無須重複綁定 ✅"
            cursor.execute(
                "INSERT INTO users (line_user_id, username, role) VALUES (%s, %s, 'user')",
                (line_user_id, display_name),
            )
            conn.commit()
            return "綁定成功！🎉 可以開心丟垃圾了 讚讚讚。"
    except Exception:
        conn.rollback()
        return "綁定失敗了，請稍後再試一次 🙏"
    finally:
        conn.close()


def _get_display_name(line_bot_api, line_user_id):
    """嘗試取得 LINE 暱稱存進 username（抓不到回 None；username 無 UNIQUE 限制）。"""
    try:
        return line_bot_api.get_profile(line_user_id).display_name
    except Exception:
        return None


# 新用戶加好友：自動綁定並回歡迎訊息
@handler.add(FollowEvent)
def handle_follow(event):
    line_user_id = event.source.user_id
    with ApiClient(configuration) as api_client:
        line_bot_api = MessagingApi(api_client)
        display_name = _get_display_name(line_bot_api, line_user_id)
        _bind_line_user(line_user_id, display_name)
        line_bot_api.reply_message_with_http_info(
            ReplyMessageRequest(
                replyToken=event.reply_token,
                messages=[
                    TextMessage(
                        text="歡迎加入垃圾車追蹤系統！🎉 已自動完成綁定。\n\n"
                             "各項功能請點下方選單操作。"
                    ),
                ]
            )
        )


# 文字訊息處理
@handler.add(MessageEvent, message=TextMessageContent)
def handle_message(event):
    user_text = event.message.text

    # 手動綁定：已加好友的舊用戶輸入「綁定」即把本人資料寫入 users。
    if user_text == '綁定':
        line_user_id = event.source.user_id
        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            display_name = _get_display_name(line_bot_api, line_user_id)
            reply_content = _bind_line_user(line_user_id, display_name)
            line_bot_api.reply_message_with_http_info(
                ReplyMessageRequest(
                    replyToken=event.reply_token,
                    messages=[TextMessage(text=reply_content)]
                )
            )

    # 綁定電子信箱：回覆 credentials 頁的 LIFF 連結。
    # LINE 會把 /credentials 接到你設定的 LIFF Endpoint URL（共同前綴 https://<ngrok>/liff）後面；
    # 其他頁同理在連結尾巴換頁名即可：.../search、.../map ...
    elif user_text == '綁定信箱':
        liff_url = f"https://liff.line.me/{os.environ.get("LINE_LIFF_ID", "")}/credentials"
        reply_content = f"請點擊下方連結綁定電子信箱和密碼：\n{liff_url}"

        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            line_bot_api.reply_message_with_http_info(
                ReplyMessageRequest(
                    replyToken=event.reply_token,
                    messages=[TextMessage(text=reply_content)]
                )
            )

    # 開啟地圖頁（附近站點以 Google Maps marker 呈現）
    elif user_text == '地圖':
        liff_url = f"https://liff.line.me/{os.environ.get("LINE_LIFF_ID", "")}/map"
        reply_content = f"點下方連結開啟附近垃圾車地圖：\n{liff_url}"

        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            line_bot_api.reply_message_with_http_info(
                ReplyMessageRequest(
                    replyToken=event.reply_token,
                    messages=[TextMessage(text=reply_content)]
                )
            )

    # 開啟清單查詢頁（附近站點清單 + 收運班表）
    elif user_text == '查詢':
        liff_url = f"https://liff.line.me/{os.environ.get("LINE_LIFF_ID", "")}/search"
        reply_content = f"點下方連結查詢附近站點：\n{liff_url}"

        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            line_bot_api.reply_message_with_http_info(
                ReplyMessageRequest(
                    replyToken=event.reply_token,
                    messages=[TextMessage(text=reply_content)]
                )
            )
