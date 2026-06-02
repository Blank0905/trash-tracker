"""統一 API 回應格式

所有 API 端點一律透過 ok() / err() 回傳，確保前端拿到一致的結構：
  成功：{ "status": "success", "data": ... , (其他欄位，如 count) }
  失敗：{ "status": "error", "message": "..." }
"""
from flask import jsonify


def ok(data=None, status_code=200, **extra):
    """成功回應。extra 可帶額外欄位，例如 count=len(rows)。"""
    body = {'status': 'success', 'data': data}
    body.update(extra)
    return jsonify(body), status_code


def err(message, status_code=400):
    """失敗回應。"""
    return jsonify({'status': 'error', 'message': message}), status_code
