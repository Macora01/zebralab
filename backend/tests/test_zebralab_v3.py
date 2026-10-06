"""
ZebraLab v3 backend tests — Focus on:
1. quantity exact multi-up fix in /api/zpl/generate
2. batch multi-up packing in /api/batch/generate
3. Basic API health
"""
import pytest
import requests
import os
import re

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Simple design with a 2-col x 2-row layout and one text element
DESIGN_2X2 = {
    "widthMm": 50,
    "heightMm": 30,
    "layout": {"columns": 2, "rows": 2, "gapXMm": 0, "gapYMm": 0},
    "elements": [
        {
            "id": "e1",
            "type": "text",
            "x": 2,
            "y": 2,
            "data": "HELLO",
            "fontSize": 3,
            "fontWidthRatio": 1.0,
            "font": "0",
            "rotation": 0,
        }
    ],
}

DESIGN_2X1 = {
    "widthMm": 50,
    "heightMm": 30,
    "layout": {"columns": 2, "rows": 1, "gapXMm": 0, "gapYMm": 0},
    "elements": [
        {
            "id": "e1",
            "type": "text",
            "x": 2,
            "y": 2,
            "data": "HELLO",
            "fontSize": 3,
            "fontWidthRatio": 1.0,
            "font": "0",
            "rotation": 0,
        }
    ],
}


def count_fo(zpl: str) -> int:
    """Count ^FO occurrences (one per label element placed)."""
    return len(re.findall(r"\^FO", zpl))


class TestBasicHealth:
    """Health check"""
    def test_api_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "version" in data
        print(f"API version: {data.get('version')}")


class TestZplGenerateQuantity:
    """Test /api/zpl/generate with quantity parameter"""

    def test_quantity_3_cols2_rows2_gives_3_fo(self):
        """quantity=3 with 2x2 layout should produce 3 ^FO (not 4)"""
        r = requests.post(
            f"{BASE_URL}/api/zpl/generate",
            json={"design": DESIGN_2X2, "quantity": 3},
            timeout=10,
        )
        assert r.status_code == 200
        zpl = r.json()["zpl"]
        fo_count = count_fo(zpl)
        print(f"quantity=3, 2x2 layout → ^FO count: {fo_count}")
        assert fo_count == 3, f"Expected 3 ^FO but got {fo_count}"

    def test_quantity_1_cols2_rows1_gives_1_fo(self):
        """quantity=1 with 2x1 layout should produce 1 ^FO (not 2)"""
        r = requests.post(
            f"{BASE_URL}/api/zpl/generate",
            json={"design": DESIGN_2X1, "quantity": 1},
            timeout=10,
        )
        assert r.status_code == 200
        zpl = r.json()["zpl"]
        fo_count = count_fo(zpl)
        print(f"quantity=1, 2x1 layout → ^FO count: {fo_count}")
        assert fo_count == 1, f"Expected 1 ^FO but got {fo_count}"

    def test_no_quantity_cols2_rows2_gives_4_fo(self):
        """No quantity with 2x2 layout should produce 4 ^FO (normal behavior)"""
        r = requests.post(
            f"{BASE_URL}/api/zpl/generate",
            json={"design": DESIGN_2X2},
            timeout=10,
        )
        assert r.status_code == 200
        zpl = r.json()["zpl"]
        fo_count = count_fo(zpl)
        print(f"no quantity, 2x2 layout → ^FO count: {fo_count}")
        assert fo_count == 4, f"Expected 4 ^FO but got {fo_count}"

    def test_basic_generate_no_image_no_quantity(self):
        """Basic /api/zpl/generate without quantity should work"""
        simple_design = {
            "widthMm": 50,
            "heightMm": 30,
            "layout": {"columns": 1, "rows": 1, "gapXMm": 0, "gapYMm": 0},
            "elements": [
                {"id": "e1", "type": "text", "x": 5, "y": 5, "data": "TEST", "fontSize": 3, "fontWidthRatio": 1.0, "font": "0", "rotation": 0}
            ],
        }
        r = requests.post(
            f"{BASE_URL}/api/zpl/generate",
            json={"design": simple_design},
            timeout=10,
        )
        assert r.status_code == 200
        data = r.json()
        assert "zpl" in data
        assert "^XA" in data["zpl"]
        assert "^XZ" in data["zpl"]
        print("Basic ZPL generate: OK")


class TestBatchGenerate:
    """Test /api/batch/generate multi-up packing"""

    def test_batch_1row_qty3_cols2_produces_3_labels(self):
        """1 CSV row, qty=3, cols=2 → should use 1 full strip (2 labels) + 1 partial strip (1 label) = 3 total ^FO"""
        design = {
            "widthMm": 50,
            "heightMm": 30,
            "layout": {"columns": 2, "rows": 1, "gapXMm": 0, "gapYMm": 0},
            "elements": [
                {"id": "e1", "type": "text", "x": 2, "y": 2, "data": "TEST", "fontSize": 3, "fontWidthRatio": 1.0, "font": "0", "rotation": 0}
            ],
        }
        r = requests.post(
            f"{BASE_URL}/api/batch/generate",
            json={
                "design": design,
                "rows": [{"qty": "3", "nombre": "TestItem"}],
                "mapping": {},
                "quantityColumn": "qty",
            },
            timeout=10,
        )
        assert r.status_code == 200
        zpl = r.content.decode("utf-8")
        # Count ^XA occurrences - should be 2 (1 full strip + 1 partial)
        xa_count = len(re.findall(r"\^XA", zpl))
        # Count total ^FO
        fo_count = count_fo(zpl)
        total_labels_header = r.headers.get("X-Total-Labels", "unknown")
        print(f"batch qty=3, cols=2 → ^XA: {xa_count}, ^FO: {fo_count}, X-Total-Labels: {total_labels_header}")
        # X-Total-Labels header should be 3
        assert total_labels_header == "3", f"Expected X-Total-Labels=3 but got {total_labels_header}"
        # Should be 2 strips: 1 full (2 cells) + 1 partial (1 cell)
        assert xa_count == 2, f"Expected 2 ^XA strips but got {xa_count}"
        # Total ^FO should be 3 (2 + 1)
        assert fo_count == 3, f"Expected 3 ^FO labels but got {fo_count}"

    def test_batch_1row_qty4_cols2_produces_4_labels(self):
        """1 CSV row, qty=4, cols=2 → 2 full strips = 4 labels, no partial"""
        design = {
            "widthMm": 50,
            "heightMm": 30,
            "layout": {"columns": 2, "rows": 1, "gapXMm": 0, "gapYMm": 0},
            "elements": [
                {"id": "e1", "type": "text", "x": 2, "y": 2, "data": "TEST", "fontSize": 3, "fontWidthRatio": 1.0, "font": "0", "rotation": 0}
            ],
        }
        r = requests.post(
            f"{BASE_URL}/api/batch/generate",
            json={
                "design": design,
                "rows": [{"qty": "4", "nombre": "TestItem"}],
                "mapping": {},
                "quantityColumn": "qty",
            },
            timeout=10,
        )
        assert r.status_code == 200
        zpl = r.content.decode("utf-8")
        xa_count = len(re.findall(r"\^XA", zpl))
        fo_count = count_fo(zpl)
        total_labels_header = r.headers.get("X-Total-Labels", "unknown")
        print(f"batch qty=4, cols=2 → ^XA: {xa_count}, ^FO: {fo_count}, X-Total-Labels: {total_labels_header}")
        assert total_labels_header == "4"
        assert xa_count == 2, f"Expected 2 full strips but got {xa_count}"
        assert fo_count == 4, f"Expected 4 ^FO but got {fo_count}"
