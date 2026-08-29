import asyncio
import hashlib
import re
from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import text

from ..db.session import engine
from ..synthetic.generators.canonical import generate_canonical_data


router = APIRouter(prefix="/api/workspaces", tags=["Workspaces"])


class WorkspaceLogin(BaseModel):
    username: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        value = value.strip()
        if not 3 <= len(value) <= 50:
            raise ValueError("Username must contain between 3 and 50 characters")
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", value):
            raise ValueError("Username may contain letters, numbers, dots, hyphens and underscores")
        return value


def schema_for(username: str) -> str:
    digest = hashlib.sha256(username.casefold().encode("utf-8")).hexdigest()[:20]
    return f"ws_{digest}"


async def execute_statements(connection, sql: str) -> None:
    for statement in sql.split(";"):
        if statement.strip():
            await connection.execute(text(statement))


WORKSPACE_DDL = """
CREATE TABLE IF NOT EXISTS {schema}.territories (
    territory_id VARCHAR(20) PRIMARY KEY, territory_name VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL, country VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS {schema}.representatives (
    representative_id VARCHAR(20) PRIMARY KEY, first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL, territory_id VARCHAR(20) NOT NULL,
    joining_date DATE NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS {schema}.products (
    product_id VARCHAR(20) PRIMARY KEY, product_name VARCHAR(200) NOT NULL,
    product_category VARCHAR(100), status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS {schema}.doctors (
    doctor_id VARCHAR(20) PRIMARY KEY, doctor_name VARCHAR(200) NOT NULL,
    specialization VARCHAR(100), territory_id VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS {schema}.representative_doctor_assignments (
    assignment_id VARCHAR(20) PRIMARY KEY, representative_id VARCHAR(20) NOT NULL,
    doctor_id VARCHAR(20) NOT NULL, effective_from DATE NOT NULL, effective_to DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'Active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS {schema}.prescriptions (
    prescription_id VARCHAR(20) PRIMARY KEY, prescription_date DATE NOT NULL,
    doctor_id VARCHAR(20) NOT NULL, product_id VARCHAR(20) NOT NULL, quantity INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Valid', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS {schema}.sales (
    sale_id VARCHAR(20) PRIMARY KEY, sale_date DATE NOT NULL, doctor_id VARCHAR(20) NOT NULL,
    product_id VARCHAR(20) NOT NULL, selling_territory_id VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL, sales_amount NUMERIC(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Valid', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS {schema}.incentive_programs (
    incentive_program_id VARCHAR(20) PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    products TEXT NOT NULL,
    percentage NUMERIC(7,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date),
    CHECK (percentage > 0)
);
CREATE TABLE IF NOT EXISTS {schema}.incentive_program_tiers (
    incentive_program_tier_id VARCHAR(20) PRIMARY KEY,
    incentive_program_id VARCHAR(20) NOT NULL,
    minimum_achievement NUMERIC(8,2) NOT NULL,
    maximum_achievement NUMERIC(8,2),
    multiplier NUMERIC(8,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (minimum_achievement >= 0),
    CHECK (maximum_achievement IS NULL OR maximum_achievement > minimum_achievement),
    CHECK (multiplier >= 0)
);
CREATE TABLE IF NOT EXISTS {schema}.incentive_payouts (
    payout_id VARCHAR(20) PRIMARY KEY, representative_id VARCHAR(20) NOT NULL,
    product_id VARCHAR(20) NOT NULL, payout_month DATE NOT NULL,
    sales_target NUMERIC(15,2) NOT NULL DEFAULT 0, actual_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
    sales_achievement NUMERIC(8,2) NOT NULL DEFAULT 0, base_incentive NUMERIC(15,2) NOT NULL DEFAULT 0,
    achievement_multiplier NUMERIC(6,2) NOT NULL DEFAULT 0, calculated_payout NUMERIC(15,2) NOT NULL DEFAULT 0,
    maximum_payout NUMERIC(15,2) NOT NULL DEFAULT 0, expected_payout NUMERIC(15,2) NOT NULL DEFAULT 0,
    actual_payout NUMERIC(15,2) NOT NULL DEFAULT 0, payout_difference NUMERIC(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""


SEED_TABLES = {
    "territories": (
        "territories",
        ["territory_id", "territory_name", "region", "country", "status"],
        set(),
    ),
    "representatives": (
        "representatives",
        ["representative_id", "first_name", "last_name", "territory_id", "joining_date", "status"],
        {"joining_date"},
    ),
    "products": (
        "products",
        ["product_id", "product_name", "product_category", "status"],
        set(),
    ),
    "doctors": (
        "doctors",
        ["doctor_id", "doctor_name", "specialization", "territory_id", "status"],
        set(),
    ),
    "assignments": (
        "representative_doctor_assignments",
        ["assignment_id", "representative_id", "doctor_id", "effective_from", "effective_to", "status"],
        {"effective_from", "effective_to"},
    ),
    "prescriptions": (
        "prescriptions",
        ["prescription_id", "prescription_date", "doctor_id", "product_id", "quantity", "status"],
        {"prescription_date"},
    ),
    "sales": (
        "sales",
        ["sale_id", "sale_date", "doctor_id", "product_id", "selling_territory_id", "quantity", "sales_amount", "status"],
        {"sale_date"},
    ),
    "incentive_programs": (
        "incentive_programs",
        ["incentive_program_id", "start_date", "end_date", "products", "percentage"],
        {"start_date", "end_date"},
    ),
    "incentive_program_tiers": (
        "incentive_program_tiers",
        [
            "incentive_program_tier_id",
            "incentive_program_id",
            "minimum_achievement",
            "maximum_achievement",
            "multiplier",
        ],
        set(),
    ),
    "payouts": (
        "incentive_payouts",
        [
            "payout_id", "representative_id", "product_id", "payout_month",
            "sales_target", "actual_sales", "sales_achievement", "base_incentive",
            "achievement_multiplier", "calculated_payout", "maximum_payout",
            "expected_payout", "actual_payout", "payout_difference", "status",
        ],
        {"payout_month"},
    ),
}


async def seed_workspace(connection, schema: str) -> dict[str, int]:
    data = await asyncio.to_thread(
        generate_canonical_data,
        num_territories=50,
        num_representatives=30,
        num_products=30,
        num_doctors=300,
    )

    counts: dict[str, int] = {}

    for dataset_name, (table_name, columns, date_columns) in SEED_TABLES.items():
        records = data.get(dataset_name, [])
        if not records:
            counts[table_name] = 0
            continue

        prepared_records = []
        for record in records:
            prepared = {column: record.get(column) for column in columns}
            for column in date_columns:
                value = prepared.get(column)
                if isinstance(value, str) and value:
                    prepared[column] = date.fromisoformat(value)
            prepared_records.append(prepared)

        column_sql = ", ".join(columns)
        value_sql = ", ".join(f":{column}" for column in columns)
        await connection.execute(
            text(f'INSERT INTO "{schema}".{table_name} ({column_sql}) VALUES ({value_sql})'),
            prepared_records,
        )
        counts[table_name] = len(prepared_records)

    return counts


@router.post("/login")
async def login(payload: WorkspaceLogin):
    schema = schema_for(payload.username)
    seeded_records: dict[str, int] = {}

    try:
        async with engine.begin() as connection:
            await connection.execute(text("""
                CREATE TABLE IF NOT EXISTS public.workspaces (
                    username_key VARCHAR(50) PRIMARY KEY,
                    display_name VARCHAR(50) NOT NULL,
                    schema_name VARCHAR(64) UNIQUE NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_login_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """))
            result = await connection.execute(
                text("SELECT schema_name FROM public.workspaces WHERE username_key = :username_key"),
                {"username_key": payload.username.casefold()},
            )
            existing_schema = result.scalar_one_or_none()
            created = existing_schema is None

            if created:
                await connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
                await execute_statements(connection, WORKSPACE_DDL.format(schema=f'"{schema}"'))
                seeded_records = await seed_workspace(connection, schema)
                await connection.execute(
                    text("""
                        INSERT INTO public.workspaces (username_key, display_name, schema_name)
                        VALUES (:username_key, :display_name, :schema_name)
                    """),
                    {"username_key": payload.username.casefold(), "display_name": payload.username, "schema_name": schema},
                )
            else:
                schema = existing_schema
                # Apply additive workspace schema updates on every login so
                # existing workspaces receive newly introduced tables.
                await execute_statements(connection, WORKSPACE_DDL.format(schema=f'"{schema}"'))
                await connection.execute(
                    text("UPDATE public.workspaces SET last_login_at = CURRENT_TIMESTAMP WHERE username_key = :username_key"),
                    {"username_key": payload.username.casefold()},
                )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to prepare workspace") from exc

    return {
        "username": payload.username,
        "workspace": schema,
        "created": created,
        "seeded_records": seeded_records,
    }
