import os

import pymysql
from dbutils.pooled_db import PooledDB

pool = PooledDB(
    creator=pymysql,
    maxconnections=10,
    mincached=2,
    blocking=True,
    host=os.environ.get('DB_HOST', 'localhost'),
    port=int(os.environ.get('DB_PORT', '3306')),
    user=os.environ.get('DB_USER', 'root'),
    password=os.environ.get('DB_PASSWORD', ''),
    database=os.environ.get('DB_NAME', 'garbage_database'),
    charset='utf8mb4',
    cursorclass=pymysql.cursors.DictCursor,
)

ALLOWED_TABLES = [
    'areas',
    'bag_regulations',
    'favorites',
    'notifications',
    'routes',
    'stations',
    'station_schedules',
    'users',
    'announcements',
    'api_sync_log',
    'bulky_waste_info',
    'etl_sources',
]

PRIMARY_KEYS = {
    'areas': 'areas_id',
    'bag_regulations': 'reg_id',
    'favorites': 'fav_id',
    'notifications': 'noti_id',
    'routes': 'route_id',
    'stations': 'station_id',
    'station_schedules': 'schedule_id',
    'users': 'user_id',
    'announcements': 'announcement_id',
    'api_sync_log': 'log_id',
    'bulky_waste_info': 'info_id',
    'etl_sources': 'source',
}

MAX_BROWSE_LIMIT = 500
_TEXT_TYPE_HINTS = ('char', 'text', 'enum', 'set', 'json')


def get_db_connection():
    return pool.connection()


def check_db_health():
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute('SELECT 1')
        conn.close()
        return True
    except Exception:
        return False


def get_table_structure(table_name):
    if table_name not in ALLOWED_TABLES:
        raise ValueError('不允許的資料表')
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(f'DESCRIBE `{table_name}`')
            return cursor.fetchall()
    finally:
        conn.close()


def _clamp_int(value, default, minimum, maximum):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    if parsed < minimum:
        return minimum
    if parsed > maximum:
        return maximum
    return parsed


def _normalize_search_text(raw_value):
    if raw_value is None:
        return ''
    return str(raw_value).strip()


def _build_search_terms(raw_search):
    base = _normalize_search_text(raw_search)
    if not base:
        return []
    return [base]


def _load_table_columns(cursor, table_name):
    cursor.execute(f'SHOW FULL COLUMNS FROM `{table_name}`')
    rows = cursor.fetchall()
    columns = [row['Field'] for row in rows]
    text_columns = []

    for row in rows:
        col_type = (row.get('Type') or '').lower()
        if any(hint in col_type for hint in _TEXT_TYPE_HINTS):
            text_columns.append(row['Field'])

    return columns, text_columns


def _parse_search_fields(raw_fields, all_columns, default_columns):
    if not raw_fields:
        return list(default_columns)

    tokens = [t.strip() for t in str(raw_fields).split(',') if t.strip()]
    invalid = [token for token in tokens if token not in all_columns]
    if invalid:
        raise ValueError(f"無效 search_fields 欄位: {', '.join(invalid)}")

    deduped = []
    for token in tokens:
        if token not in deduped:
            deduped.append(token)
    return deduped


def _parse_sort(sort_value, all_columns, default_column):
    sort_raw = (sort_value or 'none').strip()
    sort_upper = sort_raw.upper()

    if sort_raw == '' or sort_upper == 'NONE':
        return default_column, 'ASC'

    if sort_upper in ('ASC', 'DESC'):
        return default_column, sort_upper

    if ':' in sort_raw:
        sort_col, sort_dir = sort_raw.split(':', 1)
        sort_col = sort_col.strip()
        sort_dir = sort_dir.strip().upper()
        if sort_col not in all_columns:
            raise ValueError(f'無效 sort 欄位: {sort_col}')
        if sort_dir not in ('ASC', 'DESC'):
            raise ValueError(f'無效 sort 方向: {sort_dir}')
        return sort_col, sort_dir

    if sort_raw not in all_columns:
        raise ValueError(f'無效 sort 欄位: {sort_raw}')
    return sort_raw, 'ASC'


def browse_table(table_name, page=1, limit=500, search='', sort='none', search_fields=''):
    if table_name not in ALLOWED_TABLES:
        raise ValueError('不允許的資料表')

    safe_page = _clamp_int(page, default=1, minimum=1, maximum=1_000_000)
    safe_limit = _clamp_int(limit, default=50, minimum=1, maximum=MAX_BROWSE_LIMIT)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            all_columns, text_columns = _load_table_columns(cursor, table_name)
            pk = PRIMARY_KEYS.get(table_name)
            default_sort_column = pk if pk in all_columns else (all_columns[0] if all_columns else None)
            sort_column, sort_direction = _parse_sort(sort, all_columns, default_sort_column)

            search_terms = _build_search_terms(search)
            default_search_columns = text_columns if text_columns else all_columns
            selected_search_columns = _parse_search_fields(
                raw_fields=search_fields,
                all_columns=all_columns,
                default_columns=default_search_columns,
            )

            where_parts = []
            where_params = []

            if search_terms and selected_search_columns:
                for column in selected_search_columns:
                    expr = f'`{column}`' if column in text_columns else f'CAST(`{column}` AS CHAR)'

                    for term in search_terms:
                        where_parts.append(f'{expr} COLLATE utf8mb4_unicode_ci LIKE %s')
                        where_params.append(f'%{term}%')

            where_clause = f" WHERE {' OR '.join(where_parts)}" if where_parts else ''

            count_sql = f'SELECT COUNT(*) AS total FROM `{table_name}`{where_clause}'
            cursor.execute(count_sql, where_params)
            total_count = cursor.fetchone()['total']

            data_sql = f'SELECT * FROM `{table_name}`{where_clause}'
            if sort_column:
                data_sql += f' ORDER BY `{sort_column}` {sort_direction}'

            offset = (safe_page - 1) * safe_limit
            data_sql += ' LIMIT %s OFFSET %s'

            data_params = list(where_params)
            data_params.extend([safe_limit, offset])
            cursor.execute(data_sql, data_params)
            rows = cursor.fetchall()

            if table_name == 'users':
                for row in rows:
                    if 'password_hash' in row:
                        row['password_hash'] = '***'

            return {
                'total': total_count,
                'data': rows,
                'columns': all_columns,
                'page': safe_page,
                'limit': safe_limit,
                'search_columns': selected_search_columns,
                'sort': f'{sort_column}:{sort_direction.lower()}' if sort_column else None,
            }
    finally:
        conn.close()
