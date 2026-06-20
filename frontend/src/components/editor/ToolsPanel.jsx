import React from "react";
import { TextT, Barcode, Square, LineSegment, QrCode, Image as ImageIcon } from "@phosphor-icons/react";
import { createElement } from "@/lib/design";

const TOOLS = [
    { type: "text", label: "Texto", Icon: TextT, opts: {} },
    { type: "text", label: "Texto variable", Icon: TextT, opts: { isVariable: true, variable: "campo", data: "" }, key: "text-var" },
    { type: "barcode", label: "Code 128", Icon: Barcode, opts: { symbology: "code128" } },
    { type: "barcode", label: "EAN-13", Icon: Barcode, opts: { symbology: "ean13", data: "7800000000017" } },
    { type: "barcode", label: "QR Code", Icon: QrCode, opts: { symbology: "qr" } },
    { type: "image", label: "Imagen / Logo", Icon: ImageIcon, opts: {}, key: "image" },
    { type: "rectangle", label: "Rectángulo", Icon: Square, opts: {} },
    { type: "line", label: "Línea", Icon: LineSegment, opts: {} },
];

export default function ToolsPanel({ onAdd }) {
    return (
        <div>
            <div className="px-4 py-3 border-b border-brand-200 bg-brand-50/50 flex items-center justify-between">
                <h3 className="text-sm font-headings font-semibold text-brand-900 uppercase tracking-wide">
                    Elementos
                </h3>
            </div>
            <div className="flex flex-col gap-1 p-2">
                {TOOLS.map((t, idx) => (
                    <button
                        key={t.key || `${t.type}-${idx}`}
                        data-testid={`tool-${t.key || t.type + "-" + idx}`}
                        onClick={() => onAdd(createElement(t.type, t.opts))}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-brand-800 hover:bg-brand-100 border border-transparent hover:border-brand-300 transition-all text-left"
                    >
                        <t.Icon size={18} weight="duotone" className="text-brand-700" />
                        <span>{t.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
