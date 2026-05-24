"""LIFF 使用者頁通用路由（負責人：P5）

`GET /liff/<page>` 會渲染 templates/liff/<page>.html，並注入 LIFF_ID 與 GOOGLE_MAPS_API_KEY。
→ 新增一個 LIFF 頁面，只要在 templates/liff/ 放一支 .html 即可，**不必修改本檔**，
   因此多位前端可同時各自加頁、互不衝突。
"""
from flask import Blueprint, render_template, abort
from jinja2 import TemplateNotFound
from config import Config

bp = Blueprint('pages', __name__)


@bp.route('/liff/<page>', methods=['GET'])
def liff_page(page):
    try:
        return render_template(
            f'liff/{page}.html',
            liff_id=Config.LINE_LIFF_ID,
            google_maps_api_key=Config.GOOGLE_MAPS_API_KEY,
        )
    except TemplateNotFound:
        abort(404)
