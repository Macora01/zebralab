import React from "react";
import { Trash, CopySimple } from "@phosphor-icons/react";
import { ZPL_FONTS, BARCODE_SYMBOLOGIES } from "@/lib/design";

const Field = ({ label, children }) => (
    <div className="mb-3">
        <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1 block">
            {label}
        </label>
        {children}
    </div>
);

const inputCls =
    "bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-2.5 py-1.5 focus:outline-none focus:border-brand-900 focus:ring-1 focus:ring-brand-900 w-full placeholder:text-brand-800/40 font-mono";

export default function PropertiesPanel({
    element,
    design,
    onUpdateElement,
    onDeleteElement,
    onDuplicateElement,
    onUpdateDesign,
}) {
    if (!element) {
        return (
            <div>
                <SectionTitle>Etiqueta</SectionTitle>
                <div className="p-4">
                    <Field label="Ancho (mm)">
                        <input
                            data-testid="prop-label-width"
                            type="number"
                            min={5}
                            max={300}
                            step="0.5"
                            value={design.widthMm}
                            onChange={(e) => onUpdateDesign({ widthMm: parseFloat(e.target.value) || 0 })}
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Alto (mm)">
                        <input
                            data-testid="prop-label-height"
                            type="number"
                            min={5}
                            max={300}
                            step="0.5"
                            value={design.heightMm}
                            onChange={(e) => onUpdateDesign({ heightMm: parseFloat(e.target.value) || 0 })}
                            className={inputCls}
                        />
                    </Field>
                    <div className="mt-6 pt-4 border-t border-brand-200">
                        <p className="text-xs text-brand-800/70 leading-relaxed">
                            Selecciona un elemento del lienzo para editar sus propiedades.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const upd = (patch) => onUpdateElement(element.id, patch);

    return (
        <div>
            <div className="px-4 py-3 border-b border-brand-200 bg-brand-50/50 flex items-center justify-between">
                <h3 className="text-sm font-headings font-semibold text-brand-900 uppercase tracking-wide">
                    {element.type === "text" && "Texto"}
                    {element.type === "barcode" && `Código (${element.symbology})`}
                    {element.type === "rectangle" && "Rectángulo"}
                    {element.type === "line" && "Línea"}
                </h3>
                <div className="flex items-center gap-1">
                    <button
                        data-testid="prop-duplicate-btn"
                        onClick={() => onDuplicateElement(element.id)}
                        className="p-1.5 text-brand-700 hover:bg-brand-100"
                        title="Duplicar"
                    >
                        <CopySimple size={16} />
                    </button>
                    <button
                        data-testid="prop-delete-btn"
                        onClick={() => onDeleteElement(element.id)}
                        className="p-1.5 text-red-700 hover:bg-red-50"
                        title="Eliminar"
                    >
                        <Trash size={16} />
                    </button>
                </div>
            </div>

            <div className="p-4">
                <div className="grid grid-cols-2 gap-2">
                    <Field label="X (mm)">
                        <input
                            type="number"
                            step="0.5"
                            value={element.x}
                            onChange={(e) => upd({ x: parseFloat(e.target.value) || 0 })}
                            className={inputCls}
                            data-testid="prop-x"
                        />
                    </Field>
                    <Field label="Y (mm)">
                        <input
                            type="number"
                            step="0.5"
                            value={element.y}
                            onChange={(e) => upd({ y: parseFloat(e.target.value) || 0 })}
                            className={inputCls}
                            data-testid="prop-y"
                        />
                    </Field>
                </div>

                <Field label="Rotación">
                    <div className="flex gap-1">
                        {[0, 90, 180, 270].map((r) => (
                            <button
                                key={r}
                                data-testid={`prop-rotation-${r}`}
                                onClick={() => upd({ rotation: r })}
                                className={`flex-1 py-1.5 text-xs font-mono border ${
                                    element.rotation === r
                                        ? "bg-brand-900 text-white border-brand-900"
                                        : "bg-white text-brand-800 border-brand-300 hover:bg-brand-100"
                                }`}
                            >
                                {r}°
                            </button>
                        ))}
                    </div>
                </Field>

                {/* TEXT */}
                {element.type === "text" && (
                    <>
                        <Field label={element.isVariable ? "Nombre de la variable" : "Contenido"}>
                            {element.isVariable ? (
                                <input
                                    data-testid="prop-variable-name"
                                    value={element.variable || ""}
                                    onChange={(e) =>
                                        upd({
                                            variable: e.target.value.replace(/[^A-Za-z0-9_]/g, "_"),
                                        })
                                    }
                                    placeholder="codigo, precio, lote..."
                                    className={inputCls}
                                />
                            ) : (
                                <input
                                    data-testid="prop-text-data"
                                    value={element.data || ""}
                                    onChange={(e) => upd({ data: e.target.value })}
                                    className={inputCls}
                                />
                            )}
                        </Field>

                        <Field label="Tipo de dato">
                            <div className="flex gap-1">
                                <button
                                    data-testid="prop-toggle-static"
                                    onClick={() => upd({ isVariable: false })}
                                    className={`flex-1 py-1.5 text-xs border ${
                                        !element.isVariable
                                            ? "bg-brand-900 text-white border-brand-900"
                                            : "bg-white text-brand-800 border-brand-300"
                                    }`}
                                >
                                    Estático
                                </button>
                                <button
                                    data-testid="prop-toggle-variable"
                                    onClick={() => upd({ isVariable: true })}
                                    className={`flex-1 py-1.5 text-xs border ${
                                        element.isVariable
                                            ? "bg-brand-900 text-white border-brand-900"
                                            : "bg-white text-brand-800 border-brand-300"
                                    }`}
                                >
                                    Variable
                                </button>
                            </div>
                        </Field>

                        <Field label="Fuente">
                            <select
                                value={element.font || "0"}
                                onChange={(e) => upd({ font: e.target.value })}
                                className={inputCls}
                                data-testid="prop-text-font"
                            >
                                {ZPL_FONTS.map((f) => (
                                    <option key={f.value} value={f.value}>
                                        {f.label}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Altura (mm)">
                                <input
                                    type="number"
                                    step="0.5"
                                    min="1"
                                    value={element.fontSize}
                                    onChange={(e) => upd({ fontSize: parseFloat(e.target.value) || 1 })}
                                    className={inputCls}
                                    data-testid="prop-text-size"
                                />
                            </Field>
                            <Field label="Ratio ancho">
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0.5"
                                    max="3"
                                    value={element.fontWidthRatio}
                                    onChange={(e) => upd({ fontWidthRatio: parseFloat(e.target.value) || 1 })}
                                    className={inputCls}
                                />
                            </Field>
                        </div>
                    </>
                )}

                {/* BARCODE */}
                {element.type === "barcode" && (
                    <>
                        <Field label="Tipo de código">
                            <select
                                data-testid="prop-barcode-symbology"
                                value={element.symbology}
                                onChange={(e) => upd({ symbology: e.target.value })}
                                className={inputCls}
                            >
                                {BARCODE_SYMBOLOGIES.map((b) => (
                                    <option key={b.value} value={b.value}>
                                        {b.label}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <Field label={element.isVariable ? "Nombre de la variable" : "Datos"}>
                            {element.isVariable ? (
                                <input
                                    data-testid="prop-barcode-variable"
                                    value={element.variable || ""}
                                    onChange={(e) =>
                                        upd({
                                            variable: e.target.value.replace(/[^A-Za-z0-9_]/g, "_"),
                                        })
                                    }
                                    placeholder="codigo, ean..."
                                    className={inputCls}
                                />
                            ) : (
                                <input
                                    data-testid="prop-barcode-data"
                                    value={element.data || ""}
                                    onChange={(e) => upd({ data: e.target.value })}
                                    className={inputCls}
                                />
                            )}
                        </Field>

                        <Field label="Tipo de dato">
                            <div className="flex gap-1">
                                <button
                                    onClick={() => upd({ isVariable: false })}
                                    className={`flex-1 py-1.5 text-xs border ${
                                        !element.isVariable
                                            ? "bg-brand-900 text-white border-brand-900"
                                            : "bg-white text-brand-800 border-brand-300"
                                    }`}
                                >
                                    Estático
                                </button>
                                <button
                                    onClick={() => upd({ isVariable: true })}
                                    className={`flex-1 py-1.5 text-xs border ${
                                        element.isVariable
                                            ? "bg-brand-900 text-white border-brand-900"
                                            : "bg-white text-brand-800 border-brand-300"
                                    }`}
                                >
                                    Variable
                                </button>
                            </div>
                        </Field>

                        {element.symbology === "qr" ? (
                            <>
                                <Field label="Magnificación (1-10)">
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={element.magnification}
                                        onChange={(e) =>
                                            upd({ magnification: parseInt(e.target.value, 10) || 1 })
                                        }
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="Corrección errores">
                                    <select
                                        value={element.ecLevel}
                                        onChange={(e) => upd({ ecLevel: e.target.value })}
                                        className={inputCls}
                                    >
                                        {["H", "Q", "M", "L"].map((v) => (
                                            <option key={v} value={v}>
                                                {v}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            </>
                        ) : (
                            <>
                                <Field label="Altura (mm)">
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="2"
                                        value={element.height}
                                        onChange={(e) => upd({ height: parseFloat(e.target.value) || 1 })}
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="Mostrar texto humano">
                                    <div className="flex gap-1">
                                        {[true, false].map((v) => (
                                            <button
                                                key={String(v)}
                                                onClick={() => upd({ humanReadable: v })}
                                                className={`flex-1 py-1.5 text-xs border ${
                                                    element.humanReadable === v
                                                        ? "bg-brand-900 text-white border-brand-900"
                                                        : "bg-white text-brand-800 border-brand-300"
                                                }`}
                                            >
                                                {v ? "Sí" : "No"}
                                            </button>
                                        ))}
                                    </div>
                                </Field>
                            </>
                        )}
                    </>
                )}

                {/* RECTANGLE */}
                {element.type === "rectangle" && (
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Ancho (mm)">
                                <input
                                    type="number"
                                    step="0.5"
                                    value={element.width}
                                    onChange={(e) => upd({ width: parseFloat(e.target.value) || 1 })}
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Alto (mm)">
                                <input
                                    type="number"
                                    step="0.5"
                                    value={element.height}
                                    onChange={(e) => upd({ height: parseFloat(e.target.value) || 1 })}
                                    className={inputCls}
                                />
                            </Field>
                        </div>
                        <Field label="Grosor (mm)">
                            <input
                                type="number"
                                step="0.1"
                                value={element.thickness}
                                onChange={(e) => upd({ thickness: parseFloat(e.target.value) || 0.1 })}
                                className={inputCls}
                            />
                        </Field>
                    </>
                )}

                {/* LINE */}
                {element.type === "line" && (
                    <>
                        <Field label="Largo (mm)">
                            <input
                                type="number"
                                step="0.5"
                                value={element.width}
                                onChange={(e) => upd({ width: parseFloat(e.target.value) || 1 })}
                                className={inputCls}
                            />
                        </Field>
                        <Field label="Grosor (mm)">
                            <input
                                type="number"
                                step="0.1"
                                value={element.height}
                                onChange={(e) => upd({ height: parseFloat(e.target.value) || 0.1 })}
                                className={inputCls}
                            />
                        </Field>
                    </>
                )}
            </div>
        </div>
    );
}

function SectionTitle({ children }) {
    return (
        <div className="px-4 py-3 border-b border-brand-200 bg-brand-50/50 flex items-center justify-between">
            <h3 className="text-sm font-headings font-semibold text-brand-900 uppercase tracking-wide">
                {children}
            </h3>
        </div>
    );
}
