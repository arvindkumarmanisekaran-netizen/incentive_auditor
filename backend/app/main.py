from fastapi import FastAPI

from .api.representatives import router as representatives_router
from .api.analytics import router as analytics_router
from .api.investigation import router as investigation_router
from fastapi.middleware.cors import CORSMiddleware
from .api.products import router as products_router
from .api.document_processing import router as document_processing_router
from .api.doctors import router as doctors_router
from .api.territories import router as territories_router
from .api.assignments import router as assignments_router
from .api.incentive_payouts import router as incentive_payouts_router
from .api.sales import router as sales_router
from .api.prescriptions import router as prescriptions_router
from .api.chat import router as chat_router
from .api.generate_synthetic import router as synthetic_router
from .api.workspaces import router as workspaces_router

app = FastAPI(
    title="Incentive Auditor API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Incentive Auditor API is running"}


app.include_router(representatives_router)
app.include_router(analytics_router)
app.include_router(investigation_router)
app.include_router(document_processing_router)
app.include_router(doctors_router)
app.include_router(products_router)
app.include_router(territories_router)
app.include_router(assignments_router)
app.include_router(incentive_payouts_router)
app.include_router(sales_router)
app.include_router(prescriptions_router)
app.include_router(chat_router)
app.include_router(synthetic_router)
app.include_router(workspaces_router)
