#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para ejecutar la migración 002_add_fb_user_id.sql
"""
import os
import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

# Fix encoding for Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()

async def run_migration(migration_file=None):
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("❌ DATABASE_URL no encontrado en .env")
        return

    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

    print(f"🔗 Conectando a la base de datos...")
    engine = create_async_engine(DATABASE_URL, echo=False)

    # Leer el archivo de migración
    if not migration_file:
        migration_file = "migrations/003_add_page_settings.sql"
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql = f.read()

    print(f"Ejecutando migración: {migration_file}")

    async with engine.begin() as conn:
        # Separar y ejecutar cada statement
        lines = sql.split('\n')
        current_statement = []

        for line in lines:
            # Saltar comentarios y líneas vacías
            stripped = line.strip()
            if not stripped or stripped.startswith('--'):
                continue

            current_statement.append(line)

            # Si encuentra un punto y coma, ejecutar el statement
            if ';' in line:
                stmt = '\n'.join(current_statement).strip()
                if stmt and not stmt.startswith('--'):
                    print(f"   Ejecutando: {stmt[:60]}...")
                    try:
                        await conn.execute(text(stmt))
                        print(f"   ✅ OK")
                    except Exception as e:
                        print(f"   ⚠️  {str(e)[:100]}")
                current_statement = []

    await engine.dispose()
    print("\n✅ Migración completada!")

if __name__ == "__main__":
    migration_file = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(run_migration(migration_file))
