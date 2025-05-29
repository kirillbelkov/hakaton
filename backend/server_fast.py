from fastapi import FastAPI, Query
import pymysql
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import io
import csv

app = FastAPI()

# Добавляем разрешение CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Или ["http://127.0.0.1:5500"] если хочешь разрешить только твой фронт
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Настройки подключения к БД
db_config = {
    'host': 'localhost',
    'user': 'root',
    'database': 'hahaton-db',
}


def get_connection():
    return pymysql.connect(**db_config)


@app.get("/stops/gtfs")
def export_gtfs_stops():
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, name, latitude, longitude FROM stops")
            stops = cursor.fetchall()

        # Создание CSV в памяти
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["stop_id", "stop_name", "stop_lat", "stop_lon"])
        for stop in stops:
            writer.writerow(stop)

        output.seek(0)
        return StreamingResponse(output, media_type="text/csv", headers={
            "Content-Disposition": "attachment; filename=stops.txt"
        })
    finally:
        conn.close()


# Маршрут получения всех городов
@app.get("/cities")
def get_cities():
    conn = get_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM cities")
        result = cursor.fetchall()
    conn.close()
    return result


# Маршрут получения всех маршрутов
@app.get("/routes")
def get_routes():
    conn = get_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM routes")
        result = cursor.fetchall()
    conn.close()
    return result


# Маршрут получения всех типов транспорта
@app.get("/vehicle_types")
def get_vehicle_types():
    conn = get_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM vehicle_types")
        result = cursor.fetchall()
    conn.close()
    return result


# Получение transport id по vehicle_type, route и city
@app.get("/transports")
def get_transports(vehicle_type: str, route: str, city: str):
    conn = get_connection()
    with conn.cursor() as cursor:
        sql = """
            SELECT id FROM transports
            WHERE vehicle_type = %s AND route = %s AND city = %s
        """
        cursor.execute(sql, (vehicle_type, route, city))
        result = cursor.fetchall()
    conn.close()
    return result


# Получение данных из data
@app.get("/data")
def get_data(
        transport: Optional[str] = None,
        date: Optional[str] = None,
        time: Optional[str] = None
):
    conn = get_connection()
    with conn.cursor() as cursor:
        if transport and date and time:
            # По transport + date + time
            sql = """
                SELECT * FROM data
                WHERE transport = %s AND date = %s AND time = %s
            """
            cursor.execute(sql, (transport, date, time))
        elif transport and date:
            # По transport + date
            sql = """
                SELECT * FROM data
                WHERE transport = %s AND date = %s
            """
            cursor.execute(sql, (transport, date))
        elif transport:
            # Только по transport
            sql = """
                SELECT * FROM data
                WHERE transport = %s
            """
            cursor.execute(sql, (transport,))
        else:
            # Без параметров ничего не вернем
            conn.close()
            return {"error": "Specify at least transport"}

        result = cursor.fetchall()
    conn.close()
    return result


# Добавление остановки
@app.post("/stops/add")
def add_stop(name: str = Query(...), latitude: float = Query(...), longitude: float = Query(...)):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            sql = """
                INSERT INTO stops (name, latitude, longitude)
                VALUES (%s, %s, %s)
            """
            cursor.execute(sql, (name, latitude, longitude))
            conn.commit()
        return {"message": "Stop added successfully"}
    except Exception as e:
        conn.rollback()
        return {"error": str(e)}
    finally:
        conn.close()


# Получение всех остановок
@app.get("/stops")
def get_stops():
    conn = get_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM stops")
        result = cursor.fetchall()
    conn.close()
    return result
