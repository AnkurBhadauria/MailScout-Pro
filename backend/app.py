import os
import io
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Query, UploadFile, File, Body, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from pydantic import BaseModel

from backend.services.domain_service import autocomplete_company, resolve_company_domain
from backend.services.verifier_service import verify_email_async
from backend.services.discovery_service import discover_company_leads
from backend.services.export_service import export_leads_to_csv, export_leads_to_excel

app = FastAPI(
    title="MailScout Pro - Executive & HR Cold Outreach Suite",
    description="Find & Verify B2B Decision Makers (HR, VP, Director) with Live Deliverability Verification",
    version="1.0.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class SearchRequest(BaseModel):
    company: str
    domain: Optional[str] = None
    hunter_api_key: Optional[str] = None
    verify_smtp: bool = True

class SingleVerifyRequest(BaseModel):
    email: str
    check_smtp: bool = True

class BatchSearchRequest(BaseModel):
    companies: List[str]
    hunter_api_key: Optional[str] = None
    verify_smtp: bool = True

class ExportRequest(BaseModel):
    format: str = "csv"  # "csv" or "excel"
    company_name: Optional[str] = "Leads"
    leads: List[Dict[str, Any]]


@app.get("/api/autocomplete")
async def api_autocomplete(q: str = Query(..., min_length=1)):
    """Provide real-time company autocomplete suggestions with domains and logos."""
    suggestions = await autocomplete_company(q)
    return {"suggestions": suggestions}


@app.post("/api/search")
async def api_search(req: SearchRequest):
    """Find and verify HR, VP, Director contacts for a company."""
    if not req.company and not req.domain:
        raise HTTPException(status_code=400, detail="Company name or domain is required.")

    # Resolve domain if not explicitly provided
    resolved = await resolve_company_domain(req.domain or req.company)
    company_name = req.company if req.company else resolved["name"]
    domain = resolved["domain"]

    results = await discover_company_leads(
        company_name=company_name,
        domain=domain,
        hunter_api_key=req.hunter_api_key,
        verify_smtp=req.verify_smtp
    )
    results["logo"] = resolved.get("logo")
    return results


@app.post("/api/verify-single")
async def api_verify_single(req: SingleVerifyRequest):
    """Perform real-time multi-stage verification on any email address."""
    if not req.email or "@" not in req.email:
        raise HTTPException(status_code=400, detail="Valid email address is required.")
    
    result = await verify_email_async(req.email, check_smtp=req.check_smtp)
    return result


@app.post("/api/batch-search")
async def api_batch_search(req: BatchSearchRequest):
    """Process a batch of companies, extracting and verifying leads for each."""
    if not req.companies:
        raise HTTPException(status_code=400, detail="Company list cannot be empty.")

    batch_results = []
    # Limit batch to 25 at a time for fast response
    companies_to_process = [c.strip() for c in req.companies if c.strip()][:25]

    for comp in companies_to_process:
        resolved = await resolve_company_domain(comp)
        leads_data = await discover_company_leads(
            company_name=resolved["name"],
            domain=resolved["domain"],
            hunter_api_key=req.hunter_api_key,
            verify_smtp=req.verify_smtp
        )
        leads_data["logo"] = resolved.get("logo")
        batch_results.append(leads_data)

    return {
        "total_companies": len(batch_results),
        "companies": batch_results
    }


@app.post("/api/upload-csv")
async def api_upload_csv(file: UploadFile = File(...)):
    """Upload CSV or TXT file containing company names or domains."""
    contents = await file.read()
    text = contents.decode("utf-8", errors="ignore")
    
    lines = [line.strip() for line in text.replace("\r", "\n").split("\n") if line.strip()]
    if not lines:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Detect header and clean list
    companies = []
    for line in lines:
        # If line contains comma, extract first non-empty column
        parts = [p.strip().strip('"').strip("'") for p in line.split(",") if p.strip()]
        if parts:
            first_col = parts[0]
            if first_col.lower() not in ["company", "company name", "domain", "url", "name", "website"]:
                companies.append(first_col)

    # Deduplicate while preserving order
    seen = set()
    unique_companies = []
    for c in companies:
        if c.lower() not in seen:
            seen.add(c.lower())
            unique_companies.append(c)

    return {
        "filename": file.filename,
        "count": len(unique_companies),
        "companies": unique_companies[:50]
    }


@app.post("/api/export")
async def api_export(req: ExportRequest):
    """Export lead list to CSV or Excel file."""
    if not req.leads:
        raise HTTPException(status_code=400, detail="No leads provided to export.")

    safe_title = (req.company_name or "leads").replace(" ", "_").lower()

    if req.format.lower() == "excel":
        excel_bytes = export_leads_to_excel(req.leads, company_default=req.company_name or "")
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=mailscout_{safe_title}_leads.xlsx"}
        )
    else:
        csv_text = export_leads_to_csv(req.leads, company_default=req.company_name or "")
        return Response(
            content=csv_text,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=mailscout_{safe_title}_leads.csv"}
        )


# Serve Static Frontend
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/")
async def serve_index():
    index_file = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return HTMLResponse("<h1>MailScout Pro API Running</h1><p>Frontend file not found.</p>")

