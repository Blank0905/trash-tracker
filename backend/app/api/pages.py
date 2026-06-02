"""LIFF 使用者頁通用路由（負責人：P5）

`GET /liff/<page>` 會渲染 templates/liff/<page>.html，並注入 LIFF_ID。
→ 新增一個 LIFF 頁面，只要在 templates/liff/ 放一支 .html 即可，**不必修改本檔**，
   因此多位前端可同時各自加頁、互不衝突。
"""
from flask import Blueprint, render_template, abort
from jinja2 import TemplateNotFound
from config import Config

bp = Blueprint('pages', __name__)


@bp.route('/liff', methods=['GET'])
@bp.route('/liff/', methods=['GET'])
def liff_entry():
    """LIFF 入口頁。

    LIFF Endpoint URL 設為 .../liff。當使用者點帶子路徑的 LIFF 連結（如 .../credentials），
    LINE 不會直接開 /liff/credentials，而是開 /liff?liff.state=%2Fcredentials；
    本頁載入 LIFF SDK 並 liff.init() 後，SDK 會自動依 liff.state 重導到 /liff/credentials。
    入口頁沿用 index.html（它已含 liff.init）。
    """
    return render_template(
        'liff/index.html',
        liff_id=Config.LINE_LIFF_ID,
    )


@bp.route('/liff/<page>', methods=['GET'])
def liff_page(page):
    try:
        return render_template(
            f'liff/{page}.html',
            liff_id=Config.LINE_LIFF_ID,
        )
    except TemplateNotFound:
        abort(404)
