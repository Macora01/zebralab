import React, { useEffect, useRef, useState, useMemo } from "react";
import {
    X, Printer, DownloadSimple, Eye, ArrowsClockwise,
    Warning, CheckCircle, FileText, UploadSimple, Stack,
} from "@phosphor-icons/react";
import { rawVariables, rawPreview, rawExport, parseBatch, rawBatch } from "@/lib/api";
import { printZplDirect, getAgentConfig } from "@/lib/agent";

const TAB_SINGLE = "single";
const TAB_BATCH  = "batch";

export default function RawTemplateModal({ open, template, onClose, agentInfo }) {
    const [tab, setTab] = useState(TAB_SINGLE);

    if (!open || !template) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-6">
            <div className="bg-white w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-brand-300">

                {/* Header */}
                <div className="px-5 py-3.5 border-b border-brand-200 bg-brand-50/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText size={20} weight="duotone" className="text-brand-900" />
                        <h2 className="font-headings text-lg font-semibold text-brand-900">{template.name}</h2>
                        <span className="font-mono text-[10px] bg-brand-100 text-brand-700 px-2 py-0.5 border border-brand-300 uppercase tracking-wider">
                            .prn importado
                        </span>
                    </div>
                    <button data-testid="raw-modal-close" onClick={onClose} className="p-1.5 text-brand-700 hover:bg-brand-100">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-brand-200">
                    <button
                        data-testid="raw-tab-single"
                        onClick={() => setTab(TAB_SINGLE)}
                        className={`px-5 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                            tab === TAB_SINGLE
                                ? "border-brand-900 text-brand-900"
                                : "border-transparent text-brand-700 hover:text-brand-900"
                        }`}
                    >
                        <Printer size={15} /> Etiqueta individual
                    </button>
                    <button
                        data-testid="raw-tab-batch"
                        onClick={() => setTab(TAB_BATCH)}
                        className={`px-5 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                            tab === TAB_BATCH
                                ? "border-brand-900 text-brand-900"
                                : "border-transparent text-brand-700 hover:text-brand-900"
                        }`}
                    >
                        <Stack size={15} /> Lote CSV/XLSX
                    </button>
                </div>

                {tab === TAB_SINGLE
                    ? <SingleTab template={template} agentInfo={agentInfo} onClose={onClose} />
                    : <BatchTab  template={template} agentInfo={agentInfo} />
                }
            </div>
        </div>
    );
}

