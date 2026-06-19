from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import Response, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import pandas as pd
import requests

from zpl_generator import (
    generate_zpl,
    substitute_variables,
    extract_variables,
)


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="ZebraLab API")
api_router = APIRouter(prefix="/api")


# -------------------- Models --------------------
class Element(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    type: str  # text | barcode | rectangle | line
    x: float = 0
    y: float = 0
    rotation: int = 0
    # text
    data: Optional[str] = ""
    font: Optional[str] = "0"
    fontSize: Optional[float] = 3
    fontWidthRatio: Optional[float] = 1.0
    # barcode
    symbology: Optional[str] = None
    height: Optional[float] = None
    humanReadable: Optional[bool] = True
    magnification: Optional[int] = 4
    ecLevel: Optional[str] = "M"
    # shapes
    width: Optional[float] = None
    thickness: Optional[float] = 0.3
    color: Optional[str] = "black"
    # variable
    isVariable: Optional[bool] = False
    variable: Optional[str] = None


class LayoutSpec(BaseModel):
    columns: int = 1
    rows: int = 1
    gapXMm: float = 0
    gapYMm: float = 0


class Design(BaseModel):
    widthMm: float = 50
    heightMm: float = 30
    layout: LayoutSpec = Field(default_factory=LayoutSpec)
    elements: List[Element] = []


class TemplateCreate(BaseModel):
    name: str
    design: Design
    notes: Optional[str] = ""


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    design: Optional[Design] = None
    notes: Optional[str] = None


class Template(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    design: Design
    notes: Optional[str] = ""
    createdAt: str
    updatedAt: str


class GenerateRequest(BaseModel):
    design: Design
    substitutions: Optional[Dict[str, Any]] = None


# -------------------- Helpers --------------------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# -------------------- Routes --------------------
@api_router.get("/")
async def root():
    return {"message": "ZebraLab API", "version": "1.0.0"}


# ----- ZPL generation -----
@api_router.post("/zpl/generate")
async def zpl_generate(req: GenerateRequest):
    """Generate ZPL from a design. Optionally substitute variables."""
    design_dict = req.design.model_dump()
    zpl = generate_zpl(design_dict)
    if req.substitutions:
        zpl = substitute_variables(zpl, req.substitutions)
    variables = extract_variables(zpl)
    return {"zpl": zpl, "variables": variables}


@api_router.post("/zpl/export")
async def zpl_export(req: GenerateRequest):
    """Return ZPL as a downloadable .prn file."""
    design_dict = req.design.model_dump()
    zpl = generate_zpl(design_dict)
    if req.substitutions:
        zpl = substitute_variables(zpl, req.substitutions)
    return Response(
        content=zpl,
        media_type="application/octet-stream",
        headers={"Content-Disposition": "attachment; filename=etiqueta.prn"},
    )


@api_router.post("/zpl/preview")
async def zpl_preview(req: GenerateRequest):
    """Render ZPL to a PNG image via Labelary public API."""
    design_dict = req.design.model_dump()
    zpl = generate_zpl(design_dict)
    if req.substitutions:
        zpl = substitute_variables(zpl, req.substitutions)
    # Also fill any leftover placeholders with their name in brackets for visual debugging
    leftover = extract_variables(zpl)
    if leftover:
        placeholder_map = {k: f"[{k}]" for k in leftover}
        zpl_for_preview = substitute_variables(zpl, placeholder_map)
    else:
        zpl_for_preview = zpl

    width_in = req.design.widthMm / 25.4
    height_in = req.design.heightMm / 25.4

    try:
        url = f"http://api.labelary.com/v1/printers/8dpmm/labels/{width_in:.3f}x{height_in:.3f}/0/"
        resp = requests.post(
            url,
            data=zpl_for_preview.encode("utf-8"),
            headers={"Accept": "image/png"},
            timeout=20,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Labelary error: {resp.text[:200]}")
        return Response(content=resp.content, media_type="image/png")
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Preview service unavailable: {e}")


# ----- Templates CRUD -----
@api_router.post("/templates", response_model=Template)
async def create_template(payload: TemplateCreate):
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "design": payload.design.model_dump(),
        "notes": payload.notes or "",
        "createdAt": _now_iso(),
        "updatedAt": _now_iso(),
    }
    await db.templates.insert_one(doc)
    doc.pop("_id", None)
    return Template(**doc)


@api_router.get("/templates", response_model=List[Template])
async def list_templates():
    docs = await db.templates.find({}, {"_id": 0}).sort("updatedAt", -1).to_list(500)
    return [Template(**d) for d in docs]


@api_router.get("/templates/{template_id}", response_model=Template)
async def get_template(template_id: str):
    doc = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")
    return Template(**doc)


@api_router.put("/templates/{template_id}", response_model=Template)
async def update_template(template_id: str, payload: TemplateUpdate):
    existing = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    update = {"updatedAt": _now_iso()}
    if payload.name is not None:
        update["name"] = payload.name
    if payload.design is not None:
        update["design"] = payload.design.model_dump()
    if payload.notes is not None:
        update["notes"] = payload.notes
    await db.templates.update_one({"id": template_id}, {"$set": update})
    doc = await db.templates.find_one({"id": template_id}, {"_id": 0})
    return Template(**doc)


@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    result = await db.templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"ok": True}


@api_router.post("/templates/{template_id}/duplicate", response_model=Template)
async def duplicate_template(template_id: str):
    doc = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")
    new_doc = {
        "id": str(uuid.uuid4()),
        "name": f"{doc['name']} (copia)",
        "design": doc["design"],
        "notes": doc.get("notes", ""),
        "createdAt": _now_iso(),
        "updatedAt": _now_iso(),
    }
    await db.templates.insert_one(new_doc)
    new_doc.pop("_id", None)
    return Template(**new_doc)


# ----- Batch CSV/Excel -----
@api_router.post("/batch/parse")
async def batch_parse(file: UploadFile = File(...)):
    """Parse uploaded CSV or Excel; return columns and rows preview."""
    content = await file.read()
    name = (file.filename or "").lower()
    try:
        if name.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content), sep=None, engine="python", encoding="utf-8")
        elif name.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Formato no soportado. Usa .csv, .xlsx o .xls")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo: {e}")

    df = df.fillna("")
    columns = [str(c) for c in df.columns]
    rows = df.astype(str).to_dict(orient="records")
    return {
        "columns": columns,
        "rows": rows,
        "total": len(rows),
    }


