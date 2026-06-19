import React, { useEffect, useState, useCallback } from "react";
import { Plugs, PlugsConnected, Gear } from "@phosphor-icons/react";
import { pingAgent, getAgentConfig, setAgentConfig } from "@/lib/agent";

/**
 * Compact pill in the topbar that shows whether the local print agent
 * is reachable. Click to open a settings popover.
 */
export default function AgentStatusBadge({ onStatusChange }) {
    const [status, setStatus] = useState("unknown"); // unknown | connected | offline
    const [info, setInfo] = useState(null);
    const [open, setOpen] = useState(false);
    const [cfg, setCfg] = useState(getAgentConfig());

    const check = useCallback(async () => {
        const r = await pingAgent();
        if (r) {
            setStatus("connected");
            setInfo(r);
            if (!cfg.printer && r.default_printer) {
                const next = setAgentConfig({ printer: r.default_printer });
                setCfg(next);
            }
            onStatusChange?.({ status: "connected", info: r });
        } else {
            setStatus("offline");
            setInfo(null);
            onStatusChange?.({ status: "offline", info: null });
        }
    }, [cfg.printer, onStatusChange]);

    useEffect(() => {
        check();
        const id = setInterval(check, 15000);
        return () => clearInterval(id);
    }, [check]);

    const dotCls =
        status === "connected"
            ? "bg-green-500"
            : status === "offline"
              ? "bg-brand-300"
              : "bg-amber-400";
    const labelText =
        status === "connected"
            ? "Agente conectado"
            : status === "offline"
              ? "Sin agente"
              : "Buscando…";

    return (
        <div className="relative">
            <button
                data-testid="agent-status-btn"
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs bg-white border border-brand-300 text-brand-900 hover:bg-brand-100 font-medium"
                title="Estado del agente local de impresión"
            >
                <span className={`w-2 h-2 rounded-full ${dotCls}`}></span>
                <span className="font-mono">{labelText}</span>
                <Gear size={12} className="text-brand-700 ml-0.5" />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-1.5 w-96 bg-white border border-brand-300 shadow-xl z-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        {status === "connected" ? (
                            <PlugsConnected size={18} className="text-green-600" weight="duotone" />
                        ) : (
                            <Plugs size={18} className="text-brand-700" weight="duotone" />
                        )}
                        <h4 className="font-headings font-semibold text-brand-900">
                            Agente local de impresión
                        </h4>
                    </div>

                    {status === "connected" && info ? (
                        <div className="space-y-2.5 text-sm">
                            <div className="bg-green-50 border border-green-200 px-3 py-2 text-green-900 font-mono text-xs">
                                ✓ Conectado · v{info.version}
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1 block">
                                    Impresora
                                </label>
                                <select
                                    data-testid="agent-printer-select"
                                    value={cfg.printer || info.default_printer}
                                    onChange={(e) => setCfg(setAgentConfig({ printer: e.target.value }))}
                                    className="w-full bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-2.5 py-1.5 font-mono focus:outline-none focus:border-brand-900"
                                >
                                    {(info.printers || []).length === 0 && (
                                        <option value="">— Ninguna detectada —</option>
                                    )}
                                    {(info.printers || []).map((p) => (
                                        <option key={p} value={p}>
                                            {p}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 text-sm">
                            <div className="bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900 text-xs">
                                No detecté el agente local. Para imprimir directo desde la web,
                                necesitas correrlo en tu Mac (una sola vez).
                            </div>
                            <a
                                data-testid="agent-download-link"
                                href={`${process.env.REACT_APP_BACKEND_URL}/api/agent/download`}
                                download="zebralab_agent.py"
                                className="block w-full text-center px-4 py-2 bg-brand-900 text-white text-sm font-medium hover:bg-brand-800"
                            >
                                ⬇ Descargar zebralab_agent.py
                            </a>
                            <details className="text-xs text-brand-800">
                                <summary className="cursor-pointer font-medium text-brand-900 mb-1">
                                    Cómo configurarlo (60 segundos)
                                </summary>
                                <ol className="list-decimal pl-4 space-y-1.5 mt-2 text-[12px] leading-snug">
                                    <li>
                                        Descarga el archivo arriba y guárdalo donde quieras
                                        (ej: <code className="bg-brand-100 px-1 font-mono">~/Documents/zebralab/</code>).
                                    </li>
                                    <li>
                                        Abre <strong>Terminal</strong> y ejecuta:
                                        <pre className="bg-brand-950 text-brand-100 p-2 mt-1 font-mono text-[11px] overflow-auto">
{`python3 ~/Documents/zebralab/zebralab_agent.py`}
                                        </pre>
                                    </li>
                                    <li>
                                        Verás "Escuchando en http://localhost:17331". Vuelve aquí y
                                        haz clic en <strong>Refrescar</strong> abajo.
                                    </li>
                                    <li>
                                        Deja la Terminal abierta mientras uses la app. Para auto-arrancar,
                                        mira el README adjunto.
                                    </li>
                                </ol>
                            </details>
                        </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-brand-200">
                        <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1 block">
                            Puerto del agente
                        </label>
                        <input
                            data-testid="agent-port-input"
                            type="number"
                            value={cfg.port}
                            onChange={(e) => {
                                const v = parseInt(e.target.value, 10) || 17331;
                                setCfg(setAgentConfig({ port: v }));
                            }}
                            onBlur={check}
                            className="w-32 bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-2.5 py-1.5 font-mono focus:outline-none focus:border-brand-900"
                        />
                        <button
                            data-testid="agent-refresh-btn"
                            onClick={check}
                            className="ml-2 px-3 py-1.5 text-xs bg-brand-900 text-white hover:bg-brand-800 font-medium"
                        >
                            Refrescar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
