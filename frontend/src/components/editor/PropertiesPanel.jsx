import React, { useRef } from "react";
import { Trash, CopySimple, UploadSimple } from "@phosphor-icons/react";
import { ZPL_FONTS, BARCODE_SYMBOLOGIES } from "@/lib/design";
import { uploadImage, imageThumbnailUrl } from "@/lib/api";

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
        const layout = design.layout || { columns: 1, rows: 1, gapXMm: 0, gapYMm: 0 };
        const setLayout = (patch) =>
            onUpdateDesign({ layout: { ...layout, ...patch } });
        return (
            <div>
                <SectionTitle>Etiqueta (celda)</SectionTitle>
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

                    <div className="mt-5 pt-4 border-t border-brand-200">
                        <h4 className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-3">
                            Múltiples etiquetas por tirada
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Columnas">
                                <input
                                    data-testid="prop-layout-cols"
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={layout.columns}
                                    onChange={(e) => setLayout({ columns: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Filas">
                                <input
                                    data-testid="prop-layout-rows"
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={layout.rows}
                                    onChange={(e) => setLayout({ rows: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Gap X (mm)">
                                <input
                                    type="number"
                                    min={0}
                                    step="0.5"
                                    value={layout.gapXMm}
                                    onChange={(e) => setLayout({ gapXMm: parseFloat(e.target.value) || 0 })}
                                    className={inputCls}
                                    disabled={layout.columns <= 1}
                                />
                            </Field>
                            <Field label="Gap Y (mm)">
                                <input
                                    type="number"
                                    min={0}
                                    step="0.5"
                                    value={layout.gapYMm}
                                    onChange={(e) => setLayout({ gapYMm: parseFloat(e.target.value) || 0 })}
                                    className={inputCls}
                                    disabled={layout.rows <= 1}
                                />
                            </Field>
                        </div>
                        <p className="text-[11px] text-brand-700/80 mt-2 leading-snug">
                            Diseñas <strong>una sola etiqueta</strong> y se duplica automáticamente
                            en la grilla con el espacio definido (ej: 2 columnas con gap 2 mm =
                            dos etiquetas idénticas lado a lado).
                        </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-brand-200">
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
                    {element.type === "image" && "Imagen / Logo"}
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

                {/* IMAGE */}
                {element.type === "image" && (
                    <ImageProperties element={element} upd={upd} />
                )}
            </div>
        </div>
    );
}

function ImageProperties({ element, upd }) {
    const fileRef = useRef(null);
    const [uploading, setUploading] = React.useState(false);
    const [error, setError] = React.useState("");

    async function onFile(f) {
        setError("");
        setUploading(true);
        try {
            const info = await uploadImage(f);
            const ratio = info.height / Math.max(1, info.width);
            const newW = element.width || 25;
            upd({
                imageId: info.id,
                width: newW,
                height: Math.round(newW * ratio * 10) / 10,
            });
        } catch (e) {
            setError(e?.response?.data?.detail || "Error al subir la imagen");
        } finally {
            setUploading(false);
        }
    }

    return (
        <>
            <Field label="Imagen">
                {element.imageId && (
                    <div className="bg-brand-50 border border-brand-300 p-2 mb-2 flex items-center justify-center">
                        <img
                            src={imageThumbnailUrl(element.imageId)}
                            alt="preview"
                            className="max-h-24 object-contain"
                            style={{ filter: "grayscale(1) contrast(1.4)" }}
                        />
                    </div>
                )}
                <button
                    data-testid="prop-image-upload"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full px-3 py-2 bg-brand-900 text-white text-sm font-medium hover:bg-brand-800 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <UploadSimple size={16} />
                    {uploading ? "Subiendo…" : element.imageId ? "Reemplazar imagen" : "Subir imagen (PNG/JPG)"}
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/bmp,image/webp"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                />
                {error && <p className="text-red-700 text-xs mt-1.5 font-mono">{error}</p>}
            </Field>

            <div className="grid grid-cols-2 gap-2">
                <Field label="Ancho (mm)">
                    <input
                        type="number"
                        step="0.5"
                        min="2"
                        value={element.width}
                        onChange={(e) => upd({ width: parseFloat(e.target.value) || 1 })}
                        className={inputCls}
                    />
                </Field>
                <Field label="Alto (mm)">
                    <input
                        type="number"
                        step="0.5"
                        min="2"
                        value={element.height}
                        onChange={(e) => upd({ height: parseFloat(e.target.value) || 1 })}
                        className={inputCls}
                    />
                </Field>
            </div>

            <Field label="Umbral B/N">
                <input
                    type="range"
                    min="1"
                    max="254"
                    value={element.threshold || 128}
                    onChange={(e) => upd({ threshold: parseInt(e.target.value, 10) })}
                    className="w-full"
                />
                <div className="flex justify-between text-[10px] font-mono text-brand-700 mt-0.5">
                    <span>Más negro</span>
                    <span>{element.threshold || 128}</span>
                    <span>Más blanco</span>
                </div>
            </Field>
            <p className="text-[11px] text-brand-700/80 leading-snug">
                La impresora Zebra es monocromo. Ajusta el umbral para que tu imagen
                se vea bien (sobre todo en fotos o degradados).
            </p>
        </>
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
