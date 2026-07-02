// Web-push helpers voor de programmeur-omgeving: service worker registreren,
// abonneren/afmelden en de subscription naar de backend sturen (met pincode-header).

import { API_URL, getStoredPincode } from './api';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
}

export function pushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getPushState() {
    if (!pushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    try {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        return sub ? 'subscribed' : 'default';
    } catch {
        return 'default';
    }
}

export async function enablePush(vapidPublicKey, lang) {
    if (!pushSupported() || !vapidPublicKey) throw new Error('niet ondersteund');
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('geen toestemming');

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
    }
    const json = sub.toJSON();
    const encoding = (window.PushManager && PushManager.supportedContentEncodings)
        ? PushManager.supportedContentEncodings[0]
        : 'aes128gcm';

    const res = await fetch(`${API_URL}/api/programmer/public/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Programmer-Pincode': getStoredPincode() },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, contentEncoding: encoding, lang }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
}

export async function disablePush() {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
        try {
            await fetch(`${API_URL}/api/programmer/public/push/unsubscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Programmer-Pincode': getStoredPincode() },
                body: JSON.stringify({ endpoint: sub.endpoint }),
            });
        } catch { /* negeer */ }
        await sub.unsubscribe();
    }
    return true;
}
