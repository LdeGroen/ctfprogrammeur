import React, { useEffect, useState, useCallback } from 'react';
import { api, clearStoredPincode, getStoredPincode, setStoredPincode } from './api';
import { disablePush, enablePush, getPushState } from './push';
import { UI } from './i18n';

const TABS = ['tekst', 'repetities', 'contact'];

export default function App() {
    const [lang, setLang] = useState(() => localStorage.getItem('ctfprogrammeur_lang') || 'nl');
    const [loggedIn, setLoggedIn] = useState(() => !!getStoredPincode());
    const [programmer, setProgrammer] = useState(null);
    const [makers, setMakers] = useState([]);
    const [vapid, setVapid] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('tekst');
    const [drawer, setDrawer] = useState(false);

    const t = UI[lang];

    useEffect(() => { localStorage.setItem('ctfprogrammeur_lang', lang); }, [lang]);

    const loadBundle = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const data = await api.bundle();
            setProgrammer(data.programmer);
            setMakers(data.makers || []);
            setVapid(data.vapid_public_key || null);
        } catch (e) {
            if (e.status === 401 || e.status === 403) { clearStoredPincode(); setLoggedIn(false); }
            else setError(e.message || 'Onbekende fout');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { if (loggedIn && !programmer) loadBundle(); }, [loggedIn, programmer, loadBundle]);

    const loadDetail = useCallback(async (id) => {
        if (!id) { setDetail(null); return; }
        setLoadingDetail(true);
        try { setDetail(await api.maker(id)); } catch (e) { setError(e.message || 'Laden mislukt'); } finally { setLoadingDetail(false); }
    }, []);

    useEffect(() => { loadDetail(selectedId); }, [selectedId, loadDetail]);

    const handleLogin = async (name, pincode) => {
        setError('');
        try {
            setStoredPincode(pincode);
            await api.login(name, pincode);
            setLoggedIn(true);
        } catch (e) {
            clearStoredPincode();
            setError(t.login_failed);
            throw e;
        }
    };

    const handleLogout = () => {
        clearStoredPincode();
        setLoggedIn(false); setProgrammer(null); setMakers([]); setSelectedId(null); setDetail(null);
    };

    const selectMaker = (id) => { setSelectedId(id); setTab('tekst'); setDrawer(false); };

    if (!loggedIn) {
        return (<><LoginScreen onLogin={handleLogin} lang={lang} setLang={setLang} error={error} /><InstallPrompt t={t} /></>);
    }

    const selectedMaker = makers.find(m => String(m.performance_id) === String(selectedId));

    return (
        <div className="min-h-screen flex flex-col">
            <Header lang={lang} setLang={setLang} onLogout={handleLogout} t={t} name={programmer?.name} />
            <InstallPrompt t={t} />
            <NotificationToggle vapidPublicKey={vapid} lang={lang} t={t} />

            {error && <div className="max-w-4xl mx-auto m-4 p-4 bg-red-50 text-red-700 rounded w-full">{error}</div>}

            {loading ? (
                <div className="text-center text-gray-500 py-12">{t.loading}</div>
            ) : !selectedId ? (
                <MakerOverview makers={makers} onSelect={selectMaker} t={t} />
            ) : (
                <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-5">
                    <div className="flex items-center gap-3 mb-4">
                        <button onClick={() => setDrawer(true)} className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 shadow-sm hover:bg-gray-50">
                            <span className="text-ctf-primary">☰</span>
                            <span className="text-sm font-semibold text-gray-800">{selectedMaker?.title || t.maker}</span>
                            <span className="text-xs text-gray-400">{t.switch_maker}</span>
                        </button>
                        {selectedMaker?.company && <span className="text-sm text-gray-500">{selectedMaker.company}</span>}
                    </div>

                    <TabBar tabs={TABS} active={tab} onChange={setTab} t={t} />

                    {loadingDetail || !detail ? (
                        <div className="text-center text-gray-400 py-10">{t.loading}</div>
                    ) : (
                        <div className="mt-4">
                            {tab === 'tekst' && <TekstTab detail={detail} performanceId={selectedId} onSaved={() => loadDetail(selectedId)} t={t} />}
                            {tab === 'repetities' && <RepetitiesTab detail={detail} performanceId={selectedId} reload={() => loadDetail(selectedId)} lang={lang} t={t} />}
                            {tab === 'contact' && <ContactTab detail={detail} t={t} />}
                        </div>
                    )}
                </main>
            )}

            {drawer && (
                <div className="fixed inset-0 z-50 flex" onClick={() => setDrawer(false)}>
                    <div className="absolute inset-0 bg-black/40" />
                    <aside className="relative bg-white w-72 max-w-[80%] h-full shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex items-center justify-between">
                            <span className="font-semibold">{t.your_makers}</span>
                            <button onClick={() => setDrawer(false)} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
                        </div>
                        <MakerList makers={makers} selectedId={selectedId} onSelect={selectMaker} t={t} />
                    </aside>
                </div>
            )}

            <footer className="text-center text-xs text-gray-400 py-6">© Café Theater Festival</footer>
        </div>
    );
}