/* ─────────────────────────────── SINGLE TAB ─────────────────────────────── */
function SingleTab({ template, agentInfo, onClose }) {
    const [variables, setVariables] = useState([]);
    const [substitutions, setSubstitutions] = useState({});
    const [previewUrl, setPreviewUrl] = useState(null);
    const [copies, setCopies] = useState(1);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        if (!template?.rawZpl) return;
        setError(""); setSuccess(""); setCopies(1);
        rawVariables(template.rawZpl)
            .then((vars) => {
                setVariables(vars);
                const init = {};
                vars.forEach((v) => { init[v] = ""; });
                setSubstitutions(init);
                refreshPreview(init);
            })
            .catch(() => setError("No se pudieron cargar las variables del archivo .prn"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [template]);

    async function refreshPreview(subs = substitutions) {
        setBusy(true);
        try {
            const url = await rawPreview(template.rawZpl, subs);
            setPreviewUrl(url);
        } catch {
            setError("No se pudo generar la vista previa");
        } finally {
            setBusy(false);
        }
    }

    async function handleDownload() {
        setBusy(true); setError("");
        try {
            await rawExport(template.rawZpl, substitutions, `${template.name}.prn`);
            setSuccess(`✓ "${template.name}.prn" descargado`);
        } catch { setError("Error al exportar"); }
        finally { setBusy(false); }
    }

    async function handlePrint() {
        setBusy(true); setError(""); setSuccess("");
        try {
            const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/raw/export`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ zpl: template.rawZpl, substitutions }),
            });
            const zpl = await res.text();
            const cfg = getAgentConfig();
            await printZplDirect({ zpl, printer: cfg.printer || agentInfo?.default_printer, copies });
            setSuccess(`✓ Enviado a la impresora (${copies} ${copies === 1 ? "etiqueta" : "etiquetas"})`);
        } catch (e) { setError(e?.message || "Error al imprimir"); }
        finally { setBusy(false); }
    }

    const agentOk = !!agentInfo;
    const printer = getAgentConfig().printer || agentInfo?.default_printer || "(no configurada)";

    return (
        <>
            <div className="flex-1 overflow-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <div className="bg-brand-50 border border-brand-200 px-3 py-2.5 text-sm font-mono text-brand-900 mb-4">
                        Impresora: <span className="font-bold">{printer}</span>
                    </div>

                    {variables.length > 0 ? (
                        <div className="mb-4">
                            <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-2 block">
                                Variables ({variables.length})
                            </label>
                            <div className="space-y-2">
                                {variables.map((v) => (
                                    <div key={v} className="flex items-center gap-2">
                                        <span className="font-mono text-xs text-brand-900 bg-brand-100 px-2 py-1.5 min-w-[120px] border border-brand-300">{`{${v}}`}</span>
                                        <input
                                            data-testid={`raw-var-${v}`}
                                            value={substitutions[v] ?? ""}
                                            onChange={(e) => setSubstitutions((s) => ({ ...s, [v]: e.target.value }))}
                                            className="flex-1 bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-2.5 py-1.5 focus:outline-none focus:border-brand-900 font-mono"
                                        />
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => refreshPreview()} className="mt-3 px-3 py-1.5 text-xs bg-white border border-brand-300 text-brand-900 hover:bg-brand-100 flex items-center gap-1.5 font-medium">
                                <ArrowsClockwise size={14} /> Actualizar vista previa
                            </button>
                        </div>
                    ) : (
                        <p className="mb-4 text-sm text-brand-700">Sin variables — se imprime tal cual.</p>
                    )}

                    <div>
                        <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1.5 block">Copias</label>
                        <input data-testid="raw-copies" type="number" min={1} max={500} value={copies}
                            onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-32 bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-2.5 py-1.5 font-mono focus:outline-none focus:border-brand-900" />
                    </div>

                    {error && <div className="mt-3 bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 font-mono flex items-start gap-2"><Warning size={18} className="shrink-0 mt-0.5" /><div>{error}</div></div>}
                    {success && <div className="mt-3 bg-green-50 border border-green-300 text-green-900 text-sm px-3 py-2 flex items-start gap-2"><CheckCircle size={18} className="shrink-0 mt-0.5" /><div>{success}</div></div>}
                </div>

                <div className="bg-brand-100/40 border border-brand-200 p-6 flex items-center justify-center min-h-[300px]">
                    {busy && <p className="text-brand-700 font-mono text-sm">Renderizando…</p>}
                    {!busy && previewUrl && (
                        <img data-testid="raw-preview-img" src={previewUrl} alt="preview"
                            className="max-w-full max-h-[420px] shadow-md border border-brand-300 bg-white" />
                    )}
                </div>
            </div>

            <div className="px-5 py-3.5 border-t border-brand-200 bg-brand-50/60 flex items-center justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 bg-white border border-brand-300 text-brand-900 text-sm font-medium hover:bg-brand-100">Cerrar</button>
                <button data-testid="raw-download-btn" onClick={handleDownload} disabled={busy}
                    className="px-4 py-2 bg-white border border-brand-300 text-brand-900 text-sm font-medium hover:bg-brand-100 flex items-center gap-2 disabled:opacity-50">
                    <DownloadSimple size={16} /> Descargar .prn
                </button>
                <button data-testid="raw-print-btn" onClick={handlePrint} disabled={busy || !agentOk}
                    title={agentOk ? "Imprimir vía agente local" : "Inicia el agente local para imprimir directo"}
                    className="px-4 py-2 bg-green-700 text-white text-sm font-medium hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-brand-400 flex items-center gap-2">
                    <Printer size={16} />
                    {busy ? "Enviando…" : `Imprimir ${copies > 1 ? `(${copies})` : ""}`}
                </button>
            </div>
        </>
    );
}

/* ─────────────────────────────── BATCH TAB ──────────────────────────────── */
function BatchTab({ template, agentInfo }) {
    const fileRef = useRef(null);
    const [file, setFile] = useState(null);
    const [parsed, setParsed] = useState(null);
    const [variables, setVariables] = useState([]);
    const [mapping, setMapping] = useState({});
    const [quantityColumn, setQuantityColumn] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [previewUrl, setPreviewUrl] = useState(null);

    // Detect variables from PRN on mount
    useEffect(() => {
        if (!template?.rawZpl) return;
        rawVariables(template.rawZpl)
            .then(setVariables)
            .catch(() => setVariables([]));
    }, [template]);

    // Auto-map when parsed changes
    useEffect(() => {
        if (!parsed || variables.length === 0) return;
        const auto = {};
        variables.forEach((v) => {
            const match = parsed.columns.find((c) => c.toLowerCase() === v.toLowerCase());
            if (match) auto[v] = match;
        });
        setMapping(auto);
        const qtyCol = parsed.columns.find((c) =>
            ["cantidad", "qty", "cant", "quantity"].includes(c.toLowerCase())
        );
        if (qtyCol) setQuantityColumn(qtyCol);
    }, [parsed, variables]);

    async function onFile(f) {
        setError(""); setPreviewUrl(null); setFile(f);
        setBusy(true);
        try {
            const data = await parseBatch(f);
            setParsed(data);
        } catch (e) {
            setError(e?.response?.data?.detail || "Error al leer el archivo");
            setParsed(null);
        } finally { setBusy(false); }
    }

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

    async function handlePreview() {
        if (!parsed || parsed.rows.length === 0) return;
        const row = parsed.rows[0];
        const subs = {};
        variables.forEach((v) => { const col = mapping[v]; if (col) subs[v] = row[col]; });
        setBusy(true);
        try {
            const url = await rawPreview(template.rawZpl, subs);
            setPreviewUrl(url);
        } catch { setError("No se pudo generar la vista previa"); }
        finally { setBusy(false); }
    }

    async function handleDownload() {
        setBusy(true); setError(""); setSuccess("");
        try {
            const total = await rawBatch(
                template.rawZpl,
                parsed.rows,
                mapping,
                quantityColumn || null,
                `${template.name}_lote.prn`
            );
            setSuccess(`✓ ${total} etiquetas descargadas`);
        } catch { setError("Error al generar el lote"); }
        finally { setBusy(false); }
    }

    async function handlePrintDirect() {
        if (!agentInfo) { setError("No hay agente local activo."); return; }
        setBusy(true); setError(""); setSuccess("");
        try {
            // Build combined ZPL client-side for agent
            let combinedZpl = "";
            let printed = 0;
            for (const row of parsed.rows) {
                const subs = {};
                variables.forEach((v) => { const col = mapping[v]; if (col) subs[v] = row[col] ?? ""; });
                let qty = 1;
                if (quantityColumn && row[quantityColumn]) {
                    const q = parseInt(String(row[quantityColumn]), 10);
                    if (Number.isFinite(q) && q > 0) qty = q;
                }
                // substitute via backend
                const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/raw/export`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ zpl: template.rawZpl, substitutions: subs }),
                });
                const zpl = await res.text();
                combinedZpl += zpl.repeat(qty);
                printed += qty;
            }
            const cfg = getAgentConfig();
            await printZplDirect({ zpl: combinedZpl, printer: cfg.printer || agentInfo.default_printer, copies: 1 });
            setSuccess(`✓ ${printed} etiquetas enviadas a la impresora`);
        } catch (e) { setError(e?.message || "Error al imprimir el lote"); }
        finally { setBusy(false); }
    }

    const agentOk = !!agentInfo;

    return (
        <>
            <div className="flex-1 overflow-auto p-5 space-y-5">

                {/* File upload */}
                <div>
                    <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1.5 block">
                        Archivo de datos
                    </label>
                    <div
                        data-testid="raw-batch-dropzone"
                        onClick={() => fileRef.current?.click()}
                        className="border-2 border-dashed border-brand-300 hover:border-brand-500 hover:bg-brand-50 transition-all p-8 text-center cursor-pointer"
                    >
                        <UploadSimple size={28} className="mx-auto text-brand-600" />
                        <p className="mt-2 font-headings font-medium text-brand-900">
                            {file ? file.name : "Haz clic o arrastra un archivo .csv / .xlsx"}
                        </p>
                        <p className="text-xs text-brand-700 mt-1">
                            {parsed ? `${parsed.total} filas · ${parsed.columns.length} columnas` : "Compatible con Excel y CSV"}
                        </p>
                        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                            data-testid="raw-batch-file-input"
                            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                    </div>
                </div>

                {error && <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2 font-mono">{error}</div>}
                {success && <div className="bg-green-50 border border-green-200 text-green-900 text-sm px-3 py-2 flex items-center gap-2"><CheckCircle size={16} />{success}</div>}

                {parsed && (
                    <>
                        {/* Variable mapping */}
                        <div>
                            <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-2 block">
                                Mapeo de variables
                            </label>
                            {variables.length === 0 ? (
                                <p className="text-sm text-brand-700">El archivo .prn no tiene variables.</p>
                            ) : (
                                <div className="space-y-2">
                                    {variables.map((v) => (
                                        <div key={v} className="flex items-center gap-3">
                                            <span className="font-mono text-sm text-brand-900 bg-brand-100 px-2 py-1.5 min-w-[140px] border border-brand-300">{`{${v}}`}</span>
                                            <span className="text-brand-700">→</span>
                                            <select
                                                data-testid={`raw-batch-map-${v}`}
                                                value={mapping[v] || ""}
                                                onChange={(e) => setMapping((m) => ({ ...m, [v]: e.target.value }))}
                                                className="flex-1 bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-3 py-1.5 focus:outline-none focus:border-brand-900"
                                            >
                                                <option value="">— Sin asignar —</option>
                                                {parsed.columns.map((c) => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quantity column */}
                        <div>
                            <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1.5 block">
                                Columna de cantidad (opcional)
                            </label>
                            <select
                                data-testid="raw-batch-qty-col"
                                value={quantityColumn}
                                onChange={(e) => setQuantityColumn(e.target.value)}
                                className="w-full md:w-1/2 bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-3 py-2 focus:outline-none focus:border-brand-900"
                            >
                                <option value="">— Ninguna (1 por fila) —</option>
                                {parsed.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Data preview */}
                        <div>
                            <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1.5 block">
                                Vista previa de datos (primeras 5 filas)
                            </label>
                            <div className="border border-brand-200 overflow-auto max-h-48">
                                <table className="w-full text-xs font-mono">
                                    <thead className="bg-brand-100 text-brand-900">
                                        <tr>{parsed.columns.map((c) => <th key={c} className="px-2 py-1.5 text-left border-r border-brand-200 last:border-r-0">{c}</th>)}</tr>
                                    </thead>
                                    <tbody>
                                        {parsed.rows.slice(0, 5).map((row, i) => (
                                            <tr key={i} className="border-t border-brand-200">
                                                {parsed.columns.map((c) => <td key={c} className="px-2 py-1 border-r border-brand-200 last:border-r-0 text-brand-950">{String(row[c] ?? "")}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Label preview */}
                        {previewUrl && (
                            <div>
                                <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1.5 block">
                                    Vista previa (primera etiqueta)
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
                        <button data-testid="raw-batch-preview-btn" onClick={handlePreview} disabled={busy}
                            className="px-4 py-2 bg-white border border-brand-300 text-brand-900 text-sm font-medium hover:bg-brand-100 flex items-center gap-2 disabled:opacity-50">
                            <Eye size={16} /> Vista previa
                        </button>
                        <button data-testid="raw-batch-download-btn" onClick={handleDownload} disabled={busy}
                            className="px-4 py-2 bg-white border border-brand-300 text-brand-900 text-sm font-medium hover:bg-brand-100 flex items-center gap-2 disabled:opacity-50">
                            <DownloadSimple size={16} /> Descargar .prn
                        </button>
                        <button data-testid="raw-batch-print-btn" onClick={handlePrintDirect} disabled={busy || !agentOk}
                            title={agentOk ? "Imprimir vía agente local" : "Inicia el agente local"}
                            className="px-4 py-2 bg-green-700 text-white text-sm font-medium hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-brand-400 flex items-center gap-2">
                            <Printer size={16} /> Imprimir ahora
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
