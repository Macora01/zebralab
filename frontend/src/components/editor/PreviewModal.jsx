import React, { useEffect, useState } from "react";
import { X, Eye, ArrowsClockwise } from "@phosphor-icons/react";
import { previewZpl, generateZpl } from "@/lib/api";

export default function PreviewModal({ open, onClose, design, variables }) {
    const [substitutions, setSubstitutions] = useState({});
    const [previewUrl, setPreviewUrl] = useState(null);
    const [zpl, setZpl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return;
        // Defaults from variable names
        const initial = {};
        variables.forEach((v) => {
            if (v.toLowerCase() === "instagram") initial[v] = "@boaideia.tienda";
            else if (v.toLowerCase() === "precio") initial[v] = "9990";
            else initial[v] = "";
        });
        setSubstitutions(initial);
        refresh(initial);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    async function refresh(subs = substitutions) {
        setLoading(true);
        setError("");
        try {
            const url = await previewZpl(design, subs);
            setPreviewUrl(url);
            const r = await generateZpl(design, subs);
            setZpl(r.zpl);
        } catch (e) {
            setError("No se pudo generar la vista previa. Verifica la conexión.");
        } finally {
            setLoading(false);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-6">
            <div className="bg-white w-full max-w-5xl max-h-[88vh] flex flex-col shadow-2xl border border-brand-300">
                <div className="px-5 py-3.5 border-b border-brand-200 bg-brand-50/60 flex items-center justify-between">
                    <h2 className="font-headings text-lg font-semibold text-brand-900 flex items-center gap-2">
                        <Eye size={18} /> Vista previa de impresión
                    </h2>
                    <button
                        data-testid="preview-close"
                        onClick={onClose}
                        className="p-1.5 text-brand-700 hover:bg-brand-100"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        {variables.length > 0 && (
                            <div className="mb-4">
                                <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-2 block">
                                    Valores de variables
                                </label>
                                <div className="space-y-2">
                                    {variables.map((v) => (
                                        <div key={v} className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-brand-900 bg-brand-100 px-2 py-1.5 min-w-[110px] border border-brand-300">
                                                {`{${v}}`}
                                            </span>
                                            <input
                                                data-testid={`preview-var-${v}`}
                                                value={substitutions[v] ?? ""}
                                                onChange={(e) =>
                                                    setSubstitutions((s) => ({
                                                        ...s,
                                                        [v]: e.target.value,
                                                    }))
                                                }
                                                className="flex-1 bg-white border border-brand-300 text-sm rounded-none px-2.5 py-1.5 focus:outline-none focus:border-brand-900 font-mono"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <button
                                    data-testid="preview-refresh"
                                    onClick={() => refresh()}
                                    disabled={loading}
                                    className="mt-3 px-4 py-2 bg-brand-900 text-white text-sm font-medium hover:bg-brand-800 flex items-center gap-2 disabled:opacity-50"
                                >
                                    <ArrowsClockwise size={16} /> Regenerar vista previa
                                </button>
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-2 block">
                                ZPL generado
                            </label>
                            <pre className="font-mono text-[11px] bg-brand-950 text-brand-100 p-3 max-h-72 overflow-auto whitespace-pre-wrap break-all">
                                {zpl || "—"}
                            </pre>
                        </div>
                    </div>

                    <div className="bg-brand-100/40 border border-brand-200 p-6 flex items-center justify-center min-h-[300px]">
                        {loading && (
                            <p className="text-brand-700 font-mono text-sm">Renderizando…</p>
                        )}
                        {error && !loading && (
                            <p className="text-red-700 font-mono text-sm text-center">{error}</p>
                        )}
                        {!loading && !error && previewUrl && (
                            <img
                                data-testid="preview-image"
                                src={previewUrl}
                                alt="preview"
                                className="max-w-full max-h-[420px] shadow-md border border-brand-300 bg-white"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
