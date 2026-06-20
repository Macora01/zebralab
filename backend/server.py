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
    # image
    imageId: Optional[str] = None
    threshold: Optional[int] = 128


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
    design: Optional[Design] = None
    notes: Optional[str] = ""
    kind: Optional[str] = "visual"  # "visual" or "raw"
    rawZpl: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    design: Optional[Design] = None
    notes: Optional[str] = None
    rawZpl: Optional[str] = None


class Template(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    design: Optional[Design] = None
    notes: Optional[str] = ""
    kind: str = "visual"
    rawZpl: Optional[str] = None
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


@api_router.get("/agent/download")
async def download_agent():
    """Serve the local print agent Python script as a download."""
    agent_path = ROOT_DIR.parent / "companion" / "zebralab_agent.py"
    if not agent_path.exists():
        raise HTTPException(status_code=404, detail="Agent script not found")
    content = agent_path.read_text(encoding="utf-8")
    return Response(
        content=content,
        media_type="text/x-python",
        headers={"Content-Disposition": "attachment; filename=zebralab_agent.py"},
    )


# ----- Image upload (for logo / images in labels) -----
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
ALLOWED_IMG_EXT = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}


@api_router.post("/image/upload")
async def upload_image(file: UploadFile = File(...)):
    from PIL import Image as PILImage
    name = (file.filename or "image").lower()
    ext = next((e for e in ALLOWED_IMG_EXT if name.endswith(e)), None)
    if not ext:
        raise HTTPException(status_code=400, detail="Formato no soportado (PNG, JPG, GIF, BMP, WEBP)")
    image_id = uuid.uuid4().hex
    target = UPLOADS_DIR / f"{image_id}{ext}"
    content = await file.read()
    target.write_bytes(content)
    try:
        with PILImage.open(target) as img:
            w, h = img.size
    except Exception as e:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Imagen inválida: {e}")
    return {"id": image_id, "width": w, "height": h, "ext": ext}


@api_router.get("/image/{image_id}/thumbnail")
async def get_thumbnail(image_id: str):
    from PIL import Image as PILImage
    safe = "".join(c for c in image_id if c.isalnum())
    candidates = list(UPLOADS_DIR.glob(f"{safe}.*"))
    if not candidates:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    img_path = candidates[0]
    buf = io.BytesIO()
    with PILImage.open(img_path) as img:
        img.thumbnail((400, 400))
        img.convert("RGB").save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


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
        "design": payload.design.model_dump() if payload.design else None,
        "notes": payload.notes or "",
        "kind": payload.kind or "visual",
        "rawZpl": payload.rawZpl,
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
        "design": doc.get("design"),
        "notes": doc.get("notes", ""),
        "kind": doc.get("kind", "visual"),
        "rawZpl": doc.get("rawZpl"),
        "createdAt": _now_iso(),
        "updatedAt": _now_iso(),
    }
    await db.templates.insert_one(new_doc)
    new_doc.pop("_id", None)
    return Template(**new_doc)


@api_router.post("/templates/import-prn", response_model=Template)
async def import_prn_template(file: UploadFile = File(...), name: Optional[str] = Form(None)):
    """Import an existing .prn / .zpl file as a 'raw' template that preserves
    the original ZPL byte-for-byte. Useful to bring in ZebraDesigner outputs.
    """
    content_bytes = await file.read()
    try:
        content = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        content = content_bytes.decode("latin-1", errors="ignore")
    if "^XA" not in content:
        raise HTTPException(status_code=400, detail="Archivo inválido: no contiene comandos ZPL (^XA)")
    display_name = name or (file.filename or "Importado").rsplit(".", 1)[0]
    doc = {
        "id": str(uuid.uuid4()),
        "name": display_name,
        "design": None,
        "notes": f"Importado desde {file.filename or 'archivo'}",
        "kind": "raw",
        "rawZpl": content,
        "createdAt": _now_iso(),
        "updatedAt": _now_iso(),
    }
    await db.templates.insert_one(doc)
    doc.pop("_id", None)
    return Template(**doc)


# ----- Raw ZPL preview/export (for imported .prn templates) -----
class RawRequest(BaseModel):
    zpl: str
    substitutions: Optional[Dict[str, Any]] = None
    widthMm: Optional[float] = None
    heightMm: Optional[float] = None


def _extract_dimensions_from_zpl(zpl: str) -> tuple:
    """Extract widthMm and heightMm from ^PW and ^LL commands in ZPL."""
    import re
    pw_match = re.search(r"\^PW(\d+)", zpl)
    ll_match = re.search(r"\^LL(\d+)", zpl)
    from zpl_generator import DOTS_PER_MM
    width_dots = int(pw_match.group(1)) if pw_match else 400
    height_dots = int(ll_match.group(1)) if ll_match else 240
    return width_dots / DOTS_PER_MM, height_dots / DOTS_PER_MM


@api_router.post("/raw/variables")
async def raw_variables(req: RawRequest):
    return {"variables": extract_variables(req.zpl)}


@api_router.post("/raw/export")
async def raw_export(req: RawRequest):
    zpl = req.zpl
    if req.substitutions:
        zpl = substitute_variables(zpl, req.substitutions)
    return Response(
        content=zpl,
        media_type="application/octet-stream",
        headers={"Content-Disposition": "attachment; filename=etiqueta.prn"},
    )


@api_router.post("/raw/preview")
async def raw_preview(req: RawRequest):
    zpl = req.zpl
    if req.substitutions:
        zpl = substitute_variables(zpl, req.substitutions)
    # Fill remaining placeholders for visual preview
    leftover = extract_variables(zpl)
    if leftover:
        zpl_for_preview = substitute_variables(zpl, {k: f"[{k}]" for k in leftover})
    else:
        zpl_for_preview = zpl

    w_mm, h_mm = (req.widthMm, req.heightMm) if req.widthMm and req.heightMm else _extract_dimensions_from_zpl(zpl)
    width_in = w_mm / 25.4
    height_in = h_mm / 25.4
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