function MakerOverview({ makers, onSelect, t }) {
    return (
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">{t.your_makers}</h2>
            <p className="text-sm text-gray-500 mb-4">{t.pick_maker}</p>
            {makers.length === 0 ? (
                <EmptyState text={t.no_makers} />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {makers.map(m => (
                        <button key={m.performance_id} onClick={() => onSelect(m.performance_id)} className="text-left bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition">
                            <div className="font-semibold">{m.title}</div>
                            {m.company && <div className="text-sm text-gray-500 mt-0.5">{m.company}</div>}
                        </button>
                    ))}
                </div>
            )}
        </main>
    );
}

function MakerList({ makers, selectedId, onSelect, t }) {
    if (!makers.length) return <div className="p-4 text-sm text-gray-400">{t.no_makers}</div>;
    return (
        <nav className="p-2">
            {makers.map(m => {
                const active = String(m.performance_id) === String(selectedId);
                return (
                    <button key={m.performance_id} onClick={() => onSelect(m.performance_id)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 ${active ? 'bg-ctf-primary/10 text-ctf-primary' : 'hover:bg-gray-50 text-gray-700'}`}>
                        <div className="font-medium text-sm">{m.title}</div>
                        {m.company && <div className="text-xs text-gray-400">{m.company}</div>}
                    </button>
                );
            })}
        </nav>
    );
}

function Header({ lang, setLang, onLogout, t, name }) {
    return (
        <header className="bg-ctf-primary text-white shadow">
            <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">{name ? `${t.welcome}, ${name}` : t.title}</h1>
                    <p className="text-xs md:text-sm opacity-80">{t.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                    <LangSwitch lang={lang} setLang={setLang} />
                    <button onClick={onLogout} className="text-xs px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded">{t.logout}</button>
                </div>
            </div>
        </header>
    );
}

function LangSwitch({ lang, setLang }) {
    return (
        <div className="flex rounded-full bg-white/15 text-xs overflow-hidden">
            <button onClick={() => setLang('nl')} className={`px-3 py-1.5 ${lang === 'nl' ? 'bg-white text-ctf-primary' : 'text-white'}`}>NL</button>
            <button onClick={() => setLang('en')} className={`px-3 py-1.5 ${lang === 'en' ? 'bg-white text-ctf-primary' : 'text-white'}`}>EN</button>
        </div>
    );
}

function TabBar({ tabs, active, onChange, t }) {
    const labels = { tekst: t.tab_tekst, repetities: t.tab_repetities, contact: t.tab_contact };
    return (
        <nav className="bg-white border rounded-lg overflow-hidden flex">
            {tabs.map(id => (
                <button key={id} onClick={() => onChange(id)}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium ${active === id ? 'bg-ctf-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{labels[id]}</button>
            ))}
        </nav>
    );
}

function LoginScreen({ onLogin, lang, setLang, error }) {
    const [name, setName] = useState('');
    const [pin, setPin] = useState('');
    const [busy, setBusy] = useState(false);
    const t = UI[lang];

    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim() || pin.length < 4) return;
        setBusy(true);
        try { await onLogin(name.trim(), pin); } catch {} finally { setBusy(false); }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-ctf-primary/20 to-purple-100">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                <div className="flex justify-end mb-4"><LangSwitch lang={lang} setLang={setLang} /></div>
                <h1 className="text-2xl font-bold text-ctf-primary">{t.title}</h1>
                <p className="text-sm text-gray-500 mb-6">{t.subtitle}</p>
                <p className="text-sm text-gray-600 mb-4">{t.login_intro}</p>
                <form onSubmit={submit} className="space-y-3">
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.name}
                           className="w-full border rounded p-3 focus:outline-none focus:ring-2 focus:ring-ctf-primary/40" autoFocus />
                    <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={pin}
                           onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder={t.pincode}
                           className="w-full border rounded p-3 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-ctf-primary/40" />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <button type="submit" disabled={busy || !name.trim() || pin.length < 4}
                            className="w-full bg-ctf-primary text-white py-2.5 rounded font-medium hover:bg-ctf-primary/90 disabled:opacity-50">{t.login}</button>
                </form>
            </div>
        </div>
    );
}

function TekstTab({ detail, performanceId, onSaved, t }) {
    const [text, setText] = useState(detail.performance?.programmeurstekst || '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    useEffect(() => { setText(detail.performance?.programmeurstekst || ''); }, [detail.performance]);

    const save = async () => {
        setSaving(true); setSaved(false);
        try { await api.saveTekst(performanceId, text); setSaved(true); onSaved?.(); } catch (e) { alert('Opslaan mislukt: ' + (e.message || '')); } finally { setSaving(false); }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <p className="text-sm text-gray-600">{t.tekst_intro}</p>
            <textarea value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} rows={10}
                      placeholder={t.tekst_placeholder} className="w-full border rounded-lg p-3 text-sm" />
            <div className="flex items-center gap-3">
                <button onClick={save} disabled={saving} className="bg-ctf-primary text-white px-4 py-2 rounded font-medium hover:bg-ctf-primary/90 disabled:opacity-50">{t.save}</button>
                {saved && <span className="text-sm text-green-600">{t.saved}</span>}
            </div>
        </div>
    );
}

function fmtDT(iso, lang) {
    const d = new Date(iso); if (isNaN(d.getTime())) return '';
    return d.toLocaleString(lang === 'en' ? 'en-GB' : 'nl-NL', { dateStyle: 'medium', timeStyle: 'short' });
}
function fmtTime(iso, lang) {
    const d = new Date(iso); if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'nl-NL', { hour: '2-digit', minute: '2-digit' });
}

function RepetitiesTab({ detail, performanceId, reload, lang, t }) {
    const [form, setForm] = useState({ rehearsal_id: '', date: '', start: '', end: '', note: '' });
    const [busy, setBusy] = useState(false);
    const rehearsals = detail.rehearsals || [];
    const proposals = detail.proposals || [];

    const pickRehearsal = (r) => {
        if (r && r.starts_at) {
            const iso = new Date(r.starts_at).toISOString();
            setForm(f => ({ ...f, rehearsal_id: r.id, date: iso.slice(0, 10), start: fmtTime(r.starts_at, 'nl'), end: r.ends_at ? fmtTime(r.ends_at, 'nl') : '' }));
        }
    };

    const send = async (e) => {
        e.preventDefault();
        if (!form.date) return;
        setBusy(true);
        try {
            await api.createProposal(performanceId, {
                rehearsal_id: form.rehearsal_id || null,
                starts_at: `${form.date}T${form.start || '10:00'}:00`,
                ends_at: form.end ? `${form.date}T${form.end}:00` : null,
                note: form.note || null,
            });
            setForm({ rehearsal_id: '', date: '', start: '', end: '', note: '' });
            reload?.();
        } catch (e2) { alert('Versturen mislukt: ' + (e2.message || '')); } finally { setBusy(false); }
    };

    const remove = async (id) => {
        if (!window.confirm(t.proposal_delete_confirm)) return;
        try { await api.deleteProposal(id); reload?.(); } catch {}
    };

    const statusLabel = (s) => s === 'accepted' ? t.status_accepted : s === 'rejected' ? t.status_rejected : t.status_pending;
    const statusClass = (s) => s === 'accepted' ? 'text-green-700 bg-green-50' : s === 'rejected' ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50';

    return (
        <div className="space-y-5">
            <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.rehearsals_title}</h3>
                {!detail.rehearsals_released ? (
                    <EmptyState text={t.rehearsals_not_released} />
                ) : rehearsals.length === 0 ? (
                    <EmptyState text={t.rehearsals_none} />
                ) : (
                    <div className="bg-white rounded-xl shadow-sm divide-y">
                        {rehearsals.map(r => (
                            <div key={r.id} className="p-4 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-semibold">{fmtDT(r.starts_at, lang)}{r.ends_at ? ` – ${fmtTime(r.ends_at, lang)}` : ''}</div>
                                    {r.in_cafe && <div className="text-sm text-amber-700">🏠 {t.in_cafe}</div>}
                                    {r.note && <div className="text-sm text-gray-500">{r.note}</div>}
                                </div>
                                <button onClick={() => pickRehearsal(r)} className="text-sm text-ctf-primary hover:underline whitespace-nowrap">{t.propose_here}</button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.propose_title}</h3>
                <form onSubmit={send} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                    <p className="text-sm text-gray-600">{t.propose_intro}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="text-sm"><span className="block text-gray-600 mb-1">{t.date}</span>
                            <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full p-2 border rounded" /></label>
                        <label className="text-sm"><span className="block text-gray-600 mb-1">{t.start}</span>
                            <input type="time" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} className="w-full p-2 border rounded" /></label>
                        <label className="text-sm"><span className="block text-gray-600 mb-1">{t.end}</span>
                            <input type="time" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} className="w-full p-2 border rounded" /></label>
                    </div>
                    <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder={t.note} className="w-full p-2 border rounded text-sm" />
                    <button type="submit" disabled={busy} className="bg-ctf-primary text-white px-4 py-2 rounded font-medium hover:bg-ctf-primary/90 disabled:opacity-50">{t.send_proposal}</button>
                </form>
            </section>

            {proposals.length > 0 && (
                <section>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.proposals_title}</h3>
                    <div className="bg-white rounded-xl shadow-sm divide-y">
                        {proposals.map(p => (
                            <div key={p.id} className="p-4 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-semibold">{fmtDT(p.starts_at, lang)}{p.ends_at ? ` – ${fmtTime(p.ends_at, lang)}` : ''}</div>
                                    {p.note && <div className="text-sm text-gray-500">{p.note}</div>}
                                </div>
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <span className={`text-xs px-2 py-1 rounded-full ${statusClass(p.status)}`}>{statusLabel(p.status)}</span>
                                    {p.status === 'pending' && <button onClick={() => remove(p.id)} className="text-xs text-gray-400 hover:text-red-600">{t.delete}</button>}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

function ContactTab({ detail, t }) {
    const members = detail.members || [];
    const locs = detail.location_contacts || [];
    if (members.length === 0 && locs.length === 0) return <EmptyState text={t.no_items} />;
    return (
        <div className="space-y-6">
            {members.length > 0 && (
                <section>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.group_members}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {members.map(p => <PersonCard key={p.id} p={p} />)}
                    </div>
                </section>
            )}
            {locs.length > 0 && (
                <section>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.location_contact}</h3>
                    <div className="space-y-3">
                        {locs.map((l, i) => (
                            <div key={i} className="bg-white rounded-xl shadow-sm p-4">
                                <div className="font-semibold">{l.location}{l.city ? ` · ${l.city}` : ''}</div>
                                {(l.location_phone || l.location_email) && (
                                    <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                                        {l.location_phone && <div><a className="text-ctf-primary hover:underline" href={`tel:${l.location_phone}`}>{l.location_phone}</a></div>}
                                        {l.location_email && <div><a className="text-ctf-primary hover:underline" href={`mailto:${l.location_email}`}>{l.location_email}</a></div>}
                                    </div>
                                )}
                                {l.contact && <div className="mt-3 pt-3 border-t"><PersonCard p={l.contact} /></div>}
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

function PersonCard({ p }) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
                {p.photo ? <img src={p.photo} alt={p.name} className="w-14 h-14 rounded-full object-cover" />
                    : <div className="w-14 h-14 rounded-full bg-ctf-primary/20 text-ctf-primary flex items-center justify-center font-bold">{(p.name || '?').slice(0, 1)}</div>}
                <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    {p.function && <div className="text-xs text-gray-500 truncate">{p.function}</div>}
                </div>
            </div>
            {(p.email || p.phone) && (
                <div className="mt-3 text-xs text-gray-600 space-y-1">
                    {p.email && <div><a className="text-ctf-primary hover:underline" href={`mailto:${p.email}`}>{p.email}</a></div>}
                    {p.phone && <div><a className="text-ctf-primary hover:underline" href={`tel:${p.phone}`}>{p.phone}</a></div>}
                </div>
            )}
        </div>
    );
}

function InstallPrompt({ t }) {
    const [show, setShow] = useState(false);
    const [platform, setPlatform] = useState('android');
    const [deferred, setDeferred] = useState(null);

    useEffect(() => {
        const ua = navigator.userAgent || '';
        const isIOS = /iPhone|iPad|iPod/i.test(ua);
        const isAndroid = /Android/i.test(ua);
        const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
        let seen = false;
        try { seen = localStorage.getItem('ctfprogrammeur_install_hint_v1') === '1'; } catch {}
        if ((isIOS || isAndroid) && !standalone && !seen) { setPlatform(isIOS ? 'ios' : 'android'); setShow(true); }
        const onBeforeInstall = (e) => { e.preventDefault(); setDeferred(e); };
        window.addEventListener('beforeinstallprompt', onBeforeInstall);
        return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    }, []);

    const dismiss = () => { try { localStorage.setItem('ctfprogrammeur_install_hint_v1', '1'); } catch {} setShow(false); };
    const install = async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch {} setDeferred(null); dismiss(); };

    if (!show) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <h2 className="text-lg font-bold text-ctf-primary">{t.install_title}</h2>
                <p className="text-sm text-gray-600 mt-1">{t.install_intro}</p>
                {platform === 'ios' ? (
                    <ol className="text-sm text-gray-700 mt-4 space-y-2 list-decimal list-inside"><li>{t.install_ios_1}</li><li>{t.install_ios_2}</li></ol>
                ) : deferred ? (
                    <button onClick={install} className="w-full mt-4 bg-ctf-primary text-white py-2.5 rounded font-medium hover:bg-ctf-primary/90">{t.install_button}</button>
                ) : (
                    <ol className="text-sm text-gray-700 mt-4 space-y-2 list-decimal list-inside"><li>{t.install_android_1}</li><li>{t.install_android_2}</li></ol>
                )}
                <button onClick={dismiss} className="w-full mt-3 text-sm text-gray-500 py-2 hover:text-gray-700">{t.install_later}</button>
            </div>
        </div>
    );
}

function NotificationToggle({ vapidPublicKey, lang, t }) {
    const [state, setState] = useState('loading');
    const [busy, setBusy] = useState(false);
    useEffect(() => { let c = false; getPushState().then(s => { if (!c) setState(s); }); return () => { c = true; }; }, []);
    if (!vapidPublicKey || state === 'loading' || state === 'unsupported') return null;
    const enable = async () => { setBusy(true); try { await enablePush(vapidPublicKey, lang); setState('subscribed'); } catch { setState((window.Notification && Notification.permission === 'denied') ? 'denied' : 'default'); } finally { setBusy(false); } };
    const disable = async () => { setBusy(true); try { await disablePush(); setState('default'); } catch {} finally { setBusy(false); } };
    return (
        <div className="max-w-4xl mx-auto w-full px-4 mt-3">
            {state === 'subscribed' ? (
                <div className="bg-ctf-primary/10 text-ctf-primary rounded-lg px-4 py-2 text-sm flex items-center justify-between gap-3">
                    <span>🔔 {t.notif_enabled}</span><button onClick={disable} disabled={busy} className="underline hover:no-underline disabled:opacity-50">{t.notif_disable}</button>
                </div>
            ) : state === 'denied' ? (
                <div className="bg-amber-50 text-amber-800 rounded-lg px-4 py-2 text-sm">{t.notif_denied}</div>
            ) : (
                <div className="bg-white border rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                    <div className="text-sm text-gray-700">{t.notif_intro}</div>
                    <button onClick={enable} disabled={busy} className="whitespace-nowrap bg-ctf-primary text-white text-sm px-3 py-1.5 rounded font-medium hover:bg-ctf-primary/90 disabled:opacity-50">{t.notif_enable}</button>
                </div>
            )}
        </div>
    );
}

function EmptyState({ text }) {
    return <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">{text}</div>;
}
