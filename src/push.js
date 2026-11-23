// Web-push van de programmeur-omgeving. De logica en de service worker komen uit
// ctf-ui (maakPush, ctfServiceWorker); tot 23-11-2026 stonden ze hier als
// kopie (audit POR-07).
import { maakPush } from 'ctf-ui/push';
import { API_URL, authHeaders } from './api';

export const { pushSupported, getPushState, enablePush, disablePush } =
    maakPush({ apiUrl: API_URL, pad: '/api/programmer/public', kop: authHeaders });
