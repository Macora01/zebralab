"""
ZPL Generator - Converts design JSON to Zebra ZPL II commands.

Coordinates:
- Design uses millimeters (mm) for human-friendly editing.
- ZPL uses dots. At 203 dpi (Zebra ZD220), 1 mm = 8 dots.
"""
from typing import List, Dict, Any, Optional
import re

DPI = 203
DOTS_PER_MM = DPI / 25.4  # ~8.0


def mm_to_dots(mm: float) -> int:
    return int(round(mm * DOTS_PER_MM))


# Map rotation (degrees) to ZPL orientation letter
ROTATION_MAP = {0: "N", 90: "R", 180: "I", 270: "B"}


def _orient(rotation: int) -> str:
    return ROTATION_MAP.get(int(rotation) % 360, "N")


def _escape_zpl_text(text: str) -> str:
    """ZPL data field terminator is ^FS. Caret (^) and tilde (~) are control chars.
    Replace with safe equivalents to avoid breaking the ZPL stream.
    """
    if text is None:
        return ""
    return str(text).replace("^", " ").replace("~", " ")


def generate_element_zpl(el: Dict[str, Any]) -> str:
    """Generate ZPL for a single design element."""
    el_type = el.get("type")
    x = mm_to_dots(el.get("x", 0))
    y = mm_to_dots(el.get("y", 0))
    rotation = int(el.get("rotation", 0))
    orient = _orient(rotation)

    # Data: either literal text or a variable placeholder kept as-is for
    # later substitution by the print pipeline (compatible with existing
    # BoaIdeia Tkinter script).
    data = el.get("data", "")
    is_variable = bool(el.get("isVariable", False))
    if is_variable:
        # Keep placeholder syntax {variable_name} in ZPL stream
        var_name = (el.get("variable") or "campo").strip()
        var_name = re.sub(r"[^A-Za-z0-9_]", "_", var_name)
        data_field = "{" + var_name + "}"
    else:
        data_field = _escape_zpl_text(data)

    if el_type == "text":
        font = el.get("font", "0")  # ZPL built-in font A-Z, 0
        height_mm = float(el.get("fontSize", 3))  # in mm
        h = mm_to_dots(height_mm)
        w = mm_to_dots(height_mm * float(el.get("fontWidthRatio", 1.0)))
        return f"^FO{x},{y}^A{font}{orient},{h},{w}^FD{data_field}^FS"

    if el_type == "barcode":
        symbology = (el.get("symbology") or "code128").lower()
        height_mm = float(el.get("height", 10))
        h = mm_to_dots(height_mm)
        show_text = "Y" if el.get("humanReadable", True) else "N"

        if symbology == "qr":
            magnification = int(el.get("magnification", 4))
            ec_level = el.get("ecLevel", "M")  # H,Q,M,L
            # ^BQa,b,c  a=orientation (N), b=model 2, c=magnification
            # Data prefix LA = auto encoding
            return (
                f"^FO{x},{y}^BQ{orient},2,{magnification},{ec_level}^FDLA,{data_field}^FS"
            )
        if symbology == "code128":
            return f"^FO{x},{y}^BY2^BC{orient},{h},{show_text},N,N^FD{data_field}^FS"
        if symbology == "ean13":
            return f"^FO{x},{y}^BY2^BE{orient},{h},{show_text},N^FD{data_field}^FS"
        if symbology == "ean8":
            return f"^FO{x},{y}^BY2^B8{orient},{h},{show_text},N^FD{data_field}^FS"
        if symbology == "code39":
            return f"^FO{x},{y}^BY2^B3{orient},N,{h},{show_text},N^FD{data_field}^FS"
        if symbology == "upca":
            return f"^FO{x},{y}^BY2^BU{orient},{h},{show_text},N,N^FD{data_field}^FS"
        # Fallback
        return f"^FO{x},{y}^BY2^BC{orient},{h},{show_text},N,N^FD{data_field}^FS"

    if el_type == "rectangle":
        w = mm_to_dots(float(el.get("width", 10)))
        h = mm_to_dots(float(el.get("height", 10)))
        thickness = max(1, mm_to_dots(float(el.get("thickness", 0.3))))
        color = "B" if el.get("color", "black") == "black" else "W"
        return f"^FO{x},{y}^GB{w},{h},{thickness},{color},0^FS"

    if el_type == "line":
        w = mm_to_dots(float(el.get("width", 10)))
        h = mm_to_dots(float(el.get("height", 0.3)))
        if w < 1:
            w = 1
        if h < 1:
            h = 1
        return f"^FO{x},{y}^GB{w},{h},{max(w,h)},B,0^FS"

    return ""


def generate_zpl(design: Dict[str, Any]) -> str:
    """Generate full ZPL from a design definition.

    design = {
        "widthMm": 50,
        "heightMm": 30,
        "darkness": 10,        # optional ~SD value 0-30
        "printSpeed": 4,       # optional ^PR
        "elements": [ ... ]
    }
    """
    width_mm = float(design.get("widthMm", 50))
    height_mm = float(design.get("heightMm", 30))
    pw = mm_to_dots(width_mm)
    ll = mm_to_dots(height_mm)

    lines: List[str] = []
    lines.append("CT~~CD,~CC^~CT~")
    lines.append("^XA")
    lines.append("~TA000")
    lines.append("~JSN")
    lines.append("^LT0")
    lines.append("^MNW")
    lines.append("^MTT")
    lines.append("^PON")
    lines.append("^PMN")
    lines.append("^LH0,0")
    lines.append("^JMA")
    lines.append("^PR4,4")
    lines.append("~SD15")
    lines.append("^JUS")
    lines.append("^LRN")
    lines.append("^CI27")
    lines.append(f"^PW{pw}")
    lines.append(f"^LL{ll}")

    for el in design.get("elements", []):
        zpl_el = generate_element_zpl(el)
        if zpl_el:
            lines.append(zpl_el)

    lines.append("^PQ1,0,1,Y")
    lines.append("^XZ")
    return "\n".join(lines) + "\n"


def substitute_variables(zpl: str, values: Dict[str, Any]) -> str:
    """Replace {variable} placeholders with provided values.
    Mirrors the behavior of the user's existing BoaIdeia Tkinter script,
    including the special "precio" prefix with "$ ".
    """
    out = zpl
    for key, raw_value in values.items():
        if raw_value is None:
            value = ""
        else:
            value = str(raw_value).strip()
        if key.lower() == "precio" and value and not value.startswith("$"):
            value = f"$ {value}"
        # Escape any ZPL control chars in the substituted value
        value = value.replace("^", " ").replace("~", " ")
        out = out.replace("{" + key + "}", value)
    return out


def extract_variables(zpl: str) -> List[str]:
    """Find unique {variable} placeholders in ZPL, preserving order."""
    seen = []
    for match in re.findall(r"\{(\w+)\}", zpl):
        if match not in seen:
            seen.append(match)
    return seen
