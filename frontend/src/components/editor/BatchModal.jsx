import React, { useMemo, useRef, useState } from "react";
import { X, UploadSimple, Printer, Eye, DownloadSimple } from "@phosphor-icons/react";
import { parseBatch, generateBatch, previewZpl, generateZpl } from "@/lib/api";
import { printZplDirect, getAgentConfig } from "@/lib/agent";

/**
 * Batch import + variable mapping + preview + .prn generation.
 */
export default function BatchModal({ open, onClose, design, variables }) {
    const [file, setFile] = useState(null);
    const [parsed, setParsed] = useState(null); // { columns, rows, total }
    const [mapping, setMapping] = useState({}); // { variable -> column }
    const [quantityColumn, setQuantityColumn] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileRef = useRef(null);

    React.useEffect(() => {
        if (!parsed) return;
        // Auto-map by name match
        const auto = {};
        variables.forEach((v) => {
            const exact = parsed.columns.find((c) => c.toLowerCase() === v.toLowerCase());
            if (exact) auto[v] = exact;
        });
        setMapping(auto);
        // Auto detect quantity
        const qty = parsed.columns.find((c) =>
            ["cantidad", "qty", "cant", "quantity"].includes(c.toLowerCase())
        );
        if (qty) setQuantityColumn(qty);
    }, [parsed, variables]);

    const onFile = async (f) => {
        setError("");
        setFile(f);
        setBusy(true);
        try {
            const data = await parseBatch(f);
            setParsed(data);
        } catch (e) {
            setError(e?.response?.data?.detail || "Error al leer el archivo");
            setParsed(null);
        } finally {
            setBusy(false);
        }
    };

    const totalLabels = useMemo(() => {
        if (!parsed) return 0;
        if (!quantityColumn) return parsed.total;
        let s = 0;
        for (const row of parsed.rows) {
            const v = parseInt(String(row[quantityColumn] || "1"), 10);
            s += Number.isFinite(v) && v > 0 ? v : 1;
        }
        return s;
    }, [parsed, quantityColumn]);

    async function handleGenerate() {
        setBusy(true);
        try {
            await generateBatch(design, parsed.rows, mapping, quantityColumn || null);
        } catch (e) {
            setError("Error al generar el lote");
        } finally {
            setBusy(false);
        }
    }

    async function handlePrintDirect() {
        if (!agentInfo) {
            setError("No hay agente local. Inicia el agente Python en tu Mac.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            // Build a single ZPL stream with all rows substituted (and quantity applied)
            let combinedZpl = "";
            let printed = 0;
            for (const row of parsed.rows) {
                const subs = {};
                for (const v of variables) {
                    const col = mapping[v];
                    if (col) subs[v] = row[col];
                }
                let qty = 1;
                if (quantityColumn && row[quantityColumn]) {
                    const parsedQty = parseInt(String(row[quantityColumn]), 10);
                    if (Number.isFinite(parsedQty) && parsedQty > 0) qty = parsedQty;
                }
                const { zpl } = await generateZpl(design, subs);
                combinedZpl += zpl.repeat(qty);
                printed += qty;
            }
            const cfg = getAgentConfig();
            await printZplDirect({
                zpl: combinedZpl,
                printer: cfg.printer || agentInfo.default_printer,
                copies: 1,
            });
            setError("");
            // eslint-disable-next-line no-alert
            window.alert(`✓ ${printed} etiquetas enviadas a la impresora`);
        } catch (e) {
            setError(e?.message || "Error al imprimir el lote");
        } finally {
            setBusy(false);
        }
    }

    async function handlePreviewFirst() {
        if (!parsed || parsed.rows.length === 0) return;
        const row = parsed.rows[0];
        const subs = {};
        for (const v of variables) {
            const col = mapping[v];
            if (col) subs[v] = row[col];
        }
        setBusy(true);
        try {
            const url = await previewZpl(design, subs);
            setPreviewUrl(url);
        } catch (e) {
            setError("No se pudo generar la vista previa");
        } finally {
            setBusy(false);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-6">
            <div className="bg-white w-full max-w-5xl max-h-[88vh] flex flex-col shadow-2xl border border-brand-300">
                <div className="px-5 py-3.5 border-b border-brand-200 bg-brand-50/60 flex items-center justify-between">
                    <h2 className="font-headings text-lg font-semibold text-brand-900">
                        Impresión masiva · CSV / Excel
                    </h2>
                    <button
                        data-testid="batch-close"
                        onClick={onClose}
                        className="p-1.5 text-brand-700 hover:bg-brand-100"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-5 space-y-5">
                    {/* File upload */}
                    <div>
                        <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1.5 block">
                            Archivo de datos
                        </label>
                        <div
                            data-testid="batch-dropzone"
                            onClick={() => fileRef.current?.click()}
                            className="border-2 border-dashed border-brand-300 hover:border-brand-500 hover:bg-brand-50 transition-all p-8 text-center cursor-pointer"
                        >
                            <UploadSimple size={28} className="mx-auto text-brand-600" />
                            <p className="mt-2 font-headings font-medium text-brand-900">
                                {file ? file.name : "Haz clic o arrastra un archivo .csv / .xlsx"}
                            </p>
                            <p className="text-xs text-brand-700 mt-1">
                                {parsed
                                    ? `${parsed.total} filas · ${parsed.columns.length} columnas`
                                    : "Compatible con Excel y CSV"}
                            </p>
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                                data-testid="batch-file-input"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2 font-mono">
                            {error}
                        </div>
                    )}

                    {/* Mapping */}
                    {parsed && (
                        <>
                            <div>
                                <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-2 block">
                                    Mapeo de variables
                                </label>
                                {variables.length === 0 ? (
                                    <p className="text-sm text-brand-700">
                                        El diseño no tiene variables. Añade campos variables en el editor para usar el lote.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {variables.map((v) => (
                                            <div key={v} className="flex items-center gap-3">
                                                <span className="font-mono text-sm text-brand-900 bg-brand-100 px-2 py-1.5 min-w-[140px] border border-brand-300">
                                                    {`{${v}}`}
                                                </span>
                                                <span className="text-brand-700">→</span>
                                                <select
                                                    data-testid={`batch-map-${v}`}
                                                    value={mapping[v] || ""}
                                                    onChange={(e) =>
                                                        setMapping((m) => ({
                                                            ...m,
                                                            [v]: e.target.value,
                                                        }))
                                                    }
                                                    className="flex-1 bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-3 py-1.5 focus:outline-none focus:border-brand-900"
                                                >
                                                    <option value="">— Sin asignar —</option>
                                                    {parsed.columns.map((c) => (
                                                        <option key={c} value={c}>
                                                            {c}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1.5 block">
                                    Columna de cantidad (opcional)
                                </label>
                                <select
                                    data-testid="batch-quantity-col"
                                    value={quantityColumn}
                                    onChange={(e) => setQuantityColumn(e.target.value)}
                                    className="w-full md:w-1/2 bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-3 py-2 focus:outline-none focus:border-brand-900"
                                >
                                    <option value="">— Ninguna (1 por fila) —</option>
                                    {parsed.columns.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Rows preview */}
                            <div>
                                <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1.5 block">
                                    Vista previa de datos (primeras 5 filas)
                                </label>
                                <div className="border border-brand-200 overflow-auto max-h-48">
                                    <table className="w-full text-xs font-mono">
                                        <thead className="bg-brand-100 text-brand-900">
                                            <tr>
                                                {parsed.columns.map((c) => (
                                                    <th key={c} className="px-2 py-1.5 text-left border-r border-brand-200 last:border-r-0">
                                                        {c}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsed.rows.slice(0, 5).map((row, i) => (
                                                <tr key={i} className="border-t border-brand-200">
                                                    {parsed.columns.map((c) => (
                                                        <td key={c} className="px-2 py-1 border-r border-brand-200 last:border-r-0 text-brand-950">
                                                            {row[c]}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {previewUrl && (
                                <div>
                                    <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1.5 block">
                                        Vista previa de la primera etiqueta
                                    </label>
                                    <div className="border border-brand-300 bg-brand-50 p-4 flex items-center justify-center">
                                        <img src={previewUrl} alt="preview" className="max-h-64" />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {parsed && (
                    <div className="px-5 py-3.5 border-t border-brand-200 bg-brand-50/60 flex items-center justify-between">
                        <div className="text-sm font-mono text-brand-900">
                            Total etiquetas: <strong>{totalLabels}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                data-testid="batch-preview-btn"
                                onClick={handlePreviewFirst}
                                disabled={busy}
                                className="px-4 py-2 bg-white border border-brand-300 text-brand-900 text-sm font-medium hover:bg-brand-100 flex items-center gap-2 disabled:opacity-50"
                            >
                                <Eye size={16} /> Vista previa
                            </button>
                            <button
                                data-testid="batch-generate-btn"
                                onClick={handleGenerate}
                                disabled={busy}
                                className="px-4 py-2 bg-white border border-brand-300 text-brand-900 text-sm font-medium hover:bg-brand-100 flex items-center gap-2 disabled:opacity-50"
                            >
                                <DownloadSimple size={16} /> Descargar .prn
                            </button>
                            <button
                                data-testid="batch-print-direct-btn"
                                onClick={handlePrintDirect}
                                disabled={busy || !agentInfo}
                                title={agentInfo ? "Imprimir directamente vía agente local" : "Inicia el agente local para imprimir directo"}
                                className="px-4 py-2 bg-green-700 text-white text-sm font-medium hover:bg-green-800 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-brand-400"
                            >
                                <Printer size={16} /> Imprimir ahora
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
