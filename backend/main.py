import csv
import mysql.connector

# Настройки подключения к БД
DB_HOST = 'localhost'
DB_USER = 'root'
DB_NAME = 'hahaton-db'
CSV_FILE = 'kek.csv'  # путь к вашему CSV файлу

# Подключение к базе данных
conn = mysql.connector.connect(
    host=DB_HOST,
    user=DB_USER,
    database=DB_NAME
)
cursor = conn.cursor()

# Открытие и чтение CSV файла
with open(CSV_FILE, newline='', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        name = row['stop_name']
        latitude = float(row['latitude'])
        longitude = float(row['longitude'])

        sql = """
        INSERT INTO stops (name, latitude, longitude)
        VALUES (%s, %s, %s)
        """
        cursor.execute(sql, (name, latitude, longitude))

# Сохранение изменений и закрытие соединения
conn.commit()
cursor.close()
conn.close()

print("Импорт данных завершён успешно.")
