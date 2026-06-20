import React, { useEffect, useRef, useState } from "react";
import {
    listTemplates,
    deleteTemplate,
    duplicateTemplate,
    saveTemplate,
    updateTemplate,
    importPrnTemplate,
    exportPrn,
    rawExport,
} from "@/lib/api";
import {
    X,
    FolderOpen,
    Trash,
    CopySimple,
    FloppyDisk,
    UploadSimple,
    DownloadSimple,
    FileText,
    PaintBrushBroad,
} from "@phosphor-icons/react";

export default function TemplatesModal({
    open,
    onClose,
    currentDesign,
    currentTemplateId,
    onLoad,
    onSaved,
}) {
    const [items, setItems] = useState([]);
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const fileRef = useRef(null);

    useEffect(() => {
        if (open) refresh();
    }, [open]);

    async function refresh() {
        setLoading(true);
        try {
            setItems(await listTemplates());
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveAs() {
        if (!name.trim()) return;
        const t = await saveTemplate({ name: name.trim(), design: currentDesign });
        setName("");
        await refresh();
        onSaved && onSaved(t);
    }

    async function handleUpdate() {
        if (!currentTemplateId) return;
        const t = await updateTemplate(currentTemplateId, { design: currentDesign });
        await refresh();
        onSaved && onSaved(t);
    }

    async function handleDelete(id) {
        if (!window.confirm("¿Eliminar esta plantilla?")) return;
        await deleteTemplate(id);
        await refresh();
    }

    async function handleDuplicate(id) {
        await duplicateTemplate(id);
        await refresh();
    }

    async function handleImportPrn(file) {
        setError("");
        setLoading(true);
        try {
            await importPrnTemplate(file);
            await refresh();
        } catch (e) {
            setError(e?.response?.data?.detail || "Error al importar el archivo");
        } finally {
            setLoading(false);
        }
    }

    async function handleDownload(t) {
        try {
            if (t.kind === "raw") {
                await rawExport(t.rawZpl, null, `${t.name}.prn`);
            } else {
                await exportPrn(t.design, null, `${t.name}.prn`);
            }
        } catch {
            setError("Error al descargar");
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-6">
            <div className="bg-white w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-brand-300">
                <div className="px-5 py-3.5 border-b border-brand-200 bg-brand-50/60 flex items-center justify-between">
                    <h2 className="font-headings text-lg font-semibold text-brand-900">
                        Biblioteca de plantillas
                    </h2>
                    <button
                        data-testid="templates-close"
                        onClick={onClose}
                        className="p-1.5 text-brand-700 hover:bg-brand-100"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 border-b border-brand-200 bg-brand-50/30 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1.5 block">
                            Guardar diseño actual
                        </label>
                        <div className="flex gap-2">
                            <input
                                data-testid="template-name-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ej: Etiqueta calzado"
                                className="flex-1 bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-3 py-2 focus:outline-none focus:border-brand-900"
                            />
                            <button
                                data-testid="template-save-as-btn"
                                onClick={handleSaveAs}
                                className="px-3 py-2 bg-brand-900 text-white text-sm font-medium hover:bg-brand-800 disabled:opacity-50 flex items-center gap-1.5"
                                disabled={!name.trim()}
                            >
                                <FloppyDisk size={15} /> Guardar
                            </button>
                            {currentTemplateId && (
                                <button
                                    data-testid="template-update-btn"
                                    onClick={handleUpdate}
                                    className="px-3 py-2 bg-white border border-brand-300 text-brand-900 text-sm font-medium hover:bg-brand-100"
                                    title="Actualizar la plantilla actualmente cargada"
                                >
                                    Actualizar
                                </button>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1.5 block">
                            Importar archivo .prn existente
                        </label>
                        <button
                            data-testid="template-import-btn"
                            onClick={() => fileRef.current?.click()}
                            className="w-full px-3 py-2 bg-white border-2 border-dashed border-brand-300 text-brand-900 text-sm font-medium hover:bg-brand-100 hover:border-brand-500 flex items-center justify-center gap-2"
                        >
                            <UploadSimple size={16} /> Subir .prn / .zpl
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".prn,.zpl,.txt"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && handleImportPrn(e.target.files[0])}
                            data-testid="template-import-file"
                        />
                        <p className="text-[10px] text-brand-700/80 mt-1">
                            Para reutilizar etiquetas creadas en ZebraDesigner u otras herramientas.
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border-b border-red-200 text-red-800 text-sm px-5 py-2 font-mono">
                        {error}
                    </div>
                )}

                <div className="flex-1 overflow-auto">
                    {loading && <p className="p-5 text-sm text-brand-700">Cargando…</p>}
                    {!loading && items.length === 0 && (
                        <p className="p-5 text-sm text-brand-700">
                            Aún no hay plantillas. Guarda un diseño o importa un .prn.
                        </p>
                    )}
                    {!loading && items.length > 0 && (
                        <ul className="divide-y divide-brand-200">
                            {items.map((t) => {
                                const isRaw = t.kind === "raw";
                                return (
                                    <li
                                        key={t.id}
                                        data-testid={`template-row-${t.id}`}
                                        className="px-5 py-3.5 flex items-center justify-between hover:bg-brand-50"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-9 h-9 flex items-center justify-center border ${isRaw ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-brand-100 border-brand-300 text-brand-800"}`}>
                                                {isRaw ? <FileText size={18} /> : <PaintBrushBroad size={18} />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-headings font-semibold text-brand-900 flex items-center gap-2 truncate">
                                                    {t.name}
                                                    {isRaw && (
                                                        <span className="font-mono text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.5 border border-amber-300 uppercase tracking-wider">
                                                            .prn
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="font-mono text-[11px] text-brand-700/80 mt-0.5">
                                                    {isRaw ? (
                                                        <>archivo importado · {new Date(t.updatedAt).toLocaleString()}</>
                                                    ) : (
                                                        <>
                                                            {t.design?.widthMm} × {t.design?.heightMm} mm ·{" "}
                                                            {t.design?.elements?.length || 0} elementos · {new Date(t.updatedAt).toLocaleString()}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                data-testid={`template-load-${t.id}`}
                                                onClick={() => {
                                                    onLoad(t);
                                                    onClose();
                                                }}
                                                className="px-3 py-1.5 bg-brand-900 text-white text-xs font-medium hover:bg-brand-800 flex items-center gap-1.5"
                                            >
                                                <FolderOpen size={14} /> Abrir
                                            </button>
                                            <button
                                                data-testid={`template-download-${t.id}`}
                                                onClick={() => handleDownload(t)}
                                                className="p-1.5 text-brand-700 hover:bg-brand-100"
                                                title="Descargar .prn"
                                            >
                                                <DownloadSimple size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDuplicate(t.id)}
                                                className="p-1.5 text-brand-700 hover:bg-brand-100"
                                                title="Duplicar"
                                            >
                                                <CopySimple size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(t.id)}
                                                className="p-1.5 text-red-700 hover:bg-red-50"
                                                title="Eliminar"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
