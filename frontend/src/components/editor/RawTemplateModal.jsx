import React, { useEffect, useState } from "react";
import { X, Printer, DownloadSimple, Eye, ArrowsClockwise, Warning, CheckCircle, FileText } from "@phosphor-icons/react";
import { rawVariables, rawPreview, rawExport } from "@/lib/api";
import { printZplDirect, getAgentConfig } from "@/lib/agent";

/**
 * Modal that opens when a user clicks "Abrir" on a RAW template (.prn imported).
 * Lets them fill variables, preview, print directly via agent, or download .prn.
 */
export default function RawTemplateModal({ open, template, onClose, agentInfo }) {
    const [variables, setVariables] = useState([]);
    const [substitutions, setSubstitutions] = useState({});
    const [previewUrl, setPreviewUrl] = useState(null);
    const [copies, setCopies] = useState(1);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        if (!open || !template) return;
        setError("");
        setSuccess("");
        setCopies(1);
        // Detect variables
        rawVariables(template.rawZpl).then((vars) => {
            setVariables(vars);
            const init = {};
            vars.forEach((v) => {
                init[v] = "";
            });
            setSubstitutions(init);
            refreshPreview(init);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, template]);

    async function refreshPreview(subs = substitutions) {
        if (!template) return;
        setBusy(true);
        try {
            const url = await rawPreview(template.rawZpl, subs);
            setPreviewUrl(url);
        } catch (e) {
            setError("No se pudo generar la vista previa");
        } finally {
            setBusy(false);
        }
    }

    async function handleDownload() {
        setBusy(true);
        setError("");
        try {
            await rawExport(template.rawZpl, substitutions, `${template.name}.prn`);
            setSuccess(`✓ Archivo "${template.name}.prn" descargado`);
        } catch (e) {
            setError("Error al exportar");
        } finally {
            setBusy(false);
        }
    }

    async function handlePrint() {
        setBusy(true);
        setError("");
        setSuccess("");
        try {
            // Substitute variables locally via the raw/export endpoint? Easier: download blob then... Actually we can just send the substituted ZPL directly to the agent.
            // We need substituted ZPL. Let's call raw/export with a different responseType... or substitute on backend then send to agent. Simpler: fetch substituted text via export.
            const res = await fetch(
                `${process.env.REACT_APP_BACKEND_URL}/api/raw/export`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ zpl: template.rawZpl, substitutions }),
                }
            );
            const zpl = await res.text();
            const cfg = getAgentConfig();
            await printZplDirect({
                zpl,
                printer: cfg.printer || agentInfo?.default_printer,
                copies,
            });
            setSuccess(`✓ Enviado a la impresora (${copies} ${copies === 1 ? "etiqueta" : "etiquetas"})`);
        } catch (e) {
            setError(e?.message || "Error al imprimir");
        } finally {
            setBusy(false);
        }
    }

    if (!open || !template) return null;

    const agentOk = !!agentInfo;
    const printer = getAgentConfig().printer || agentInfo?.default_printer || "(no configurada)";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-6">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-brand-300">
                <div className="px-5 py-3.5 border-b border-brand-200 bg-brand-50/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText size={20} weight="duotone" className="text-brand-900" />
                        <h2 className="font-headings text-lg font-semibold text-brand-900">
                            {template.name}
                        </h2>
                        <span className="font-mono text-[10px] bg-brand-100 text-brand-700 px-2 py-0.5 border border-brand-300 uppercase tracking-wider">
                            .prn importado
                        </span>
                    </div>
                    <button
                        data-testid="raw-modal-close"
                        onClick={onClose}
                        className="p-1.5 text-brand-700 hover:bg-brand-100"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <div className="bg-brand-50 border border-brand-200 px-3 py-2.5 text-sm font-mono text-brand-900 mb-4">
                            🖨 Impresora: <span className="font-bold">{printer}</span>
                        </div>

                        {variables.length > 0 ? (
                            <div className="mb-4">
                                <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-2 block">
                                    Valores de variables ({variables.length})
                                </label>
                                <div className="space-y-2">
                                    {variables.map((v) => (
                                        <div key={v} className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-brand-900 bg-brand-100 px-2 py-1.5 min-w-[120px] border border-brand-300">
                                                {`{${v}}`}
                                            </span>
                                            <input
                                                data-testid={`raw-var-${v}`}
                                                value={substitutions[v] ?? ""}
                                                onChange={(e) =>
                                                    setSubstitutions((s) => ({
                                                        ...s,
                                                        [v]: e.target.value,
                                                    }))
                                                }
                                                className="flex-1 bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-2.5 py-1.5 focus:outline-none focus:border-brand-900 font-mono"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => refreshPreview()}
                                    className="mt-3 px-3 py-1.5 text-xs bg-white border border-brand-300 text-brand-900 hover:bg-brand-100 flex items-center gap-1.5 font-medium"
                                >
                                    <ArrowsClockwise size={14} /> Actualizar vista previa
                                </button>
                            </div>
                        ) : (
                            <div className="mb-4 text-sm text-brand-700">
                                Este archivo no tiene variables — se imprimirá tal cual.
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1.5 block">
                                Copias
                            </label>
                            <input
                                data-testid="raw-copies"
                                type="number"
                                min={1}
                                max={500}
                                value={copies}
                                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="w-32 bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-2.5 py-1.5 font-mono focus:outline-none focus:border-brand-900"
                            />
                        </div>

                        {error && (
                            <div className="mt-3 bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 font-mono flex items-start gap-2">
                                <Warning size={18} className="shrink-0 mt-0.5" />
                                <div>{error}</div>
                            </div>
                        )}
                        {success && (
                            <div className="mt-3 bg-green-50 border border-green-300 text-green-900 text-sm px-3 py-2 flex items-start gap-2">
                                <CheckCircle size={18} className="shrink-0 mt-0.5" />
                                <div>{success}</div>
                            </div>
                        )}
                    </div>

                    <div className="bg-brand-100/40 border border-brand-200 p-6 flex items-center justify-center min-h-[300px]">
                        {busy && <p className="text-brand-700 font-mono text-sm">Renderizando…</p>}
                        {!busy && previewUrl && (
                            <img
                                data-testid="raw-preview-img"
                                src={previewUrl}
                                alt="preview"
                                className="max-w-full max-h-[420px] shadow-md border border-brand-300 bg-white"
                            />
                        )}
                    </div>
                </div>

                <div className="px-5 py-3.5 border-t border-brand-200 bg-brand-50/60 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-brand-300 text-brand-900 text-sm font-medium hover:bg-brand-100"
                    >
                        Cerrar
                    </button>
                    <button
                        data-testid="raw-download-btn"
                        onClick={handleDownload}
                        disabled={busy}
                        className="px-4 py-2 bg-white border border-brand-300 text-brand-900 text-sm font-medium hover:bg-brand-100 flex items-center gap-2 disabled:opacity-50"
                    >
                        <DownloadSimple size={16} /> Descargar .prn
                    </button>
                    <button
                        data-testid="raw-print-btn"
                        onClick={handlePrint}
                        disabled={busy || !agentOk}
                        title={agentOk ? "Imprimir vía agente local" : "Inicia el agente local para imprimir directo"}
                        className="px-4 py-2 bg-green-700 text-white text-sm font-medium hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-brand-400 flex items-center gap-2"
                    >
                        <Printer size={16} />
                        {busy ? "Enviando…" : `Imprimir ${copies > 1 ? `(${copies})` : ""}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
