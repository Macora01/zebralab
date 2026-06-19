// Pixels per mm in the on-screen editor (scaled for visibility)
export const DEFAULT_PX_PER_MM = 5;

export const LABEL_PRESETS = [
    { name: "50 × 30 mm", widthMm: 50, heightMm: 30 },
    { name: "50 × 100 mm", widthMm: 50, heightMm: 100 },
    { name: "100 × 50 mm", widthMm: 100, heightMm: 50 },
    { name: "Personalizado", widthMm: 50, heightMm: 30, custom: true },
];

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

// Approximate visual width of element on canvas (in mm) for selection box
export function getElementBoxMm(el) {
    if (el.type === "text") {
        const fs = el.fontSize || 3;
        const text = el.isVariable ? `{${el.variable || "var"}}` : el.data || "";
        const w = Math.max(6, fs * (el.fontWidthRatio || 1) * 0.7 * Math.max(2, text.length));
        return { w, h: fs * 1.4 };
    }
    if (el.type === "barcode") {
        if (el.symbology === "qr") {
            const m = (el.magnification || 3) * 3.5;
            return { w: m, h: m };
        }
        const text = el.isVariable ? `{${el.variable || "var"}}` : el.data || "";
        return { w: Math.max(20, text.length * 2.2), h: (el.height || 8) + 3 };
    }
    if (el.type === "rectangle") return { w: el.width || 10, h: el.height || 10 };
    if (el.type === "line") return { w: el.width || 10, h: el.height || 0.3 };
    return { w: 10, h: 10 };
}
