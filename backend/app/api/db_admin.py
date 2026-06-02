import pymysql

# 1. 建立白名單，防止 SQL 注入 (SQL Injection)
ALLOWED_TABLES = [
    'areas', 'bag_regulations', 'favorites', 'notifications', 
    'routes', 'stations', 'station_schedules', 'users'
]

# 2. 定義每張表的主鍵，供排序使用
PRIMARY_KEYS = {
    'areas': 'areas_id',
    'bag_regulations': 'reg_id',
    'favorites': 'fav_id',
    'notifications': 'noti_id',
    'routes': 'route_id',
    'stations': 'station_id',
    'station_schedules': 'schedule_id',
    'users': 'user_id'
}

def get_connection():
    """建立 MySQL 資料庫連線"""
    return pymysql.connect(
        host='localhost',
        user='root',
        password='your_mysql_password',  # ⚠️ 請替換成你的 MySQL 密碼
        database='test_garbage',         # 對齊你的 SQL Dump 資料庫名稱
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor  # 讓回傳結果自帶欄位名稱
    )

def check_db_health():
    """檢查資料庫是否活著 (給前端綠燈偵測用)"""
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
        conn.close()
        return True
    except:
        return False

def get_table_structure(table_name):
    """執行 DESCRIBE 獲取資料表結構"""
    if table_name not in ALLOWED_TABLES:
        raise ValueError("不合法的資料表名稱")
        
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # 動態安全拼裝 DESCRIBE 語法
            cursor.execute(f"DESCRIBE `{table_name}`")
            structure = cursor.fetchall()
            return structure
    finally:
        conn.close()

def browse_table(table_name, page=1, limit=500, search='', sort='none'):
    """萬能動態瀏覽數據邏輯"""
    if table_name not in ALLOWED_TABLES:
        raise ValueError("不合法的資料表名稱")
        
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # 基礎 SQL 骨架
            sql = f"SELECT * FROM `{table_name}`"
            params = []
            
            # 處理搜尋 (這裡以簡單示範，若有 search 則依據各表文字欄位進行模糊查詢)
            # 實際專題可依據不同表客製化，此處做通用萬能處理
            if search:
                # 簡單獲取該表第一個文字欄位做示範，或直接對特定表寫死條件
                if table_name == 'routes':
                    sql += " WHERE `route_name` LIKE %s OR `car_number` LIKE %s"
                    params.extend([f"%{search}%", f"%{search}%"])
                elif table_name == 'areas':
                    sql += " WHERE `city` LIKE %s OR `district` LIKE %s"
                    params.extend([f"%{search}%", f"%{search}%"])
                # ... 其他表可比照辦理
            
            # 處理排序 (動態撈取對應表的主鍵)
            if sort in ['ASC', 'DESC']:
                pk = PRIMARY_KEYS.get(table_name)
                if pk:
                    sql += f" ORDER BY `{pk}` {sort}"
            
            # 處理分頁
            offset = (page - 1) * limit
            sql += " LIMIT %s OFFSET %s"
            params.extend([limit, offset])
            
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            return rows
    finally:
        conn.close()