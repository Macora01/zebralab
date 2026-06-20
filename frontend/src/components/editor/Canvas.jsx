import React, { useRef, useEffect, useState, useCallback } from "react";
import { getElementBoxMm } from "@/lib/design";

/**
 * Visual editing canvas with multi-up (grid) support.
 * - Edits happen in CELL 0 (the first label). Other cells render as ghosts.
 * - Element rendering uses the rotation-aware bounding box (mirrors ZPL footprint).
 */
export default function Canvas({
    design,
    selectedId,
    onSelect,
    onUpdate,
    pxPerMm,
}) {
    const wrapperRef = useRef(null);
    const layout = design.layout || { columns: 1, rows: 1, gapXMm: 0, gapYMm: 0 };
    const cols = layout.columns || 1;
    const rows = layout.rows || 1;
    const gapX = layout.gapXMm || 0;
    const gapY = layout.gapYMm || 0;

    const cellWmm = design.widthMm;
    const cellHmm = design.heightMm;
    const totalWmm = cols * cellWmm + (cols - 1) * gapX;
    const totalHmm = rows * cellHmm + (rows - 1) * gapY;
    const totalWpx = totalWmm * pxPerMm;
    const totalHpx = totalHmm * pxPerMm;

    const [drag, setDrag] = useState(null);

    const startDrag = (e, el, cellOffsetXmm, cellOffsetYmm) => {
        e.stopPropagation();
        onSelect(el.id);
        const rect = wrapperRef.current.getBoundingClientRect();
        // El.x/y are in CELL coords; we drag relative to the cell origin
        setDrag({
            id: el.id,
            cellOx: cellOffsetXmm * pxPerMm,
            cellOy: cellOffsetYmm * pxPerMm,
            offsetX: e.clientX - rect.left - (cellOffsetXmm + el.x) * pxPerMm,
            offsetY: e.clientY - rect.top - (cellOffsetYmm + el.y) * pxPerMm,
        });
    };

    const onMouseMove = useCallback(
        (e) => {
            if (!drag) return;
            const el = design.elements.find((x) => x.id === drag.id);
            if (!el) return;
            const box = getElementBoxMm(el);
            const rect = wrapperRef.current.getBoundingClientRect();
            const newX = (e.clientX - rect.left - drag.offsetX - drag.cellOx) / pxPerMm;
            const newY = (e.clientY - rect.top - drag.offsetY - drag.cellOy) / pxPerMm;
            // Allow placing right at the edge (no -1) but clamp considering element bbox
            const clampedX = Math.max(0, Math.min(Math.max(0, cellWmm - box.w), newX));
            const clampedY = Math.max(0, Math.min(Math.max(0, cellHmm - box.h), newY));
            onUpdate(drag.id, {
                x: Math.round(clampedX * 10) / 10,
                y: Math.round(clampedY * 10) / 10,
            });
        },
        [drag, design.elements, pxPerMm, cellWmm, cellHmm, onUpdate]
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

    const cellPositions = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            cellPositions.push({
                r,
                c,
                xMm: c * (cellWmm + gapX),
                yMm: r * (cellHmm + gapY),
                isPrimary: r === 0 && c === 0,
            });
        }
    }

    const multiUp = cols > 1 || rows > 1;

    // Compute overflow elements for warning
    const overflowIds = design.elements
        .filter((el) => {
            const b = getElementBoxMm(el);
            return el.x + b.w > cellWmm + 0.1 || el.y + b.h > cellHmm + 0.1;
        })
        .map((el) => el.id);

    return (
        <div className="flex items-center justify-center w-full h-full">
            <div className="flex flex-col items-center gap-3">
                <div className="font-mono text-[11px] text-brand-800 tracking-wider">
                    {totalWmm} × {totalHmm} mm
                    {multiUp && (
                        <span className="ml-2 text-brand-600">
                            (cell {cellWmm}×{cellHmm} · {cols}×{rows} · gap {gapX}/{gapY} mm)
                        </span>
                    )}
                </div>

                {overflowIds.length > 0 && (
                    <div
                        data-testid="overflow-warning"
                        className="font-mono text-[11px] text-red-700 bg-red-50 border border-red-300 px-2.5 py-1"
                    >
                        ⚠ {overflowIds.length} elemento{overflowIds.length > 1 ? "s" : ""} se sale{overflowIds.length > 1 ? "n" : ""} de la etiqueta
                    </div>
                )}

                <div
                    ref={wrapperRef}
                    data-testid="label-canvas"
                    className="relative"
                    style={{ width: totalWpx, height: totalHpx }}
                    onMouseDown={() => onSelect(null)}
                >
                    {cellPositions.map(({ r, c, xMm, yMm, isPrimary }) => (
                        <div
                            key={`cell-${r}-${c}`}
                            className={`absolute bg-white shadow-md canvas-grid ${
                                isPrimary
                                    ? "border-2 border-brand-900"
                                    : "border border-dashed border-brand-400 opacity-60"
                            }`}
                            style={{
                                left: xMm * pxPerMm,
                                top: yMm * pxPerMm,
                                width: cellWmm * pxPerMm,
                                height: cellHmm * pxPerMm,
                                overflow: "hidden",
                            }}
                        >
                            {multiUp && (
                                <div
                                    className={`absolute top-0.5 left-1 font-mono text-[9px] z-10 pointer-events-none ${
                                        isPrimary ? "text-brand-900 font-bold" : "text-brand-700/70"
                                    }`}
                                >
                                    {isPrimary ? "edit" : "↻ copia"}
                                </div>
                            )}
                            {design.elements.map((el) => (
                                <ElementBox
                                    key={`${el.id}-${r}-${c}`}
                                    el={el}
                                    selected={isPrimary && selectedId === el.id}
                                    overflow={overflowIds.includes(el.id)}
                                    pxPerMm={pxPerMm}
                                    isPrimary={isPrimary}
                                    onMouseDown={
                                        isPrimary
                                            ? (e) => startDrag(e, el, xMm, yMm)
                                            : undefined
                                    }
                                />
                            ))}
                        </div>
                    ))}
                </div>

                <div className="font-mono text-[10px] text-brand-800/70">
                    Vista de edición · 1 mm ≈ {pxPerMm}px
                    {multiUp && " · solo editas la primera etiqueta"}
                </div>
            </div>
        </div>
    );
}

