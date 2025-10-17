"""
Ejecutar SQL directamente usando psycopg2 (síncrono) para evitar problemas con asyncpg
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

# Fix encoding for Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()

def run_sql():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL no configurado")
        return

    # Convertir asyncpg URL a psycopg2 URL
    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    db_url = db_url.replace('?ssl=require', '?sslmode=require')

    print("=" * 80)
    print("EJECUTANDO MIGRACIONES SQL")
    print("=" * 80)

    # Conectar
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cursor = conn.cursor()

    # Migración 1: Crear tabla
    print("\n📋 Migración 1: Crear tabla facebook_pages")
    migration1 = Path("migrations/001_create_facebook_pages.sql").read_text(encoding='utf-8')

    try:
        cursor.execute(migration1)
        print("   ✅ Tabla creada exitosamente")
    except Exception as e:
        if 'already exists' in str(e):
            print("   ⚠️  Tabla ya existe")
        else:
            print(f"   ❌ Error: {e}")
            raise

    # Migración 2: Migrar datos
    print("\n📋 Migración 2: Migrar datos existentes")
    migration2 = Path("migrations/002_migrate_existing_facebook_data.sql").read_text(encoding='utf-8')

    try:
        cursor.execute(migration2)
        print("   ✅ Datos migrados exitosamente")

        # Mostrar resultados
        rows = cursor.fetchall()
        if rows:
            print(f"\n   📊 Páginas migradas ({len(rows)}):")
            for row in rows:
                print(f"      - {row[1]}: {row[2]} (Token: ***{row[3][-10:] if row[3] else 'N/A'})")
    except Exception as e:
        print(f"   ⚠️  {e}")

    cursor.close()
    conn.close()

    print("\n" + "=" * 80)
    print("✅ MIGRACIONES COMPLETADAS")
    print("=" * 80)

if __name__ == "__main__":
    run_sql()
