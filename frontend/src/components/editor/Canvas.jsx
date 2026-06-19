import React, { useRef, useEffect, useState, useCallback } from "react";
import { getElementBoxMm } from "@/lib/design";

/**
 * Visual editing canvas with multi-up (grid) support.
 * - Edits happen in CELL 0 (the first label). Other cells render as ghosts.
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
            // Constrain to cell 0 bounds (you design within one label)
            const clampedX = Math.max(0, Math.min(cellWmm - 1, newX));
            const clampedY = Math.max(0, Math.min(cellHmm - 1, newY));
            onUpdate(drag.id, {
                x: Math.round(clampedX * 10) / 10,
                y: Math.round(clampedY * 10) / 10,
            });
        },
        [drag, pxPerMm, cellWmm, cellHmm, onUpdate]
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

                <div
                    ref={wrapperRef}
                    data-testid="label-canvas"
                    className="relative"
                    style={{ width: totalWpx, height: totalHpx }}
                    onMouseDown={() => onSelect(null)}
                >
                    {/* Render each cell as a white rectangle */}
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
                            }}
                        >
                            {multiUp && (
                                <div
                                    className={`absolute top-0.5 left-1 font-mono text-[9px] ${
                                        isPrimary ? "text-brand-900 font-bold" : "text-brand-700/70"
                                    }`}
                                >
                                    {isPrimary ? "edit" : `↻ copia`}
                                </div>
                            )}
                            {/* Render elements (in this cell). Only the primary cell is interactive */}
                            {design.elements.map((el) => (
                                <ElementBox
                                    key={`${el.id}-${r}-${c}`}
                                    el={el}
                                    selected={isPrimary && selectedId === el.id}
                                    pxPerMm={pxPerMm}
                                    isPrimary={isPrimary}
                                    onMouseDown={
                                        isPrimary
                                            ? (e) => {
                                                  // We need wrapper-relative coords; element coords are absolute in cell
                                                  // Convert by adding cell offset to drag start
                                                  e.stopPropagation();
                                                  onSelect(el.id);
                                                  const rect = wrapperRef.current.getBoundingClientRect();
                                                  setDrag({
                                                      id: el.id,
                                                      offsetX: e.clientX - rect.left - el.x * pxPerMm,
                                                      offsetY: e.clientY - rect.top - el.y * pxPerMm,
                                                  });
                                              }
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

function ElementBox({ el, selected, pxPerMm, isPrimary, onMouseDown }) {
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
            data-testid={isPrimary ? `canvas-el-${el.id}` : undefined}
            onMouseDown={onMouseDown}
            className={`absolute ${isPrimary ? "cursor-move" : "pointer-events-none"} select-none ${
                selected
                    ? "outline outline-2 outline-brand-900"
                    : isPrimary
                      ? "hover:outline hover:outline-1 hover:outline-brand-400"
                      : "opacity-70"
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
