#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to run all pending migrations in order
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

MIGRATIONS = [
    "migrations/002_add_fb_user_id.sql",
    "migrations/003_add_page_settings.sql",
    "migrations/004_add_page_id_to_messages.sql",
]

async def run_migration(engine, migration_file):
    """Run a single migration file"""
    print(f"\n📄 Executing migration: {migration_file}")

    with open(migration_file, 'r', encoding='utf-8') as f:
        sql = f.read()

    async with engine.begin() as conn:
        # Separate and execute each statement
        lines = sql.split('\n')
        current_statement = []

        for line in lines:
            # Skip comments and empty lines
            stripped = line.strip()
            if not stripped or stripped.startswith('--'):
                continue

            current_statement.append(line)

            # If finds semicolon, execute the statement
            if ';' in line:
                stmt = '\n'.join(current_statement).strip()
                if stmt and not stmt.startswith('--'):
                    print(f"   Executing: {stmt[:60]}...")
                    try:
                        await conn.execute(text(stmt))
                        print(f"   ✅ OK")
                    except Exception as e:
                        error_msg = str(e)[:100]
                        # Ignore "already exists" errors
                        if "already exists" in error_msg or "duplicate" in error_msg.lower():
                            print(f"   ⚠️  Already applied: {error_msg}")
                        else:
                            print(f"   ❌ Error: {error_msg}")
                            raise
                current_statement = []

async def run_all_migrations():
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found in .env")
        return

    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

    print(f"🔗 Connecting to database...")
    engine = create_async_engine(DATABASE_URL, echo=False)

    try:
        for migration_file in MIGRATIONS:
            if os.path.exists(migration_file):
                await run_migration(engine, migration_file)
            else:
                print(f"⚠️  Migration file not found: {migration_file}")
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        await engine.dispose()

    print("\n✅ All migrations completed!")

if __name__ == "__main__":
    asyncio.run(run_all_migrations())
