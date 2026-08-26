import hashlib
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import text

from ..db.session import engine


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


SEED_SQL = """
INSERT INTO {schema}.territories VALUES
('T001','Central Metro','Central','India','Active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('T002','North Metro','North','India','Active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
INSERT INTO {schema}.representatives VALUES
('REP001','Asha','Rao','T001','2024-01-15','Active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('REP002','Vikram','Shah','T002','2024-03-10','Active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
INSERT INTO {schema}.products VALUES
('PRD001','CardioCare','Cardiology','Active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('PRD002','GlucoBalance','Diabetes','Active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
INSERT INTO {schema}.doctors VALUES
('DOC001','Dr Meera Iyer','Cardiology','T001','Active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('DOC002','Dr Rohan Gupta','Diabetology','T002','Active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
INSERT INTO {schema}.representative_doctor_assignments VALUES
('ASG001','REP001','DOC001','2026-01-01',NULL,'Active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('ASG002','REP002','DOC002','2026-01-01',NULL,'Active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
INSERT INTO {schema}.prescriptions VALUES
('RX001','2026-07-08','DOC001','PRD001',120,'Valid',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('RX002','2026-07-12','DOC002','PRD002',85,'Valid',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
INSERT INTO {schema}.sales VALUES
('SAL001','2026-07-10','DOC001','PRD001','T001',135,27000,'Valid',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('SAL002','2026-07-15','DOC002','PRD002','T002',82,16400,'Valid',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
INSERT INTO {schema}.incentive_payouts VALUES
('PAY001','REP001','PRD001','2026-07-01',25000,27000,108,2000,1.2,2400,3000,2400,2500,100,'Paid',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('PAY002','REP002','PRD002','2026-07-01',18000,16400,91.11,1800,1,1800,2500,1800,1800,0,'Paid',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
"""


@router.post("/login")
async def login(payload: WorkspaceLogin):
    schema = schema_for(payload.username)

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
                await execute_statements(connection, SEED_SQL.format(schema=f'"{schema}"'))
                await connection.execute(
                    text("""
                        INSERT INTO public.workspaces (username_key, display_name, schema_name)
                        VALUES (:username_key, :display_name, :schema_name)
                    """),
                    {"username_key": payload.username.casefold(), "display_name": payload.username, "schema_name": schema},
                )
            else:
                schema = existing_schema
                await connection.execute(
                    text("UPDATE public.workspaces SET last_login_at = CURRENT_TIMESTAMP WHERE username_key = :username_key"),
                    {"username_key": payload.username.casefold()},
                )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to prepare workspace") from exc

    return {"username": payload.username, "workspace": schema, "created": created}
