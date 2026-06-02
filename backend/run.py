from app import create_app

app = create_app()

if __name__ == '__main__':
    # 啟動開發伺服器，預設跑在 port 8000，並開啟 debug 模式
    app.run(host='0.0.0.0', port=8000, debug=True)
