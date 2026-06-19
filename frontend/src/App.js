import { useEffect, useMemo, useState } from "react";
import "@/App.css";
import {
    BookOpen,
    Eye,
    Printer,
    FloppyDisk,
    DownloadSimple,
    Stack,
    Sparkle,
    Plus,
    Minus,
} from "@phosphor-icons/react";
import Canvas from "@/components/editor/Canvas";
import ToolsPanel from "@/components/editor/ToolsPanel";
import PropertiesPanel from "@/components/editor/PropertiesPanel";
import TemplatesModal from "@/components/editor/TemplatesModal";
import BatchModal from "@/components/editor/BatchModal";
import PreviewModal from "@/components/editor/PreviewModal";
import { createElement, LABEL_PRESETS } from "@/lib/design";
import { exportPrn } from "@/lib/api";

function App() {
    const [design, setDesign] = useState({
        widthMm: 50,
        heightMm: 30,
        layout: { columns: 1, rows: 1, gapXMm: 0, gapYMm: 0 },
        elements: [],
    });
    const [selectedId, setSelectedId] = useState(null);
    const [pxPerMm, setPxPerMm] = useState(7);
    const [currentTemplate, setCurrentTemplate] = useState(null); // { id, name }
    const [templatesOpen, setTemplatesOpen] = useState(false);
    const [batchOpen, setBatchOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);

    const selectedEl = useMemo(
        () => design.elements.find((e) => e.id === selectedId) || null,
        [design.elements, selectedId]
    );

    const variables = useMemo(() => {
        const seen = [];
        for (const el of design.elements) {
            if (el.isVariable && el.variable && !seen.includes(el.variable)) {
                seen.push(el.variable);
            }
        }
        return seen;
    }, [design.elements]);

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e) => {
            // Avoid hijacking when typing in inputs
            const tag = e.target?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
            if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
                e.preventDefault();
                deleteElement(selectedId);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    function addElement(el) {
        setDesign((d) => ({ ...d, elements: [...d.elements, el] }));
        setSelectedId(el.id);
    }

    function updateElement(id, patch) {
        setDesign((d) => ({
            ...d,
            elements: d.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        }));
    }

    function deleteElement(id) {
        setDesign((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== id) }));
        setSelectedId(null);
    }

    function duplicateElement(id) {
        const el = design.elements.find((e) => e.id === id);
        if (!el) return;
        const cp = createElement(el.type, { ...el, x: el.x + 2, y: el.y + 2 });
        setDesign((d) => ({ ...d, elements: [...d.elements, cp] }));
        setSelectedId(cp.id);
    }

    function updateDesign(patch) {
        setDesign((d) => ({ ...d, ...patch }));
    }

    function loadTemplate(t) {
        // Back-compat: ensure layout exists on older templates
        const d = t.design || {};
        setDesign({
            widthMm: d.widthMm || 50,
            heightMm: d.heightMm || 30,
            layout: d.layout || { columns: 1, rows: 1, gapXMm: 0, gapYMm: 0 },
            elements: d.elements || [],
        });
        setCurrentTemplate({ id: t.id, name: t.name });
        setSelectedId(null);
    }

    async function handleExport() {
        await exportPrn(design, null, `${currentTemplate?.name || "etiqueta"}.prn`);
    }

    function newDesign() {
        if (design.elements.length > 0 && !window.confirm("¿Descartar el diseño actual?")) return;
        setDesign({ widthMm: 50, heightMm: 30, layout: { columns: 1, rows: 1, gapXMm: 0, gapYMm: 0 }, elements: [] });
        setCurrentTemplate(null);
        setSelectedId(null);
    }

    return (
        <div className="App flex flex-col bg-brand-50">
            {/* TOP BAR */}
            <header className="h-14 border-b border-brand-200 bg-white flex items-center px-4 justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-brand-900 flex items-center justify-center">
                            <Sparkle size={16} weight="fill" className="text-brand-200" />
                        </div>
                        <div>
                            <h1 className="font-headings font-bold text-brand-950 leading-none">
                                ZebraLab
                            </h1>
                            <p className="text-[10px] text-brand-700 leading-none mt-0.5 font-mono uppercase tracking-widest">
                                by BoaIdeia
                            </p>
                        </div>
                    </div>
                    <div className="h-7 w-px bg-brand-200 mx-2" />
                    <div className="text-sm text-brand-800 font-headings">
                        {currentTemplate ? (
                            <>
                                <span className="font-medium">{currentTemplate.name}</span>
                                <span className="text-brand-700/60 ml-1">· editando</span>
                            </>
                        ) : (
                            <span className="text-brand-700">Diseño sin guardar</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <PresetSelect
                        design={design}
                        onChange={(patch) => {
                            setSelectedId(null);
                            updateDesign(patch);
                        }}
                    />
                    <div className="flex items-center gap-1 bg-white border border-brand-300 px-1.5 py-0.5">
                        <input
                            data-testid="topbar-width"
                            type="number"
                            min={5}
                            max={300}
                            step="0.5"
                            value={design.widthMm}
                            onChange={(e) => updateDesign({ widthMm: parseFloat(e.target.value) || 0 })}
                            className="w-14 bg-transparent text-brand-950 text-sm font-mono px-1 py-0.5 focus:outline-none text-right"
                            title="Ancho de una etiqueta (mm)"
                        />
                        <span className="text-brand-700 text-xs font-mono">×</span>
                        <input
                            data-testid="topbar-height"
                            type="number"
                            min={5}
                            max={300}
                            step="0.5"
                            value={design.heightMm}
                            onChange={(e) => updateDesign({ heightMm: parseFloat(e.target.value) || 0 })}
                            className="w-14 bg-transparent text-brand-950 text-sm font-mono px-1 py-0.5 focus:outline-none text-right"
                            title="Alto de una etiqueta (mm)"
                        />
                        <span className="text-brand-700 text-xs font-mono pr-1">mm</span>
                    </div>
                    <button
                        data-testid="topbar-new"
                        onClick={newDesign}
                        className="px-3 py-1.5 text-sm text-brand-800 hover:bg-brand-100 font-medium"
                    >
                        Nuevo
                    </button>
                    <button
                        data-testid="topbar-templates"
                        onClick={() => setTemplatesOpen(true)}
                        className="px-3 py-1.5 text-sm bg-white border border-brand-300 text-brand-900 hover:bg-brand-100 flex items-center gap-1.5 font-medium"
                    >
                        <BookOpen size={15} /> Plantillas
                    </button>
                    <button
                        data-testid="topbar-preview"
                        onClick={() => setPreviewOpen(true)}
                        className="px-3 py-1.5 text-sm bg-white border border-brand-300 text-brand-900 hover:bg-brand-100 flex items-center gap-1.5 font-medium"
                    >
                        <Eye size={15} /> Vista previa
                    </button>
                    <button
                        data-testid="topbar-batch"
                        onClick={() => setBatchOpen(true)}
                        className="px-3 py-1.5 text-sm bg-white border border-brand-300 text-brand-900 hover:bg-brand-100 flex items-center gap-1.5 font-medium"
                    >
                        <Stack size={15} /> Lote CSV
                    </button>
                    <button
                        data-testid="topbar-export"
                        onClick={handleExport}
                        className="px-3 py-1.5 text-sm bg-brand-900 text-white hover:bg-brand-800 flex items-center gap-1.5 font-medium"
                    >
                        <DownloadSimple size={15} /> Exportar .prn
                    </button>
                </div>
            </header>

            {/* WORKSPACE */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left sidebar */}
                <aside className="w-60 border-r border-brand-200 bg-white flex flex-col">
                    <ToolsPanel onAdd={addElement} />

                    <div className="mt-auto border-t border-brand-200">
                        <div className="px-4 py-3 border-b border-brand-200 bg-brand-50/50">
                            <h3 className="text-sm font-headings font-semibold text-brand-900 uppercase tracking-wide">
                                Capas ({design.elements.length})
                            </h3>
                        </div>
                        <div className="max-h-48 overflow-auto p-1">
                            {design.elements.length === 0 && (
                                <p className="px-3 py-2 text-xs text-brand-700/70 italic">
                                    Sin elementos
                                </p>
                            )}
                            {design.elements.map((el, i) => (
                                <button
                                    key={el.id}
                                    onClick={() => setSelectedId(el.id)}
                                    className={`w-full text-left px-3 py-1.5 text-xs font-mono truncate ${
                                        selectedId === el.id
                                            ? "bg-brand-100 text-brand-950 border-l-4 border-brand-900"
                                            : "text-brand-800 hover:bg-brand-100/50"
                                    }`}
                                >
                                    {String(i + 1).padStart(2, "0")} ·{" "}
                                    {el.isVariable
                                        ? `{${el.variable || "var"}}`
                                        : el.type === "text"
                                          ? (el.data || "texto").slice(0, 18)
                                          : el.type === "barcode"
                                            ? `${el.symbology}: ${(el.data || "").slice(0, 10)}`
                                            : el.type}
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Canvas workspace */}
                <main
                    className="flex-1 relative overflow-auto flex items-center justify-center p-8"
                    style={{ background: "#e8dfce" }}
                >
                    <Canvas
                        design={design}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onUpdate={updateElement}
                        pxPerMm={pxPerMm}
                    />

                    {/* Zoom controls */}
                    <div className="absolute bottom-4 right-4 bg-white border border-brand-300 shadow-sm flex items-center">
                        <button
                            onClick={() => setPxPerMm((p) => Math.max(3, p - 1))}
                            className="px-3 py-2 text-brand-800 hover:bg-brand-100"
                        >
                            <Minus size={14} />
                        </button>
                        <div className="px-3 text-xs font-mono text-brand-900 border-x border-brand-300">
                            {Math.round(pxPerMm * 12.5)}%
                        </div>
                        <button
                            onClick={() => setPxPerMm((p) => Math.min(20, p + 1))}
                            className="px-3 py-2 text-brand-800 hover:bg-brand-100"
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    {/* Variables badge */}
                    {variables.length > 0 && (
                        <div className="absolute top-4 left-4 bg-white border border-brand-300 shadow-sm px-3 py-2">
                            <div className="text-[10px] font-semibold text-brand-800 uppercase tracking-wider">
                                Variables del diseño
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5 max-w-md">
                                {variables.map((v) => (
                                    <span
                                        key={v}
                                        className="font-mono text-[11px] text-brand-900 bg-brand-100 border border-brand-300 px-1.5 py-0.5"
                                    >
                                        {`{${v}}`}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </main>

                {/* Right sidebar */}
                <aside className="w-80 border-l border-brand-200 bg-white flex flex-col overflow-auto">
                    <PropertiesPanel
                        element={selectedEl}
                        design={design}
                        onUpdateElement={updateElement}
                        onDeleteElement={deleteElement}
                        onDuplicateElement={duplicateElement}
                        onUpdateDesign={updateDesign}
                    />
                </aside>
            </div>

            <TemplatesModal
                open={templatesOpen}
                onClose={() => setTemplatesOpen(false)}
                currentDesign={design}
                currentTemplateId={currentTemplate?.id}
                onLoad={loadTemplate}
                onSaved={(t) => setCurrentTemplate({ id: t.id, name: t.name })}
            />
            <BatchModal
                open={batchOpen}
                onClose={() => setBatchOpen(false)}
                design={design}
                variables={variables}
            />
            <PreviewModal
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                design={design}
                variables={variables}
            />
        </div>
    );
}

function PresetSelect({ design, onChange }) {
    const layout = design.layout || { columns: 1, rows: 1, gapXMm: 0, gapYMm: 0 };
    const matched = LABEL_PRESETS.find(
        (p) =>
            !p.custom &&
            p.widthMm === design.widthMm &&
            p.heightMm === design.heightMm &&
            (p.layout?.columns || 1) === layout.columns &&
            (p.layout?.rows || 1) === layout.rows &&
            (p.layout?.gapXMm || 0) === layout.gapXMm
    );
    const value = matched ? matched.name : "custom";
    return (
        <select
            data-testid="preset-select"
            value={value}
            onChange={(e) => {
                if (e.target.value === "custom") {
                    // Reset layout to single but keep current dimensions
                    onChange({ layout: { columns: 1, rows: 1, gapXMm: 0, gapYMm: 0 } });
                    return;
                }
                const preset = LABEL_PRESETS.find((p) => p.name === e.target.value);
                if (preset)
                    onChange({
                        widthMm: preset.widthMm,
                        heightMm: preset.heightMm,
                        layout: preset.layout || { columns: 1, rows: 1, gapXMm: 0, gapYMm: 0 },
                    });
            }}
            className="bg-white border border-brand-300 text-brand-900 text-sm rounded-none px-2.5 py-1.5 font-mono focus:outline-none focus:border-brand-900"
        >
            {LABEL_PRESETS.filter((p) => !p.custom).map((p) => (
                <option key={p.name} value={p.name}>
                    {p.name}
                </option>
            ))}
            <option value="custom">Personalizado</option>
        </select>
    );
}

export default App;
