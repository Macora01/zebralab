import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
    baseURL: API,
});

export async function generateZpl(design, substitutions = null) {
    const { data } = await api.post("/zpl/generate", { design, substitutions });
    return data; // { zpl, variables }
}

export async function exportPrn(design, substitutions = null, filename = "etiqueta.prn") {
    const res = await api.post(
        "/zpl/export",
        { design, substitutions },
        { responseType: "blob" }
    );
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export async function previewZpl(design, substitutions = null) {
    const res = await api.post(
        "/zpl/preview",
        { design, substitutions },
        { responseType: "blob" }
    );
    return URL.createObjectURL(res.data);
}

export async function listTemplates() {
    const { data } = await api.get("/templates");
    return data;
}

export async function getTemplate(id) {
    const { data } = await api.get(`/templates/${id}`);
    return data;
}

export async function saveTemplate({ name, design, notes }) {
    const { data } = await api.post("/templates", { name, design, notes });
    return data;
}

export async function updateTemplate(id, payload) {
    const { data } = await api.put(`/templates/${id}`, payload);
    return data;
}

export async function deleteTemplate(id) {
    await api.delete(`/templates/${id}`);
}

export async function duplicateTemplate(id) {
    const { data } = await api.post(`/templates/${id}/duplicate`);
    return data;
}

export async function parseBatch(file) {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/batch/parse", fd, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
}

export async function generateBatch(design, rows, mapping, quantityColumn) {
    const res = await api.post(
        "/batch/generate",
        { design, rows, mapping, quantityColumn },
        { responseType: "blob" }
    );
    const total = res.headers["x-total-labels"];
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lote.prn";
    a.click();
    URL.revokeObjectURL(url);
    return total;
}
