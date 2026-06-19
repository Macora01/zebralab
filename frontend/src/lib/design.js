// Pixels per mm in the on-screen editor (scaled for visibility)
export const DEFAULT_PX_PER_MM = 5;

export const LABEL_PRESETS = [
    { name: "50 × 30 mm", widthMm: 50, heightMm: 30, layout: { columns: 1, rows: 1, gapXMm: 0, gapYMm: 0 } },
    { name: "50 × 30 mm · ×2 horizontal", widthMm: 50, heightMm: 30, layout: { columns: 2, rows: 1, gapXMm: 2, gapYMm: 0 } },
    { name: "50 × 100 mm", widthMm: 50, heightMm: 100, layout: { columns: 1, rows: 1, gapXMm: 0, gapYMm: 0 } },
    { name: "100 × 50 mm", widthMm: 100, heightMm: 50, layout: { columns: 1, rows: 1, gapXMm: 0, gapYMm: 0 } },
    { name: "Personalizado", widthMm: 50, heightMm: 30, custom: true },
];

export const DEFAULT_LAYOUT = { columns: 1, rows: 1, gapXMm: 0, gapYMm: 0 };

export const ZPL_FONTS = [
    { value: "0", label: "Estándar (0)" },
    { value: "A", label: "A — Compacta" },
    { value: "B", label: "B — Bloque" },
    { value: "D", label: "D — Bold" },
    { value: "F", label: "F — Grande" },
];

export const BARCODE_SYMBOLOGIES = [
    { value: "qr", label: "QR Code" },
    { value: "code128", label: "Code 128" },
    { value: "ean13", label: "EAN-13" },
    { value: "ean8", label: "EAN-8" },
    { value: "code39", label: "Code 39" },
    { value: "upca", label: "UPC-A" },
];

export function newId() {
    return `el_${Math.random().toString(36).slice(2, 9)}`;
}

export function createElement(type, opts = {}) {
    const base = { id: newId(), type, x: 2, y: 2, rotation: 0 };
    if (type === "text") {
        return {
            ...base,
            data: "Texto",
            font: "0",
            fontSize: 4,
            fontWidthRatio: 1.0,
            isVariable: false,
            variable: "",
            ...opts,
        };
    }
    if (type === "barcode") {
        return {
            ...base,
            symbology: "code128",
            data: "12345",
            height: 8,
            humanReadable: true,
            magnification: 3,
            ecLevel: "M",
            isVariable: false,
            variable: "",
            ...opts,
        };
    }
    if (type === "rectangle") {
        return {
            ...base,
            width: 20,
            height: 10,
            thickness: 0.3,
            color: "black",
            ...opts,
        };
    }
    if (type === "line") {
        return { ...base, width: 20, height: 0.3, ...opts };
    }
    return base;
}

// Approximate visual dimensions (in mm) of an element AFTER applying its rotation.
// Returns the actual bounding box the element occupies on the printed label.
// These estimates intentionally err on the conservative (larger) side so the
// editor warns about overflow before it happens at print time.
export function getElementBoxMm(el) {
    let baseW = 10;
    let baseH = 10;
    if (el.type === "text") {
        const fs = el.fontSize || 3;
        const text = el.isVariable ? `{${el.variable || "var"}}` : el.data || "X";
        // ZPL fonts: characters are roughly 60-70% of font height in width.
        const charW = fs * (el.fontWidthRatio || 1) * 0.6;
        baseW = Math.max(2, charW * Math.max(1, text.length));
        baseH = fs * 1.2;
    } else if (el.type === "barcode") {
        if (el.symbology === "qr") {
            // QR module size = magnification * 0.125 mm (at 203 dpi, 1 module = mag dots)
            // For typical 10-30 char payloads -> Version 2-4 = 25-33 modules + 8 modules quiet zone
            const m = (el.magnification || 3);
            const text = el.isVariable ? `{${el.variable || "var"}}` : el.data || "";
            const modules =
                text.length <= 14 ? 25 : text.length <= 24 ? 29 : text.length <= 34 ? 33 : 37;
            const sizeMm = (modules + 8) * (m * 0.125); // include quiet zone
            baseW = sizeMm;
            baseH = sizeMm;
        } else {
            // Linear barcodes (^BY2 default => element width = 2 dots = 0.25mm)
            const text = el.isVariable ? `{${el.variable || "var"}}` : el.data || "";
            const len = Math.max(6, text.length);
            // Code128 ~ 11 modules per char + ~30 modules overhead, * 0.25mm
            // EAN13/8/UPC are fixed but we estimate generously
            const charPerMm = 0.35; // ~1 char per 0.35 mm wide approximation
            const widthMm = el.symbology === "ean13" ? 38 : el.symbology === "ean8" ? 27 : len / charPerMm + 4;
            baseW = widthMm;
            // Height + 3mm for human-readable text below if shown
            baseH = (el.height || 8) + (el.humanReadable === false ? 0 : 3.5);
        }
    } else if (el.type === "rectangle") {
        baseW = el.width || 10;
        baseH = el.height || 10;
    } else if (el.type === "line") {
        baseW = el.width || 10;
        baseH = el.height || 0.3;
    }

    // Swap dimensions when rotated 90° or 270° to reflect actual footprint
    const rot = ((el.rotation || 0) % 360 + 360) % 360;
    if (rot === 90 || rot === 270) {
        return { w: baseH, h: baseW };
    }
    return { w: baseW, h: baseH };
}
