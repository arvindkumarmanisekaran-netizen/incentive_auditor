from fastapi import FastAPI

from .api.representatives import router as representatives_router
from .api.anomalies import router as anomalies_router
from .api.analytics import router as analytics_router
from .api.investigation import router as investigation_router
from fastapi.middleware.cors import CORSMiddleware
from .api.products import router as products_router
from .api.document_processing import router as document_processing_router

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
app.include_router(anomalies_router)
app.include_router(analytics_router)
app.include_router(investigation_router)
app.include_router(products_router)
app.include_router(document_processing_router)
