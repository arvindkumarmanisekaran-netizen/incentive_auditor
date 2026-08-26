from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)
from fastapi import Header, HTTPException, Query
from sqlalchemy import text

from ..config import settings

DATABASE_URL = settings.database_url


# Convert:
# postgresql://...
#
# into:
# postgresql+asyncpg://...

if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql://",
        "postgresql+asyncpg://",
        1,
    )


engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)


AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db(
    x_workspace: str | None = Header(default=None),
    workspace: str | None = Query(default=None),
):

    workspace_schema = x_workspace or workspace

    if not workspace_schema or not workspace_schema.startswith("ws_"):
        raise HTTPException(status_code=401, detail="Workspace login required")

    async with AsyncSessionLocal() as session:

        try:
            exists = await session.execute(
                text("SELECT 1 FROM public.workspaces WHERE schema_name = :schema_name"),
                {"schema_name": workspace_schema},
            )

            if exists.scalar_one_or_none() is None:
                raise HTTPException(status_code=401, detail="Workspace not found")

            await session.execute(text(f'SET LOCAL search_path TO "{workspace_schema}", public'))
            yield session

        finally:

            await session.close()
