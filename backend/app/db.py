import pymysql
from dbutils.pooled_db import PooledDB
from config import DB_CONFIG

# 建立資料庫連線池
pool = PooledDB(
    creator=pymysql,  # 使用 PyMySQL
    maxconnections=10, # 連線池最大連線數
    mincached=2,       # 初始化時，池中至少存在的空閒連線數
    blocking=True,     # 連線池滿了後，新的請求是否要等待
    host=DB_CONFIG['host'],
    port=int(DB_CONFIG['port']),
    user=DB_CONFIG['user'],
    password=DB_CONFIG['password'],
    database=DB_CONFIG['database'],
    charset='utf8mb4',
    cursorclass=pymysql.cursors.DictCursor # 讓回傳結果自動變成 Python 字典格式
)

def get_db_connection():
    """從連線池中拿一個連線出來"""
    return pool.connection()

# ==========================================
# ⚙️ 以下為管理者後台專用：萬能資料庫操作代理
# ==========================================

ALLOWED_TABLES = [
    'areas', 'bag_regulations', 'favorites', 'notifications', 
    'routes', 'stations', 'station_schedules', 'users'
]

PRIMARY_KEYS = {
    'areas': 'areas_id', 'bag_regulations': 'reg_id', 'favorites': 'fav_id',
    'notifications': 'noti_id', 'routes': 'route_id', 'stations': 'station_id',
    'station_schedules': 'schedule_id', 'users': 'user_id'
}

def check_db_health():
    """檢查 MySQL 是否活著 (給前端紅綠燈偵測用)"""
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
        conn.close()
        return True
    except:
        return False

def get_table_structure(table_name):
    """執行 DESCRIBE 獲取 phpMyAdmin 結構資訊"""
    if table_name not in ALLOWED_TABLES:
        raise ValueError("不合法的資料表名稱")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(f"DESCRIBE `{table_name}`")
            return cursor.fetchall()
    finally:
        conn.close()

def browse_table(table_name, page=1, limit=500, search='', sort='none'):
    """萬能動態瀏覽數據與過濾引擎 (支援真實總數計算與預設主鍵小到大排序)"""
    if table_name not in ALLOWED_TABLES:
        raise ValueError("不合法的資料表名稱")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            pk = PRIMARY_KEYS.get(table_name)
            
            # 1. 建立搜尋條件 
            where_clause = ""
            params = []
            if search:
                if table_name == 'routes':
                    where_clause = " WHERE `route_name` LIKE %s OR `car_number` LIKE %s OR `route_code` LIKE %s"
                    params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
                elif table_name == 'areas':
                    where_clause = " WHERE `city` LIKE %s OR `district` LIKE %s OR `village` LIKE %s"
                    params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
                elif table_name == 'users':
                    where_clause = " WHERE `username` LIKE %s OR `email` LIKE %s"
                    params.extend([f"%{search}%", f"%{search}%"])
                elif table_name == 'stations':
                    where_clause = " WHERE `station_name` LIKE %s OR `stay_type` LIKE %s"
                    params.extend([f"%{search}%", f"%{search}%"])

            # 2. 🔥 精準計算符合該條件的資料「總筆數」
            count_sql = f"SELECT COUNT(*) as total FROM `{table_name}`" + where_clause
            cursor.execute(count_sql, params)
            total_count = cursor.fetchone()['total']
            
            # 3. 撈取當前分頁資料
            data_sql = f"SELECT * FROM `{table_name}`" + where_clause
            
            # 💡 關鍵校正：如果前端傳 none (未選擇)，後端主動強制定為 ASC (從小到大排序)
            actual_sort = sort if sort in ['ASC', 'DESC'] else 'ASC'
            if pk:
                data_sql += f" ORDER BY `{pk}` {actual_sort}"
            
            # 4. 拼裝分頁 LIMIT
            offset = (page - 1) * limit
            data_sql += " LIMIT %s OFFSET %s"
            
            data_params = list(params)
            data_params.extend([limit, offset])
            
            cursor.execute(data_sql, data_params)
            rows = cursor.fetchall()
            
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            # 回傳包裝好的資料夾
            return {"total": total_count, "data": rows, "columns": columns}
    finally:
        conn.close()