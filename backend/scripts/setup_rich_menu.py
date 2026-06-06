"""一鍵建立／更新 LINE Rich Menu（5 格：上排 2 大、下排 3 小）。

為什麼要這支腳本：
    LINE 官方帳號管理介面（OA Manager）的圖文選單編輯器只提供固定模板，
    做不出「上排 2 大格 + 下排 3 小格」這種自訂版型。自訂格子座標必須走
    Messaging API，本腳本就是用 API 建立選單、上傳背景圖並設為預設。

用法：
    python backend/scripts/setup_rich_menu.py <背景圖路徑>
    # 例：python backend/scripts/setup_rich_menu.py backend/scripts/richmenu.png

需要環境變數（會自動讀取 backend/.env）：
    LINE_CHANNEL_ACCESS_TOKEN
    LINE_LIFF_ID

圖片需求見專案根目錄 richmenu-圖片規格.md（2500×1686、≤1MB、PNG/JPEG）。
腳本會先刪掉帳號上所有既有 rich menu（方便重複執行、不堆積孤兒選單），
再建立本選單並設為預設。格子座標與規格書一致，改格請兩邊一起改。
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from linebot.v3.messaging import (
    Configuration, ApiClient, MessagingApi, MessagingApiBlob,
    RichMenuRequest, RichMenuArea, RichMenuBounds, RichMenuSize, URIAction,
)

# 腳本在 backend/scripts/ 底下，.env 在 backend/.env
BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

TOKEN = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN", "")
LIFF_ID = os.environ.get("LINE_LIFF_ID", "")


def liff_uri(page):
    return f"https://liff.line.me/{LIFF_ID}/{page}"


def build_areas():
    """5 格的可點區域；x/y/寬/高需與 richmenu-圖片規格.md 完全一致。"""
    def area(x, y, w, h, page, label):
        return RichMenuArea(
            bounds=RichMenuBounds(x=x, y=y, width=w, height=h),
            action=URIAction(uri=liff_uri(page), label=label),
        )
    return [
        area(0,    0,   1250, 900, "map",         "地圖"),           # A 上左（大）
        area(1250, 0,   1250, 900, "me",          "收藏通知"),       # B 上右（大）
        area(0,    900, 833,  786, "credentials", "綁定信箱"),       # C 下左
        area(833,  900, 834,  786, "bag",         "垃圾袋規範"),     # D 下中
        area(1667, 900, 833,  786, "bulky",       "大型廢棄物清運"), # E 下右
    ]


def content_type_of(path):
    ext = path.suffix.lower()
    if ext in (".jpg", ".jpeg"):
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    raise SystemExit(f"不支援的圖片格式：{ext}（只接受 .png / .jpg / .jpeg）")


def main():
    if not TOKEN:
        raise SystemExit("缺少 LINE_CHANNEL_ACCESS_TOKEN（請確認 backend/.env）")
    if not LIFF_ID:
        raise SystemExit("缺少 LINE_LIFF_ID（請確認 backend/.env）")
    if len(sys.argv) < 2:
        raise SystemExit("用法：python backend/scripts/setup_rich_menu.py <背景圖路徑>")

    image_path = Path(sys.argv[1])
    if not image_path.is_file():
        raise SystemExit(f"找不到圖片：{image_path}")
    content_type = content_type_of(image_path)

    # 最佳努力檢查尺寸（有裝 Pillow 才檢查，沒裝就略過）
    try:
        from PIL import Image
        w, h = Image.open(image_path).size
        if (w, h) != (2500, 1686):
            raise SystemExit(f"圖片尺寸需為 2500×1686，目前是 {w}×{h}")
    except ImportError:
        print("（未安裝 Pillow，略過尺寸檢查；請自行確認圖為 2500×1686）")

    image_bytes = image_path.read_bytes()
    if len(image_bytes) > 1024 * 1024:
        raise SystemExit(f"圖片需 ≤ 1MB，目前約 {len(image_bytes) / 1024:.0f} KB")

    config = Configuration(access_token=TOKEN)
    with ApiClient(config) as client:
        api = MessagingApi(client)
        blob = MessagingApiBlob(client)

        # 1) 清掉既有 rich menu
        existing = api.get_rich_menu_list().richmenus
        for rm in existing:
            api.delete_rich_menu(rm.rich_menu_id)
        if existing:
            print(f"已刪除 {len(existing)} 個既有 rich menu")

        # 2) 建立新選單
        req = RichMenuRequest(
            size=RichMenuSize(width=2500, height=1686),
            selected=True,
            name="垃圾車追蹤主選單",
            chat_bar_text="開啟選單",
            areas=build_areas(),
        )
        rich_menu_id = api.create_rich_menu(req).rich_menu_id
        print(f"已建立 rich menu：{rich_menu_id}")

        # 3) 上傳背景圖
        blob.set_rich_menu_image_with_http_info(
            rich_menu_id, body=image_bytes, _headers={"Content-Type": content_type}
        )
        print(f"已上傳背景圖（{content_type}, 約 {len(image_bytes) // 1024} KB）")

        # 4) 設為預設選單（所有使用者聊天室底部都會顯示）
        api.set_default_rich_menu(rich_menu_id)
        print("已設為預設選單。完成！")


if __name__ == "__main__":
    main()
