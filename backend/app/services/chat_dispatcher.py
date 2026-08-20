from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def resolve_representative(
    db: AsyncSession,
    name: str,
):

    result = await db.execute(
        text("""
            SELECT
                representative_id,
                first_name,
                last_name

            FROM representatives

            WHERE
                LOWER(first_name) LIKE LOWER(:name)
                OR
                LOWER(last_name) LIKE LOWER(:name)

            LIMIT 5
            """),
        {"name": f"%{name}%"},
    )

    reps = result.fetchall()

    if len(reps) == 0:

        return None

    if len(reps) > 1:

        return {
            "multiple": True,
            "representatives": [
                {"id": r.representative_id, "name": f"{r.first_name} {r.last_name}"} for r in reps
            ],
        }

    return {"id": reps[0].representative_id}
