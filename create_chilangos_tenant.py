#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para crear el tenant 'chilangosdt' en la base de datos.
Ejecutar: python create_chilangos_tenant.py
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

async def create_chilangos_tenant():
    # Usar la URL directa de Render
    DATABASE_URL = "postgresql+asyncpg://zia_intern:7HpQTZ8USvvNDT4eH9nwxB6P3djpAm9C@dpg-d2i1av75r7bs73euj6k0-a.oregon-postgres.render.com/db_zia_intern?ssl=require"

    print(f"🔗 Conectando a la base de datos...")
    engine = create_async_engine(DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        # Verificar si ya existe
        result = await conn.execute(
            text("SELECT slug FROM tenants WHERE slug = 'chilangosdt'")
        )
        existing = result.first()

        if existing:
            print("✅ El tenant 'chilangosdt' ya existe")
        else:
            # Crear el tenant
            await conn.execute(
                text("""
                    INSERT INTO tenants (slug, name, whatsapp, settings)
                    VALUES ('chilangosdt', 'Chilangos Dt', NULL, '{}')
                """)
            )
            print("✅ Tenant 'chilangosdt' creado exitosamente")

        # Verificar si existe acid-ia (con guion)
        result2 = await conn.execute(
            text("SELECT slug FROM tenants WHERE slug = 'acid-ia'")
        )
        existing2 = result2.first()

        if not existing2:
            print("⚠️  El tenant 'acid-ia' no existe")
            print("   Creando tenant 'acid-ia'...")

            await conn.execute(
                text("""
                    INSERT INTO tenants (slug, name, whatsapp, settings)
                    VALUES ('acid-ia', 'Acidia', NULL, '{}')
                """)
            )
            print("✅ Tenant 'acid-ia' creado exitosamente")
        else:
            print("✅ El tenant 'acid-ia' ya existe")

        # Actualizar facebook_pages para asignar correctamente los tenants
        print("\n📝 Actualizando facebook_pages...")

        # Página Acidia (790510324145957) -> tenant acid-ia
        await conn.execute(
            text("""
                UPDATE facebook_pages
                SET tenant_slug = 'acid-ia'
                WHERE page_id = '790510324145957'
            """)
        )
        print("   ✅ Página Acidia (790510324145957) asignada a 'acid-ia'")

        # Página Chilangos Dt (791696697357141) -> tenant chilangosdt
        await conn.execute(
            text("""
                UPDATE facebook_pages
                SET tenant_slug = 'chilangosdt'
                WHERE page_id = '791696697357141'
            """)
        )
        print("   ✅ Página Chilangos Dt (791696697357141) asignada a 'chilangosdt'")

    await engine.dispose()
    print("\n🎉 Configuración completada!")
    print("\nAhora cada página está asociada a su propio tenant:")
    print("  - Acidia (790510324145957) → acid-ia")
    print("  - Chilangos Dt (791696697357141) → chilangosdt")

if __name__ == "__main__":
    asyncio.run(create_chilangos_tenant())
