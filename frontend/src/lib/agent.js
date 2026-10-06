/**
 * Local-agent client. Talks to ZebraLab Agent running on the user's machine
 * (default http://localhost:17331). Stored config in localStorage.
 */

const LS_KEY = "zebralab_agent_config";

export function getAgentConfig() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                port: parsed.port || 17331,
                printer: parsed.printer || "",
                copies: parsed.copies || 1,
            };
        }
    } catch {
        /* ignore */
    }
    return { port: 17331, printer: "", copies: 1 };
}

export function setAgentConfig(patch) {
    const next = { ...getAgentConfig(), ...patch };
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    return next;
}

function agentUrl(path) {
    const { port } = getAgentConfig();
    return `http://localhost:${port}${path}`;
}

/** Ping the local agent. Returns the health payload or null if unreachable. */
export async function pingAgent() {
    try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch(agentUrl("/health"), { signal: ctrl.signal });
        clearTimeout(timeout);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/** Send ZPL to the local agent for printing. */
export async function printZplDirect({ zpl, printer, copies = 1 }) {
    const res = await fetch(agentUrl("/print"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zpl, printer: printer || undefined, copies }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
        const err = new Error(data.error || `Error ${res.status}`);
        err.payload = data;
        throw err;
    }
    return data;
}
