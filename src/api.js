export const API_URL = process.env.REACT_APP_API_URL || 'https://backend.cafetheaterfestival.nl';

const PINCODE_KEY = 'ctfprogrammeur_pincode_v1';

export function getStoredPincode() {
    try { return sessionStorage.getItem(PINCODE_KEY) || ''; } catch { return ''; }
}
export function setStoredPincode(pin) {
    try { sessionStorage.setItem(PINCODE_KEY, pin); } catch {}
}
export function clearStoredPincode() {
    try { sessionStorage.removeItem(PINCODE_KEY); } catch {}
}

async function request(path, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    const pin = getStoredPincode();
    if (pin) headers['X-Programmer-Pincode'] = pin;
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    const body = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) {
        const err = new Error(body?.message || `HTTP ${res.status}`);
        err.status = res.status;
        err.body = body;
        throw err;
    }
    return body;
}

export const api = {
    // Login met naam + pincode. Bewaart de pincode pas als 'ie klopt.
    login: (name, pincode) => request('/api/programmer/public/login', {
        method: 'POST',
        body: JSON.stringify({ name, pincode }),
    }),
    bundle: () => request('/api/programmer/public/bundle'),
    maker: (performanceId) => request(`/api/programmer/public/maker/${performanceId}`),
    saveTekst: (performanceId, programmeurstekst) => request(`/api/programmer/public/maker/${performanceId}/tekst`, {
        method: 'PUT',
        body: JSON.stringify({ programmeurstekst }),
    }),
    createProposal: (performanceId, data) => request(`/api/programmer/public/maker/${performanceId}/proposals`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    deleteProposal: (id) => request(`/api/programmer/public/proposals/${id}`, { method: 'DELETE' }),
};
