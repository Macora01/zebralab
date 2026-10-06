import React, { useEffect, useState } from "react";
import { X, Printer, CheckCircle, Warning } from "@phosphor-icons/react";
import { generateZpl } from "@/lib/api";
import { printZplDirect, getAgentConfig } from "@/lib/agent";

/**
 * Print directly through the local agent. Supports variable substitution
 * and multiple copies. Used for single-label printing (CSV batch has its
 * own flow but can also use the agent — see BatchModal).
 */
export default function PrintModal({ open, onClose, design, variables, agentInfo }) {
    const [substitutions, setSubstitutions] = useState({});
    const [copies, setCopies] = useState(1);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        if (!open) return;
        const initial = {};
        variables.forEach((v) => {
            initial[v] = "";
        });
        setSubstitutions(initial);
        setError("");
        setSuccess("");
        setCopies(1);
    }, [open, variables]);

    async function handlePrint() {
        setBusy(true);
        setError("");
        setSuccess("");
        try {
            const { zpl } = await generateZpl(design, substitutions);
            const cfg = getAgentConfig();
            await printZplDirect({
                zpl,
                printer: cfg.printer || agentInfo?.default_printer,
                copies,
            });
            setSuccess(`✓ Enviado a la impresora (${copies} ${copies === 1 ? "etiqueta" : "etiquetas"})`);
        } catch (e) {
            setError(e?.message || "Error desconocido al imprimir");
        } finally {
            setBusy(false);
        }
    }

    if (!open) return null;

    const agentOk = !!agentInfo;
    const printer = getAgentConfig().printer || agentInfo?.default_printer || "(no configurada)";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-6">
            <div className="bg-white w-full max-w-xl flex flex-col shadow-2xl border border-brand-300">
                <div className="px-5 py-3.5 border-b border-brand-200 bg-brand-50/60 flex items-center justify-between">
                    <h2 className="font-headings text-lg font-semibold text-brand-900 flex items-center gap-2">
                        <Printer size={20} weight="duotone" /> Imprimir ahora
                    </h2>
                    <button
                        data-testid="print-close"
                        onClick={onClose}
                        className="p-1.5 text-brand-700 hover:bg-brand-100"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {!agentOk && (
                        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2 flex items-start gap-2">
                            <Warning size={18} className="shrink-0 mt-0.5" />
                            <div>
                                No hay agente local detectado. Necesitas correr el agente Python en
                                tu Mac (mira el indicador en la barra superior).
                            </div>
                        </div>
                    )}

                    <div className="bg-brand-50 border border-brand-200 px-3 py-2.5 text-sm font-mono text-brand-900">
                        🖨 Impresora: <span className="font-bold">{printer}</span>
                    </div>

                    {variables.length > 0 && (
                        <div>
                            <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-2 block">
                                Valores de variables
                            </label>
                            <div className="space-y-2">
                                {variables.map((v) => (
                                    <div key={v} className="flex items-center gap-2">
                                        <span className="font-mono text-xs text-brand-900 bg-brand-100 px-2 py-1.5 min-w-[120px] border border-brand-300">
                                            {`{${v}}`}
                                        </span>
                                        <input
                                            data-testid={`print-var-${v}`}
                                            value={substitutions[v] ?? ""}
                                            onChange={(e) =>
                                                setSubstitutions((s) => ({
                                                    ...s,
                                                    [v]: e.target.value,
                                                }))
                                            }
                                            placeholder={
                                                v.toLowerCase() === "precio"
                                                    ? "9990"
                                                    : v.toLowerCase() === "instagram"
                                                      ? "@boaideia.tienda"
                                                      : `Valor para ${v}`
                                            }
                                            className="flex-1 bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-2.5 py-1.5 focus:outline-none focus:border-brand-900 font-mono"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1.5 block">
                            Copias
                        </label>
                        <input
                            data-testid="print-copies"
                            type="number"
                            min={1}
                            max={500}
                            value={copies}
                            onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-32 bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-2.5 py-1.5 font-mono focus:outline-none focus:border-brand-900"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 font-mono flex items-start gap-2">
                            <Warning size={18} className="shrink-0 mt-0.5" />
                            <div>{error}</div>
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50 border border-green-300 text-green-900 text-sm px-3 py-2 flex items-start gap-2">
                            <CheckCircle size={18} className="shrink-0 mt-0.5" />
                            <div>{success}</div>
                        </div>
                    )}
                </div>

                <div className="px-5 py-3.5 border-t border-brand-200 bg-brand-50/60 flex items-center justify-end gap-2">
                    <button
                        data-testid="print-cancel"
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-brand-300 text-brand-900 text-sm font-medium hover:bg-brand-100"
                    >
                        Cerrar
                    </button>
                    <button
                        data-testid="print-confirm"
                        onClick={handlePrint}
                        disabled={busy || !agentOk}
                        className="px-4 py-2 bg-brand-900 text-white text-sm font-medium hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Printer size={16} />
                        {busy ? "Enviando…" : `Imprimir ${copies > 1 ? `(${copies})` : ""}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