function ElementBox({ el, selected, overflow, pxPerMm, isPrimary, onMouseDown }) {
    const { w, h } = getElementBoxMm(el);
    const rot = ((el.rotation || 0) % 360 + 360) % 360;

    const style = {
        left: el.x * pxPerMm,
        top: el.y * pxPerMm,
        width: w * pxPerMm,
        height: h * pxPerMm,
    };

    const label = el.isVariable ? `{${el.variable || "campo"}}` : el.data || "";
    const isVertical = rot === 90 || rot === 270;

    const outlineCls = overflow
        ? "outline outline-2 outline-red-600"
        : selected
          ? "outline outline-2 outline-brand-900"
          : isPrimary
            ? "hover:outline hover:outline-1 hover:outline-brand-400"
            : "opacity-70";

    return (
        <div
            data-testid={isPrimary ? `canvas-el-${el.id}` : undefined}
            onMouseDown={onMouseDown}
            className={`absolute ${isPrimary ? "cursor-move" : "pointer-events-none"} select-none ${outlineCls}`}
            style={style}
        >
            {el.type === "text" && (
                <div
                    className={`w-full h-full flex items-center justify-center font-mono px-0.5 ${
                        el.isVariable
                            ? "text-brand-700 bg-brand-100/70 border border-dashed border-brand-400"
                            : "text-brand-950"
                    } overflow-hidden`}
                    style={{
                        fontSize: Math.max(7, (el.fontSize || 3) * pxPerMm * 0.55),
                        lineHeight: 1,
                        writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
                        transform: rot === 270 ? "rotate(180deg)" : rot === 180 ? "rotate(180deg)" : undefined,
                    }}
                >
                    {label || <span className="opacity-40">Texto</span>}
                </div>
            )}
            {el.type === "barcode" && (
                <div
                    className={`w-full h-full bg-brand-100 border border-brand-700 flex items-center justify-center text-[9px] text-brand-900 font-mono overflow-hidden ${
                        isVertical ? "flex-row" : "flex-col"
                    }`}
                >
                    {el.symbology === "qr" ? (
                        <div className="flex flex-col items-center">
                            <div className="font-bold tracking-wider">QR</div>
                            <div className="truncate px-1 max-w-full text-[8px]">{label || "—"}</div>
                        </div>
                    ) : (
                        <>
                            <div
                                className="uppercase tracking-wider opacity-70"
                                style={{
                                    writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
                                }}
                            >
                                {el.symbology}
                            </div>
                            <div
                                className="truncate px-1"
                                style={{
                                    writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
                                    maxWidth: "100%",
                                }}
                            >
                                {label || "—"}
                            </div>
                        </>
                    )}
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
            {el.type === "image" && (
                <div className="w-full h-full bg-brand-50 border border-brand-300 overflow-hidden flex items-center justify-center">
                    {el.imageId ? (
                        <img
                            src={`${process.env.REACT_APP_BACKEND_URL}/api/image/${el.imageId}/thumbnail`}
                            alt="logo"
                            className="w-full h-full object-contain"
                            style={{ filter: "grayscale(1) contrast(1.4)" }}
                            draggable={false}
                        />
                    ) : (
                        <span className="text-[10px] text-brand-700 px-2 text-center">
                            Sin imagen · sube una
                        </span>
                    )}
                </div>
            )}
            {selected && (
                <div className="el-handle" style={{ right: -4, bottom: -4 }} />
            )}
        </div>
    );
}