class BatchGenerateRequest(BaseModel):
    design: Design
    rows: List[Dict[str, Any]]
    mapping: Dict[str, str]  # template_variable -> csv_column
    quantityColumn: Optional[str] = None  # CSV column name with copies per row


@api_router.post("/batch/generate")
async def batch_generate(req: BatchGenerateRequest):
    """Generate a single .prn with all rows concatenated (each multiplied by quantity)."""
    design_dict = req.design.model_dump()
    base_zpl = generate_zpl(design_dict)
    variables = extract_variables(base_zpl)

    chunks: List[str] = []
    total_labels = 0
    for row in req.rows:
        values: Dict[str, Any] = {}
        for var in variables:
            col = req.mapping.get(var)
            if col and col in row:
                values[var] = row[col]
            else:
                values[var] = ""
        # quantity
        qty = 1
        if req.quantityColumn and req.quantityColumn in row:
            try:
                qty = max(1, int(float(str(row[req.quantityColumn]) or "1")))
            except (ValueError, TypeError):
                qty = 1
        zpl_row = substitute_variables(base_zpl, values)
        chunks.append(zpl_row * qty)
        total_labels += qty

    final_zpl = "".join(chunks)
    return Response(
        content=final_zpl,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": "attachment; filename=lote.prn",
            "X-Total-Labels": str(total_labels),
        },
    )


# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
