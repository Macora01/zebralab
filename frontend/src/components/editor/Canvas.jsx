import React, { useRef, useEffect, useState, useCallback } from "react";
import { getElementBoxMm } from "@/lib/design";

/**
 * Visual editing canvas.
 * - Renders the label as a white rectangle on the tan workspace.
 * - Elements are absolutely positioned divs.
 * - Drag to move; click to select.
 */
export default function Canvas({
    design,
    selectedId,
    onSelect,
    onUpdate,
    pxPerMm,
}) {
    const wrapperRef = useRef(null);
    const widthPx = design.widthMm * pxPerMm;
    const heightPx = design.heightMm * pxPerMm;

    const [drag, setDrag] = useState(null);

    const onMouseDownEl = (e, el) => {
        e.stopPropagation();
        onSelect(el.id);
        const rect = wrapperRef.current.getBoundingClientRect();
        setDrag({
            id: el.id,
            offsetX: e.clientX - rect.left - el.x * pxPerMm,
            offsetY: e.clientY - rect.top - el.y * pxPerMm,
        });
    };

    const onMouseMove = useCallback(
        (e) => {
            if (!drag) return;
            const rect = wrapperRef.current.getBoundingClientRect();
            const newX = (e.clientX - rect.left - drag.offsetX) / pxPerMm;
            const newY = (e.clientY - rect.top - drag.offsetY) / pxPerMm;
            const clampedX = Math.max(0, Math.min(design.widthMm - 1, newX));
            const clampedY = Math.max(0, Math.min(design.heightMm - 1, newY));
            onUpdate(drag.id, {
                x: Math.round(clampedX * 10) / 10,
                y: Math.round(clampedY * 10) / 10,
            });
        },
        [drag, pxPerMm, design.widthMm, design.heightMm, onUpdate]
    );

    const onMouseUp = useCallback(() => setDrag(null), []);

    useEffect(() => {
        if (!drag) return;
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [drag, onMouseMove, onMouseUp]);

    return (
        <div className="flex items-center justify-center w-full h-full">
            <div className="flex flex-col items-center gap-3">
                {/* Ruler / dimension label */}
                <div className="font-mono text-[11px] text-brand-800 tracking-wider">
                    {design.widthMm} × {design.heightMm} mm
                </div>

                <div
                    ref={wrapperRef}
                    data-testid="label-canvas"
                    className="relative bg-white shadow-md border border-brand-300 canvas-grid"
                    style={{ width: widthPx, height: heightPx }}
                    onMouseDown={() => onSelect(null)}
                >
                    {design.elements.map((el) => (
                        <ElementBox
                            key={el.id}
                            el={el}
                            selected={selectedId === el.id}
                            pxPerMm={pxPerMm}
                            onMouseDown={(e) => onMouseDownEl(e, el)}
                        />
                    ))}
                </div>

                <div className="font-mono text-[10px] text-brand-800/70">
                    Vista de edición · 1 mm ≈ {pxPerMm}px
                </div>
            </div>
        </div>
    );
}

function ElementBox({ el, selected, pxPerMm, onMouseDown }) {
    const { w, h } = getElementBoxMm(el);
    const style = {
        left: el.x * pxPerMm,
        top: el.y * pxPerMm,
        width: w * pxPerMm,
        height: h * pxPerMm,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        transformOrigin: "top left",
    };

    const label = el.isVariable ? `{${el.variable || "campo"}}` : el.data || "";

    return (
        <div
            data-testid={`canvas-el-${el.id}`}
            onMouseDown={onMouseDown}
            className={`absolute cursor-move select-none ${
                selected
                    ? "outline outline-2 outline-brand-900"
                    : "hover:outline hover:outline-1 hover:outline-brand-400"
            }`}
            style={style}
        >
            {el.type === "text" && (
                <div
                    className={`w-full h-full flex items-center font-mono ${
                        el.isVariable
                            ? "text-brand-700 bg-brand-100/70 border border-dashed border-brand-400 px-1"
                            : "text-brand-950"
                    }`}
                    style={{
                        fontSize: Math.max(8, (el.fontSize || 3) * pxPerMm * 0.7),
                        lineHeight: 1,
                    }}
                >
                    {label || <span className="opacity-40">Texto</span>}
                </div>
            )}
            {el.type === "barcode" && (
                <div className="w-full h-full bg-brand-100 border border-brand-700 flex flex-col items-center justify-center text-[9px] text-brand-900 font-mono overflow-hidden">
                    <div className="uppercase tracking-wider opacity-70">
                        {el.symbology}
                    </div>
                    <div className="truncate px-1">{label || "—"}</div>
                </div>
            )}
            {el.type === "rectangle" && (
                <div
                    className="w-full h-full"
                    style={{
                        border: `${Math.max(1, (el.thickness || 0.3) * pxPerMm)}px solid ${
                            el.color === "white" ? "#bbb" : "#3e2a1f"
                        }`,
                        background: "transparent",
                    }}
                />
            )}
            {el.type === "line" && (
                <div
                    className="w-full"
                    style={{
                        height: Math.max(1, (el.height || 0.3) * pxPerMm),
                        background: "#3e2a1f",
                    }}
                />
            )}
            {selected && <div className="el-handle" style={{ right: -4, bottom: -4 }} />}
        </div>
    );
}
