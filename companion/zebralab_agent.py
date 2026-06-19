#!/usr/bin/env python3
"""
ZebraLab Local Print Agent
==========================

Mini servidor HTTP que corre en tu Mac (o cualquier máquina con CUPS/lp)
y permite a la web app ZebraLab imprimir directamente en tu Zebra ZD220
sin tener que descargar archivos .prn manualmente.

Uso:
    python3 zebralab_agent.py
    python3 zebralab_agent.py --port 17331 --printer "Zebra_..."

Endpoints:
    GET  /health     -> {"ok": true, "version": "...", "printers": [...]}
    GET  /printers   -> {"printers": [...]}
    POST /print      -> body: {"zpl": "...", "printer": "...", "copies": 1}
    POST /print_file -> form-data: file=@labels.prn

Cero dependencias externas — sólo Python 3.7+.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERSION = "1.0.0"
DEFAULT_PORT = 17331
DEFAULT_PRINTER = os.environ.get(
    "ZEBRA_PRINTER", "Zebra_Technologies_ZTC_ZD220_203dpi_ZPL"
)


def list_cups_printers():
    """Return list of installed CUPS printers (name only)."""
    try:
        out = subprocess.check_output(
            ["lpstat", "-p"], text=True, stderr=subprocess.DEVNULL
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []
    printers = []
    for line in out.splitlines():
        if line.startswith("printer "):
            parts = line.split()
            if len(parts) >= 2:
                printers.append(parts[1])
    return printers


def send_zpl_to_printer(zpl: str, printer: str):
    """Send raw ZPL data to a CUPS printer. Returns (ok, error_message)."""
    if not zpl:
        return False, "ZPL vacío"
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".zpl", delete=False, encoding="utf-8"
    ) as f:
        f.write(zpl)
        path = f.name
    try:
        result = subprocess.run(
            ["lp", "-d", printer, "-o", "raw", path],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode != 0:
            return False, (result.stderr or result.stdout).strip()
        return True, result.stdout.strip()
    except FileNotFoundError:
        return False, "Comando 'lp' no encontrado. ¿Estás en macOS/Linux con CUPS instalado?"
    except subprocess.TimeoutExpired:
        return False, "Tiempo de espera agotado al enviar a la impresora"
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


class AgentHandler(BaseHTTPRequestHandler):
    server_version = f"ZebraLabAgent/{VERSION}"
    default_printer = DEFAULT_PRINTER

    # ---------- helpers ----------
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Max-Age", "86400")

    def _json(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # noqa: A003
        sys.stderr.write(f"[ZebraLab] {self.address_string()} - {fmt % args}\n")

    # ---------- HTTP verbs ----------
    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):  # noqa: N802
        if self.path in ("/", "/health"):
            self._json(
                200,
                {
                    "ok": True,
                    "agent": "zebralab",
                    "version": VERSION,
                    "default_printer": self.default_printer,
                    "printers": list_cups_printers(),
                },
            )
            return
        if self.path == "/printers":
            self._json(200, {"printers": list_cups_printers()})
            return
        self._json(404, {"error": "Not found"})

    def do_POST(self):  # noqa: N802
        if self.path == "/print":
            self._handle_print()
            return
        self._json(404, {"error": "Not found"})

    def _handle_print(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length > 0 else b"{}"
            data = json.loads(raw.decode("utf-8") or "{}")
        except (ValueError, json.JSONDecodeError) as e:
            self._json(400, {"error": f"JSON inválido: {e}"})
            return

        zpl = (data.get("zpl") or "").strip()
        printer = data.get("printer") or self.default_printer
        try:
            copies = max(1, int(data.get("copies", 1)))
        except (TypeError, ValueError):
            copies = 1

        if not zpl or "^XA" not in zpl:
            self._json(400, {"error": "ZPL inválido (debe contener ^XA)"})
            return

        # For multiple copies we just concatenate the ZPL N times.
        payload = zpl * copies if copies > 1 else zpl
        ok, message = send_zpl_to_printer(payload, printer)
        if ok:
            self._json(200, {"ok": True, "printer": printer, "copies": copies, "message": message})
        else:
            self._json(500, {"ok": False, "error": message, "printer": printer})


def banner(port, printer):
    printers = list_cups_printers()
    print()
    print(f"  ▒▓█ ZebraLab Agent v{VERSION} █▓▒")
    print(f"      Escuchando en:    http://localhost:{port}")
    print(f"      Impresora default: {printer}")
    print(f"      CUPS detectó: {', '.join(printers) if printers else '(ninguna)'}")
    print()
    print("      ✓ Deja esta ventana abierta mientras uses la web app.")
    print("      ✓ La web detectará el agente automáticamente.")
    print("      ✓ Cierra con Ctrl+C cuando termines.")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="ZebraLab local print agent — permite imprimir desde la web app a tu Zebra"
    )
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Puerto local (default 17331)")
    parser.add_argument("--printer", default=DEFAULT_PRINTER, help="Nombre de impresora CUPS por defecto")
    args = parser.parse_args()

    AgentHandler.default_printer = args.printer

    banner(args.port, args.printer)

    server = ThreadingHTTPServer(("127.0.0.1", args.port), AgentHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    try:
        server_thread.join()
    except KeyboardInterrupt:
        print("\n  👋  ZebraLab Agent detenido")
        server.shutdown()


if __name__ == "__main__":
    main()
