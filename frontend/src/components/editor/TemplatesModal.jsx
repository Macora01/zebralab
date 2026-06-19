import React, { useEffect, useState } from "react";
import {
    listTemplates,
    deleteTemplate,
    duplicateTemplate,
    saveTemplate,
    updateTemplate,
} from "@/lib/api";
import { X, FolderOpen, Trash, CopySimple, FloppyDisk } from "@phosphor-icons/react";

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

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-6">
            <div className="bg-white w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl border border-brand-300">
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

                <div className="p-5 border-b border-brand-200 bg-brand-50/30">
                    <label className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider mb-1.5 block">
                        Guardar diseño actual
                    </label>
                    <div className="flex gap-2">
                        <input
                            data-testid="template-name-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej: Etiqueta Producto · Calzado"
                            className="flex-1 bg-white border border-brand-300 text-brand-950 text-sm rounded-none px-3 py-2 focus:outline-none focus:border-brand-900"
                        />
                        <button
                            data-testid="template-save-as-btn"
                            onClick={handleSaveAs}
                            className="px-4 py-2 bg-brand-900 text-white text-sm font-medium hover:bg-brand-800 disabled:opacity-50 flex items-center gap-2"
                            disabled={!name.trim()}
                        >
                            <FloppyDisk size={16} /> Guardar como nueva
                        </button>
                        {currentTemplateId && (
                            <button
                                data-testid="template-update-btn"
                                onClick={handleUpdate}
                                className="px-4 py-2 bg-white border border-brand-300 text-brand-900 text-sm font-medium hover:bg-brand-100"
                            >
                                Actualizar actual
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading && (
                        <p className="p-5 text-sm text-brand-700">Cargando…</p>
                    )}
                    {!loading && items.length === 0 && (
                        <p className="p-5 text-sm text-brand-700">
                            Aún no hay plantillas. Guarda tu primer diseño arriba.
                        </p>
                    )}
                    {!loading && items.length > 0 && (
                        <ul className="divide-y divide-brand-200">
                            {items.map((t) => (
                                <li
                                    key={t.id}
                                    data-testid={`template-row-${t.id}`}
                                    className="px-5 py-3.5 flex items-center justify-between hover:bg-brand-50"
                                >
                                    <div>
                                        <div className="font-headings font-semibold text-brand-900">
                                            {t.name}
                                        </div>
                                        <div className="font-mono text-[11px] text-brand-700/80 mt-0.5">
                                            {t.design.widthMm} × {t.design.heightMm} mm ·{" "}
                                            {t.design.elements.length} elementos ·{" "}
                                            {new Date(t.updatedAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
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
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
