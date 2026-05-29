#!/usr/bin/env python3
"""
Script para crear un usuario de prueba para Facebook en la base de datos.
Este usuario NO es admin, es un usuario regular para testing.
Uso: python create_facebook_test_user.py
"""
import os
import asyncio
import secrets
import hashlib
import base64
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

# Configuración
TENANT_SLUG = "acidia"
USER_EMAIL = "facebook@acidia.app"
USER_PASSWORD = "FacebookTest123!"

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL no esta configurada en .env")
    exit(1)

# Fix SSL parameter for asyncpg
if "ssl=true" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("ssl=true", "ssl=require")


def _pbkdf2(password: str, salt: bytes) -> str:
    """Hash password using PBKDF2"""
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return base64.urlsafe_b64encode(dk).decode("utf-8")


def hash_password(password: str) -> str:
    """Create password hash with salt"""
    salt_bytes = secrets.token_bytes(16)
    salt_str = base64.urlsafe_b64encode(salt_bytes).decode("utf-8")
    hashed = _pbkdf2(password, salt_bytes)
    return f"{salt_str}:{hashed}"


async def main():
    """Create test user for Facebook"""
    print("Conectando a la base de datos...")

    engine = create_async_engine(DATABASE_URL, echo=False)

    try:
        async with engine.begin() as conn:
            # Verificar que el tenant existe
            result = await conn.execute(
                text("SELECT id FROM tenants WHERE slug = :slug"),
                {"slug": TENANT_SLUG}
            )
            tenant = result.fetchone()
            if not tenant:
                print(f"Error: Tenant '{TENANT_SLUG}' no existe")
                return

            # Verificar si el usuario ya existe
            result = await conn.execute(
                text("SELECT id, email FROM users WHERE email = :email"),
                {"email": USER_EMAIL}
            )
            user = result.fetchone()

            if user:
                print(f"[OK] Usuario '{USER_EMAIL}' ya existe (ID: {user[0]})")
                
                # Actualizar password
                password_hash = hash_password(USER_PASSWORD)
                await conn.execute(
                    text("""
                        UPDATE users
                        SET password_hash = :password_hash, updated_at = NOW()
                        WHERE email = :email
                    """),
                    {"email": USER_EMAIL, "password_hash": password_hash}
                )
                print(f"[OK] Contraseña actualizada")
            else:
                # Crear usuario de prueba (role: tenant_user, no admin)
                print(f"Creando usuario de prueba '{USER_EMAIL}'...")
                password_hash = hash_password(USER_PASSWORD)

                result = await conn.execute(
                    text("""
                        INSERT INTO users (tenant_slug, email, password_hash, role)
                        VALUES (:tenant_slug, :email, :password_hash, :role)
                        RETURNING id
                    """),
                    {
                        "tenant_slug": TENANT_SLUG,
                        "email": USER_EMAIL,
                        "password_hash": password_hash,
                        "role": "tenant_user"
                    }
                )
                user_id = result.fetchone()[0]
                print(f"[OK] Usuario creado con ID: {user_id}")

        print("\n" + "="*60)
        print("USUARIO DE PRUEBA PARA FACEBOOK")
        print("="*60)
        print(f"Email:  {USER_EMAIL}")
        print(f"Pass:   {USER_PASSWORD}")
        print(f"Tenant: {TENANT_SLUG}")
        print(f"Role:   tenant_user")
        print("="*60)

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
