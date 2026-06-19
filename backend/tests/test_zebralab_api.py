"""ZebraLab backend API tests."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read frontend/.env directly
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# -------- Health --------
def test_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert "message" in data
    assert "ZebraLab" in data["message"]


# -------- ZPL Generation --------
def _sample_design():
    return {
        "widthMm": 50,
        "heightMm": 30,
        "elements": [
            {"id": "e1", "type": "text", "x": 2, "y": 2, "data": "BOAIDEIA", "fontSize": 3},
            {"id": "e2", "type": "text", "x": 2, "y": 8, "isVariable": True, "variable": "codigo", "fontSize": 3},
            {"id": "e3", "type": "barcode", "x": 2, "y": 15, "symbology": "code128",
             "isVariable": True, "variable": "codigo", "height": 8},
            {"id": "e4", "type": "text", "x": 25, "y": 8, "isVariable": True, "variable": "precio", "fontSize": 3},
        ],
    }


def test_zpl_generate_structure(session):
    r = session.post(f"{API}/zpl/generate", json={"design": _sample_design()})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "zpl" in data and "variables" in data
    zpl = data["zpl"]
    assert zpl.startswith("CT~~CD"), f"ZPL prefix wrong: {zpl[:40]!r}"
    assert "^XA" in zpl
    assert zpl.rstrip().endswith("^XZ")
    # Variables detected
    vars_list = data["variables"]
    assert "codigo" in vars_list
    assert "precio" in vars_list


def test_zpl_generate_precio_substitution(session):
    r = session.post(
        f"{API}/zpl/generate",
        json={
            "design": _sample_design(),
            "substitutions": {"codigo": "ABC123", "precio": "9990"},
        },
    )
    assert r.status_code == 200, r.text
    zpl = r.json()["zpl"]
    assert "ABC123" in zpl
    assert "$ 9990" in zpl, f"Expected '$ 9990' in ZPL, got snippet: {zpl[-400:]}"
    # No placeholders remain for substituted variables
    assert "{precio}" not in zpl
    assert "{codigo}" not in zpl


def test_zpl_export_returns_prn(session):
    r = session.post(f"{API}/zpl/export", json={"design": _sample_design()})
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/octet-stream")
    cd = r.headers.get("content-disposition", "")
    assert "filename=etiqueta.prn" in cd
    assert r.content.startswith(b"CT~~CD")


def test_zpl_preview_returns_png(session):
    r = session.post(f"{API}/zpl/preview", json={"design": _sample_design()})
    if r.status_code == 502:
        pytest.skip("Labelary preview service unavailable (502)")
    assert r.status_code == 200
    ct = r.headers.get("content-type", "")
    assert ct.startswith("image/"), f"Expected image content-type, got {ct}"
    assert len(r.content) > 1000


# -------- Templates CRUD --------
@pytest.fixture
def created_template(session):
    payload = {
        "name": "TEST_Template",
        "design": _sample_design(),
        "notes": "test",
    }
    r = session.post(f"{API}/templates", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    yield data
    # cleanup
    session.delete(f"{API}/templates/{data['id']}")


def test_template_create_and_get(session, created_template):
    tid = created_template["id"]
    assert created_template["name"] == "TEST_Template"
    r = session.get(f"{API}/templates/{tid}")
    assert r.status_code == 200
    assert r.json()["id"] == tid


def test_template_list(session, created_template):
    r = session.get(f"{API}/templates")
    assert r.status_code == 200
    ids = [t["id"] for t in r.json()]
    assert created_template["id"] in ids


def test_template_update(session, created_template):
    tid = created_template["id"]
    r = session.put(f"{API}/templates/{tid}", json={"name": "TEST_Renamed"})
    assert r.status_code == 200
    assert r.json()["name"] == "TEST_Renamed"
    # Verify persistence
    r = session.get(f"{API}/templates/{tid}")
    assert r.json()["name"] == "TEST_Renamed"


def test_template_duplicate(session, created_template):
    tid = created_template["id"]
    r = session.post(f"{API}/templates/{tid}/duplicate")
    assert r.status_code == 200
    dup = r.json()
    assert dup["id"] != tid
    assert dup["name"].endswith("(copia)")
    # cleanup duplicate
    session.delete(f"{API}/templates/{dup['id']}")


def test_template_delete(session):
    # Create then delete
    r = session.post(f"{API}/templates", json={"name": "TEST_ToDelete", "design": _sample_design()})
    tid = r.json()["id"]
    r = session.delete(f"{API}/templates/{tid}")
    assert r.status_code == 200
    # GET should now 404
    r = session.get(f"{API}/templates/{tid}")
    assert r.status_code == 404


# -------- Batch CSV --------
CSV_CONTENT = b"codigo,precio,cantidad\nABC123,9990,2\nDEF456,1500,1\n"


def test_batch_parse_csv():
    files = {"file": ("test.csv", CSV_CONTENT, "text/csv")}
    r = requests.post(f"{API}/batch/parse", files=files)
    assert r.status_code == 200, r.text
    data = r.json()
    assert set(data["columns"]) == {"codigo", "precio", "cantidad"}
    assert data["total"] == 2
    assert len(data["rows"]) == 2


def test_batch_generate_quantity_header(session):
    # Parse first
    files = {"file": ("test.csv", CSV_CONTENT, "text/csv")}
    parsed = requests.post(f"{API}/batch/parse", files=files).json()
    payload = {
        "design": _sample_design(),
        "rows": parsed["rows"],
        "mapping": {"codigo": "codigo", "precio": "precio"},
        "quantityColumn": "cantidad",
    }
    r = session.post(f"{API}/batch/generate", json=payload)
    assert r.status_code == 200, r.text
    assert r.headers.get("X-Total-Labels") == "3"  # 2+1
    assert r.headers.get("content-type", "").startswith("application/octet-stream")
    assert b"ABC123" in r.content
    assert b"$ 9990" in r.content
