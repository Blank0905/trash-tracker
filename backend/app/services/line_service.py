import logging
import os
from linebot.v3.messaging import (
    Configuration,
    ApiClient,
    MessagingApi,
    Message,
    FlexMessage,
    TextMessage,
    PushMessageRequest,
    ReplyMessageRequest,
    MulticastRequest
)
from typing import List, Optional

logger = logging.getLogger(__name__)

class LineService:
    def __init__(self):
        # 註：因為 Flask 的 config 需要在 app context 下讀取，
        # 這裡留空，等實際發送訊息時再動態初始化，避免 Blueprint 載入時發生 App Context 錯誤。
        self._api_instance = None

    def _get_api(self):
        """動態取得 LINE Messaging API 實例"""
        # 從 Flask config 讀取 LINE 的憑證
        channel_access_token = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN")

        if not channel_access_token:
            logger.error("環境變數缺少 LINE_CHANNEL_ACCESS_TOKEN！")
            return None

        configuration = Configuration(access_token=channel_access_token)
        api_client = ApiClient(configuration)
        return MessagingApi(api_client)

    def reply_text(self, reply_token: str, text: str) -> bool:
        """
        使用 reply_token 被動回覆使用者訊息 (Webhook 專用)
        """
        api = self._get_api()
        if not api:
            return False

        try:
            # 組裝 v3 的回覆請求
            reply_request = ReplyMessageRequest(
                reply_token=reply_token,
                messages=[TextMessage(text=text)]
            )
            api.reply_message(reply_request)
            return True
        except Exception as e:
            logger.error(f"LINE reply_text 發生異常: {str(e)}")
            return False

    def push_text(self, line_user_id: str, text: str) -> bool:
        """
        主動推播單一文字訊息給指定使用者 (到站提醒專用)
        """
        api = self._get_api()
        if not api:
            return False

        try:
            # 組裝 v3 的單發推播請求
            push_request = PushMessageRequest(
                to=line_user_id,
                messages=[TextMessage(text=text)]
            )
            api.push_message(push_request)
            return True
        except Exception as e:
            logger.error(f"LINE push_text 失敗 (User: {line_user_id}): {str(e)}")
            return False

    def multicast_text(self, line_user_ids: list, text: str) -> bool:
        """
        同時群發文字訊息給多個使用者 (P4 管理者公告推播專用)
        """
        return self.multicast_messages(line_user_ids, [TextMessage(text=text)])

    def multicast_messages(self, line_user_ids: list, messages: List[Message]) -> bool:
        """
        同時群發多型訊息（Text / Flex ...）給多個使用者。
        """
        if not line_user_ids:
            logger.warning("群發對象列表為空，跳過發送")
            return False

        if not messages:
            logger.warning("群發訊息內容為空，跳過發送")
            return False

        api = self._get_api()
        if not api:
            return False

        try:
            # LINE 官方限制 multicast 單次上限為 500 個 userId
            # 這裡幫你做分批處理（Chunking），以防 P4 傳入的使用者太多導致 API 報錯
            chunk_size = 500
            for i in range(0, len(line_user_ids), chunk_size):
                chunk = line_user_ids[i:i + chunk_size]

                # 組裝 v3 的多人群發請求
                multicast_request = MulticastRequest(
                    to=chunk,
                    messages=messages
                )
                api.multicast(multicast_request)

            logger.info(f"成功群發訊息給 {len(line_user_ids)} 位使用者")
            return True
        except Exception as e:
            logger.error(f"LINE multicast_messages 發生異常: {str(e)}")
            return False

    def multicast_flex(self, line_user_ids: list, alt_text: str, contents: dict, fallback_text: Optional[str] = None) -> bool:
        """
        群發 Flex Message；若失敗可回退為文字訊息。
        """
        try:
            flex_message = FlexMessage.from_dict({
                "type": "flex",
                "altText": alt_text,
                "contents": contents,
            })
            return self.multicast_messages(line_user_ids, [flex_message])
        except Exception as e:
            logger.error(f"LINE multicast_flex 發生異常: {str(e)}")
            if fallback_text:
                return self.multicast_text(line_user_ids, fallback_text)
            return False

# 實例化單例物件供外部直接 import 使用
line_service = LineService()
