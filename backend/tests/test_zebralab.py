"""ZebraLab backend API tests"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCore:
    """Core API health and agent endpoints"""

    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert "ZebraLab" in data.get("message", "")

    def test_agent_download(self):
        r = requests.get(f"{BASE_URL}/api/agent/download")
        assert r.status_code == 200
        assert "zebralab_agent.py" in r.headers.get("content-disposition", "")
        assert "^" in r.text or "def " in r.text  # Python script content

    def test_permissions_policy_header(self):
        """The response must include the Chrome PNA header"""
        r = requests.get(BASE_URL)
        pp = r.headers.get("permissions-policy", "")
        assert "private-network-access" in pp, f"Missing Permissions-Policy header, got: {pp!r}"


class TestRawEndpoints:
    """Raw ZPL variable and batch endpoints"""

    SAMPLE_ZPL = "^XA^FO50,50^FD{name}^FS^FO50,80^FD{sku}^FS^XZ"

    def test_raw_variables(self):
        r = requests.post(f"{BASE_URL}/api/raw/variables",
                          json={"zpl": self.SAMPLE_ZPL})
        assert r.status_code == 200
        data = r.json()
        assert "variables" in data
        assert "name" in data["variables"]
        assert "sku" in data["variables"]

    def test_raw_variables_no_vars(self):
        r = requests.post(f"{BASE_URL}/api/raw/variables",
                          json={"zpl": "^XA^FDHello^FS^XZ"})
        assert r.status_code == 200
        assert r.json()["variables"] == []

    def test_raw_batch(self):
        rows = [{"name": "Product A", "sku": "SKU-001"},
                {"name": "Product B", "sku": "SKU-002"}]
        r = requests.post(f"{BASE_URL}/api/raw/batch",
                          json={"zpl": self.SAMPLE_ZPL,
                                "rows": rows,
                                "mapping": {"name": "name", "sku": "sku"}})
        assert r.status_code == 200
        assert r.headers.get("x-total-labels") == "2"
        assert "Product A" in r.text
        assert "Product B" in r.text

    def test_raw_batch_with_quantity(self):
        rows = [{"name": "X", "sku": "Y", "qty": "3"}]
        r = requests.post(f"{BASE_URL}/api/raw/batch",
                          json={"zpl": self.SAMPLE_ZPL,
                                "rows": rows,
                                "mapping": {"name": "name", "sku": "sku"},
                                "quantityColumn": "qty"})
        assert r.status_code == 200
        assert r.headers.get("x-total-labels") == "3"


class TestTemplates:
    """Template CRUD"""

    def test_list_templates(self):
        r = requests.get(f"{BASE_URL}/api/templates")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_and_delete_template(self):
        payload = {"name": "TEST_template_zebralab", "kind": "raw",
                   "rawZpl": "^XA^FDTest^FS^XZ"}
        r = requests.post(f"{BASE_URL}/api/templates", json=payload)
        assert r.status_code == 200
        tid = r.json()["id"]
        assert r.json()["name"] == payload["name"]

        # verify persistence
        r2 = requests.get(f"{BASE_URL}/api/templates/{tid}")
        assert r2.status_code == 200

        # cleanup
        rd = requests.delete(f"{BASE_URL}/api/templates/{tid}")
        assert rd.status_code == 200
