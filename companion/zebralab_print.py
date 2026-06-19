"""
ZebraLab — Impresor companion para Mac
Versión 2.0 (compatible con tu script funciona_ok.py original)

Este script puede:
  1. Imprimir un .prn descargado desde ZebraLab.app (modo simple)
  2. Tomar el ZPL desde el portapapeles (Cmd+C en la app web -> "Copiar ZPL")
  3. Watcher: monitorea una carpeta y envía a la Zebra cualquier .prn nuevo

Uso desde terminal:
    python zebralab_print.py archivo.prn              # imprime un archivo
    python zebralab_print.py --clipboard              # imprime desde portapapeles
    python zebralab_print.py --watch ~/Downloads      # observa carpeta
    python zebralab_print.py --list                   # lista impresoras CUPS

Requisitos: pyperclip (opcional, solo para --clipboard)
"""
import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

PRINTER_NAME = os.environ.get(
    "ZEBRA_PRINTER", "Zebra_Technologies_ZTC_ZD220_203dpi_ZPL"
)


def print_zpl_content(zpl: str, printer: str = PRINTER_NAME) -> bool:
    """Send ZPL content (string) raw to the Zebra printer via CUPS."""
    tmp = Path("/tmp/zebralab_print.zpl")
    tmp.write_text(zpl, encoding="utf-8")
    try:
        subprocess.run(["lp", "-d", printer, "-o", "raw", str(tmp)], check=True)
        print(f"✔ Enviado a {printer}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✘ Error al imprimir: {e}", file=sys.stderr)
        return False


def print_file(path: str) -> bool:
    p = Path(path)
    if not p.exists():
        print(f"✘ Archivo no encontrado: {path}", file=sys.stderr)
        return False
    return print_zpl_content(p.read_text(encoding="utf-8", errors="ignore"))


def print_from_clipboard() -> bool:
    try:
        import pyperclip
    except ImportError:
        print("✘ Instala pyperclip: pip install pyperclip", file=sys.stderr)
        return False
    zpl = pyperclip.paste()
    if not zpl or "^XA" not in zpl:
        print("✘ El portapapeles no contiene ZPL válido (debe incluir ^XA)", file=sys.stderr)
        return False
    return print_zpl_content(zpl)


def list_printers() -> None:
    subprocess.run(["lpstat", "-p"], check=False)


def watch_folder(folder: str) -> None:
    print(f"👁  Observando: {folder}\nImprimiré automáticamente cualquier .prn que aparezca. Ctrl+C para salir.\n")
    seen: set[str] = set(os.listdir(folder))
    while True:
        try:
            time.sleep(1.5)
            current = set(os.listdir(folder))
            new = current - seen
            for f in sorted(new):
                if f.lower().endswith((".prn", ".zpl")):
                    full = os.path.join(folder, f)
                    print(f"→ Detectado: {f}")
                    print_file(full)
            seen = current
        except KeyboardInterrupt:
            print("\n✋ Detenido")
            return


def main() -> None:
    ap = argparse.ArgumentParser(description="ZebraLab companion printer")
    ap.add_argument("file", nargs="?", help="Archivo .prn a imprimir")
    ap.add_argument("--clipboard", action="store_true", help="Imprimir desde el portapapeles")
    ap.add_argument("--watch", metavar="FOLDER", help="Vigilar carpeta para imprimir automáticamente")
    ap.add_argument("--list", action="store_true", help="Listar impresoras CUPS instaladas")
    ap.add_argument("--printer", help="Nombre de la impresora (default: %(default)s)", default=PRINTER_NAME)
    args = ap.parse_args()

    if args.list:
        list_printers()
        return
    if args.clipboard:
        print_from_clipboard()
        return
    if args.watch:
        watch_folder(args.watch)
        return
    if args.file:
        print_file(args.file)
        return
    ap.print_help()


if __name__ == "__main__":
    main()
