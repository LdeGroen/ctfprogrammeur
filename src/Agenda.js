import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api';

/**
 * Agenda (10-11-2026): de repetities van al je makers in een weekrooster.
 *
 * Twee standen:
 *  - "Repetities plannen": alle repetities; klik op een blokje en plan meteen
 *    in dat je langskomt. Een repetitie waar je al bij bent ingepland krijgt
 *    een vinkje.
 *  - "Geplande bezoeken": alleen de momenten waarop jij langskomt.
 *
 * Bovenaan zet je makers aan en uit (onthouden in localStorage). De gegevens
 * komen uit hetzelfde overzicht als de lijst (`api.overview()`), dus er is
 * geen apart eindpunt.
 *
 * Meeloopcoach (rol 'mee', 10-11-2026): bij zo'n maker plan je niets zelf.
 * In de plannen-stand staan dan de bezoeken van de hoofdbegeleider, en vink je
 * aan dat je meegaat; de geplande stand toont waar je mee naartoe gaat.
 */

// Voluit geschreven, anders haalt Tailwind ze niet in de CSS.
const KLEUREN = [
    { blok: 'bg-indigo-100 border-indigo-400 text-indigo-900', knop: 'bg-indigo-600 border-indigo-600 text-white', stip: 'bg-indigo-500' },
    { blok: 'bg-emerald-100 border-emerald-400 text-emerald-900', knop: 'bg-emerald-600 border-emerald-600 text-white', stip: 'bg-emerald-500' },
    { blok: 'bg-amber-100 border-amber-400 text-amber-900', knop: 'bg-amber-500 border-amber-500 text-white', stip: 'bg-amber-500' },
    { blok: 'bg-rose-100 border-rose-400 text-rose-900', knop: 'bg-rose-600 border-rose-600 text-white', stip: 'bg-rose-500' },
    { blok: 'bg-sky-100 border-sky-400 text-sky-900', knop: 'bg-sky-600 border-sky-600 text-white', stip: 'bg-sky-500' },
    { blok: 'bg-violet-100 border-violet-400 text-violet-900', knop: 'bg-violet-600 border-violet-600 text-white', stip: 'bg-violet-500' },
    { blok: 'bg-lime-100 border-lime-500 text-lime-900', knop: 'bg-lime-600 border-lime-600 text-white', stip: 'bg-lime-500' },
    { blok: 'bg-orange-100 border-orange-400 text-orange-900', knop: 'bg-orange-500 border-orange-500 text-white', stip: 'bg-orange-500' },
    { blok: 'bg-teal-100 border-teal-400 text-teal-900', knop: 'bg-teal-600 border-teal-600 text-white', stip: 'bg-teal-500' },
    { blok: 'bg-fuchsia-100 border-fuchsia-400 text-fuchsia-900', knop: 'bg-fuchsia-600 border-fuchsia-600 text-white', stip: 'bg-fuchsia-500' },
];

const UUR_PX = 48;
const UIT_SLEUTEL = 'ctfprogrammeur_agenda_uit';
const WEERGAVE_SLEUTEL = 'ctfprogrammeur_agenda_weergave';
const MAX_IN_CEL = 4;

const pad = (n) => String(n).padStart(2, '0');
const dagSleutel = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
function maandag(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
}
const plusDagen = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const eersteVanMaand = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const plusMaanden = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const locale = (lang) => (lang === 'en' ? 'en-GB' : 'nl-NL');

function leesUit() {
    try { return new Set(JSON.parse(localStorage.getItem(UIT_SLEUTEL) || '[]')); } catch { return new Set(); }
}

export default function Agenda({ items, loading, onReload, onOpenMaker, alleenMeelopen, lang, t }) {
    const [stand, setStand] = useState('plannen');
    const [uit, setUit] = useState(leesUit);
    const [week, setWeek] = useState(null);
    // Week of maand (10-11-2026), onthouden per browser.
    const [weergave, setWeergave] = useState(() => { try { return localStorage.getItem(WEERGAVE_SLEUTEL) || 'week'; } catch { return 'week'; } });
    const [maand, setMaand] = useState(null);
    useEffect(() => { try { localStorage.setItem(WEERGAVE_SLEUTEL, weergave); } catch { /* geen opslag */ } }, [weergave]);
    const [gekozen, setGekozen] = useState(null);

    useEffect(() => {
        try { localStorage.setItem(UIT_SLEUTEL, JSON.stringify([...uit])); } catch { /* geen opslag: dan niet onthouden */ }
    }, [uit]);

    // Makers met kleur. Repetities horen bij het gezelschap; heeft een
    // gezelschap twee voorstellingen bij jou, dan telt elke repetitie één keer.
    const { makers, repetities, bezoeken } = useMemo(() => {
        const ms = [], reps = [], bzs = [];
        const gezien = new Set();
        (items || []).forEach((m) => {
            const pid = String(m.performance_id);
            const maker = { id: pid, titel: m.title, gezelschap: m.company, mee: m.rol === 'mee', kleur: KLEUREN[ms.length % KLEUREN.length] };
            ms.push(maker);
            if (maker.mee) {
                // Meelopen: de bezoeken van de hoofdbegeleider zijn de blokjes.
                (m.proposals || []).filter((p) => p.status !== 'rejected' && p.starts_at).forEach((p) => {
                    const b = { soort: 'meeloop', id: p.id, maker, start: new Date(p.starts_at), eind: p.ends_at ? new Date(p.ends_at) : null, note: p.note, programmer: p.programmer, ikMee: !!p.ik_mee, meelopers: p.meelopers || [] };
                    reps.push(b);
                    if (b.ikMee) bzs.push(b);
                });
                return;
            }
            (m.rehearsals || []).forEach((r) => {
                if (gezien.has(r.id) || !r.starts_at) return;
                gezien.add(r.id);
                reps.push({ soort: 'repetitie', id: r.id, maker, start: new Date(r.starts_at), eind: r.ends_at ? new Date(r.ends_at) : null, note: r.note });
            });
            (m.proposals || []).filter((p) => p.status !== 'rejected' && p.starts_at).forEach((p) => {
                bzs.push({ soort: 'bezoek', id: p.id, rehearsalId: p.rehearsal_id, maker, start: new Date(p.starts_at), eind: p.ends_at ? new Date(p.ends_at) : null, note: p.note, meelopers: p.meelopers || [] });
            });
        });
        return { makers: ms, repetities: reps, bezoeken: bzs };
    }, [items]);

    const metData = (stand === 'plannen' ? repetities : bezoeken);
    const makerIdsMetData = new Set(metData.map((e) => e.maker.id));
    const zichtbaar = metData.filter((e) => !uit.has(e.maker.id));

    // Bezoek per repetitie, om in de plannen-stand een vinkje te zetten.
    const bezoekBij = useMemo(() => {
        const map = new Map();
        bezoeken.forEach((b) => {
            if (b.rehearsalId) { map.set(b.rehearsalId, b); return; }
            // Zonder koppeling: een bezoek dat binnen een repetitie van die maker valt.
            const r = repetities.find((x) => x.maker.id === b.maker.id && b.start >= x.start && b.start < (x.eind || plusUur(x.start)));
            if (r && !map.has(r.id)) map.set(r.id, b);
        });
        return map;
    }, [bezoeken, repetities]);

    // Beginweek: deze week, of de eerste week met iets erin als deze week leeg is.
    const vandaag = maandag(new Date());
    const startWeek = useMemo(() => {
        const nu = new Date();
        const komend = metData.filter((e) => e.start >= vandaag).sort((a, b) => a.start - b.start);
        const dezeWeek = komend.some((e) => e.start < plusDagen(vandaag, 7));
        if (dezeWeek || komend.length === 0) return vandaag;
        return maandag(komend[0]?.start || nu);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stand, items]);
    useEffect(() => { setWeek(null); setMaand(null); }, [stand]);
    const huidigeWeek = week || startWeek;
    const dagen = [...Array(7)].map((_, i) => plusDagen(huidigeWeek, i));
    const weekEind = plusDagen(huidigeWeek, 7);
    const inWeek = zichtbaar.filter((e) => e.start >= huidigeWeek && e.start < weekEind);

    // Maand: de maand waar de week in valt (op donderdag, zoals een weeknummer),
    // tenzij er al met de pijltjes een maand is gekozen.
    const huidigeMaand = maand || eersteVanMaand(plusDagen(huidigeWeek, 3));
    const maandEind = plusMaanden(huidigeMaand, 1);
    const isMaand = weergave === 'maand';
    const vanaf = isMaand ? huidigeMaand : huidigeWeek;
    const tot = isMaand ? maandEind : weekEind;

    const volgende = zichtbaar.filter((e) => e.start >= tot).sort((a, b) => a.start - b.start)[0];
    const vorige = zichtbaar.filter((e) => e.start < vanaf).sort((a, b) => b.start - a.start)[0];
    const ga = (datum) => { if (isMaand) setMaand(eersteVanMaand(datum)); else setWeek(maandag(datum)); };
    const stap = (n) => { if (isMaand) setMaand(plusMaanden(huidigeMaand, n)); else setWeek(plusDagen(huidigeWeek, 7 * n)); };
    const kiesWeergave = (w) => {
        const nu = new Date();
        if (w === 'week' && isMaand) setWeek(maandag(huidigeMaand <= nu && maandEind > nu ? nu : huidigeMaand));
        if (w === 'maand' && !isMaand) setMaand(eersteVanMaand(plusDagen(huidigeWeek, 3)));
        setWeergave(w);
    };
    const roosterStart = maandag(huidigeMaand);
    const roosterEind = plusDagen(maandag(plusDagen(maandEind, -1)), 7);
    const inMaand = zichtbaar.filter((e) => e.start >= roosterStart && e.start < roosterEind);

    // Uren: standaard 9-18, groter als er iets eerder of later is.
    let vanUur = 9, totUur = 18;
    inWeek.forEach((e) => {
        vanUur = Math.min(vanUur, e.start.getHours());
        const eind = e.eind || plusUur(e.start);
        const eindUur = eind.getHours() + (eind.getMinutes() > 0 ? 1 : 0) + (dagSleutel(eind) !== dagSleutel(e.start) ? 24 : 0);
        totUur = Math.max(totUur, Math.min(24, eindUur));
    });
    const uren = [...Array(totUur - vanUur)].map((_, i) => vanUur + i);

    const toggle = (id) => setUit((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id); else n.add(id);
        return n;
    });
    const alles = (aan) => setUit(aan ? new Set() : new Set(makers.map((m) => m.id)));

    if (loading || items === null) return <div className="text-center text-gray-400 py-10">{t.loading}</div>;

    const maandLabel = huidigeMaand.toLocaleDateString(locale(lang), { month: 'long', year: 'numeric' });
    const weekLabel = `${dagen[0].toLocaleDateString(locale(lang), { day: 'numeric', month: 'short' })} – ${dagen[6].toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' })}`;

    return (
        <div className="space-y-4">
            <div className="flex rounded-lg bg-white border shadow-sm overflow-hidden">
                {['plannen', 'gepland'].map((s) => (
                    <button key={s} onClick={() => setStand(s)}
                        className={`flex-1 px-4 py-2 text-sm font-medium ${stand === s ? 'bg-ctf-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                        {s === 'plannen' ? (alleenMeelopen ? t.ag_mee_plannen : t.ag_plannen) : (alleenMeelopen ? t.ag_mee_gepland : t.ag_gepland)}
                        <span className="ml-1 opacity-75">({(s === 'plannen' ? repetities : bezoeken).length})</span>
                    </button>
                ))}
            </div>

            {/* Makers aan en uit */}
            <div className="bg-white rounded-xl shadow-sm p-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.ag_makers}</span>
                    <span className="text-xs space-x-3">
                        <button onClick={() => alles(true)} className="text-ctf-primary hover:underline">{t.ag_alle}</button>
                        <button onClick={() => alles(false)} className="text-ctf-primary hover:underline">{t.ag_geen}</button>
                    </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {makers.map((m) => {
                        const aan = !uit.has(m.id);
                        const leeg = !makerIdsMetData.has(m.id);
                        return (
                            <button key={m.id} onClick={() => toggle(m.id)} title={m.gezelschap || ''}
                                className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${aan ? m.kleur.knop : 'bg-white border-gray-300 text-gray-500'} ${leeg ? 'opacity-50' : ''}`}>
                                {!aan && <span className={`w-2 h-2 rounded-full ${m.kleur.stip}`} />}
                                {m.titel}
                            </button>
                        );
                    })}
                </div>
                {stand === 'plannen' && repetities.length === 0 && <p className="text-xs text-gray-500 mt-2">{alleenMeelopen ? t.ag_mee_geen : t.ag_geen_repetities}</p>}
                {stand === 'gepland' && bezoeken.length === 0 && <p className="text-xs text-gray-500 mt-2">{alleenMeelopen ? t.ag_mee_geen_gepland : t.ag_geen_bezoeken}</p>}
            </div>

            {/* Navigatie */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border bg-white overflow-hidden text-sm">
                    {['week', 'maand'].map((w) => (
                        <button key={w} onClick={() => kiesWeergave(w)}
                            className={`px-3 py-1.5 ${weergave === w ? 'bg-ctf-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                            {w === 'week' ? t.ag_week : t.ag_maand}
                        </button>
                    ))}
                </div>
                <button onClick={() => stap(-1)} className="px-3 py-1.5 bg-white border rounded-lg text-sm hover:bg-gray-50" aria-label={isMaand ? t.ag_vorige_maand : t.ag_vorige_week}>←</button>
                <button onClick={() => stap(1)} className="px-3 py-1.5 bg-white border rounded-lg text-sm hover:bg-gray-50" aria-label={isMaand ? t.ag_volgende_maand : t.ag_volgende_week}>→</button>
                <button onClick={() => (isMaand ? setMaand(eersteVanMaand(new Date())) : setWeek(vandaag))} className="px-3 py-1.5 bg-white border rounded-lg text-sm hover:bg-gray-50">{isMaand ? t.ag_deze_maand : t.ag_vandaag}</button>
                <span className="font-semibold text-gray-800 text-sm first-letter:uppercase">{isMaand ? maandLabel : weekLabel}</span>
                <span className="flex-1" />
                {vorige && <button onClick={() => ga(vorige.start)} className="text-xs text-ctf-primary hover:underline">← {t.ag_vorige_met}</button>}
                {volgende && <button onClick={() => ga(volgende.start)} className="text-xs text-ctf-primary hover:underline">{t.ag_volgende_met} →</button>}
                <button onClick={onReload} className="text-xs text-ctf-primary hover:underline">↻ {t.overview_refresh}</button>
            </div>

            {isMaand && (
                <MaandRooster maand={huidigeMaand} items={inMaand} bezoekBij={bezoekBij} stand={stand} onKies={setGekozen}
                    onDag={(d) => { setWeek(maandag(d)); setWeergave('week'); }} lang={lang} t={t} />
            )}
            {isMaand && inMaand.length === 0 && zichtbaar.length > 0 && (
                <p className="text-sm text-gray-500 text-center">{t.ag_maand_leeg}</p>
            )}

            {/* Rooster */}
            {!isMaand && <>
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                <div className="min-w-[720px]">
                    <div className="grid border-b" style={{ gridTemplateColumns: '3rem repeat(7, minmax(0, 1fr))' }}>
                        <div />
                        {dagen.map((d) => {
                            const isVandaag = dagSleutel(d) === dagSleutel(new Date());
                            return (
                                <div key={dagSleutel(d)} className={`text-center py-2 text-xs border-l ${isVandaag ? 'text-ctf-primary font-bold' : 'text-gray-600'}`}>
                                    <div className="uppercase">{d.toLocaleDateString(locale(lang), { weekday: 'short' })}</div>
                                    <div className="text-base font-semibold">{d.getDate()}</div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="grid relative" style={{ gridTemplateColumns: '3rem repeat(7, minmax(0, 1fr))' }}>
                        <div className="relative" style={{ height: uren.length * UUR_PX }}>
                            {uren.map((u, i) => (
                                <div key={u} className="absolute right-0 text-[10px] text-gray-400 pr-1.5 leading-none" style={{ top: i * UUR_PX + (i === 0 ? 2 : -5) }}>{pad(u)}:00</div>
                            ))}
                        </div>
                        {dagen.map((d) => (
                            <DagKolom key={dagSleutel(d)} dag={d} items={inWeek.filter((e) => dagSleutel(e.start) === dagSleutel(d))}
                                vanUur={vanUur} uren={uren} bezoekBij={bezoekBij} stand={stand} onKies={setGekozen} lang={lang} />
                        ))}
                    </div>
                </div>
            </div>
            {inWeek.length === 0 && zichtbaar.length > 0 && (
                <p className="text-sm text-gray-500 text-center">{t.ag_week_leeg}</p>
            )}
            </>}

            {gekozen && (
                <BlokDialoog item={gekozen} bezoek={gekozen.soort === 'repetitie' ? bezoekBij.get(gekozen.id) : null} lopers={gekozen.meelopers || []}
                    onSluit={() => setGekozen(null)} onKlaar={() => { setGekozen(null); onReload(); }}
                    onOpenMaker={onOpenMaker} lang={lang} t={t} />
            )}
        </div>
    );
}

/**
 * Maandoverzicht: per dag de blokjes als regeltjes (tijd + maker). Te veel op
 * een dag? Dan "+n"; klikken daarop of op het dagnummer opent die week.
 */
function MaandRooster({ maand, items, bezoekBij, stand, onKies, onDag, lang, t }) {
    const start = maandag(maand);
    const laatste = plusDagen(plusMaanden(maand, 1), -1);
    const weken = Math.round((maandag(laatste) - start) / (7 * 86400000)) + 1;
    const dagen = [...Array(weken * 7)].map((_, i) => plusDagen(start, i));
    const perDag = new Map();
    [...items].sort((a, b) => a.start - b.start).forEach((e) => {
        const k = dagSleutel(e.start);
        if (!perDag.has(k)) perDag.set(k, []);
        perDag.get(k).push(e);
    });
    const vandaagK = dagSleutel(new Date());

    return (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <div className="min-w-[720px]">
                <div className="grid grid-cols-7 border-b">
                    {dagen.slice(0, 7).map((d) => (
                        <div key={d.getDay()} className="text-center py-2 text-xs uppercase text-gray-600">{d.toLocaleDateString(locale(lang), { weekday: 'short' })}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {dagen.map((d) => {
                        const k = dagSleutel(d);
                        const lijst = perDag.get(k) || [];
                        const buiten = d.getMonth() !== maand.getMonth();
                        return (
                            <div key={k} className={`min-h-[104px] border-b border-r p-1 ${buiten ? 'bg-gray-50' : ''}`}>
                                <button onClick={() => onDag(d)} className={`text-xs mb-0.5 px-1 rounded hover:bg-gray-100 ${k === vandaagK ? 'text-ctf-primary font-bold' : buiten ? 'text-gray-400' : 'text-gray-700'}`}>
                                    {d.getDate()}
                                </button>
                                <div className="space-y-0.5">
                                    {lijst.slice(0, MAX_IN_CEL).map((e) => {
                                        const vink = stand === 'plannen' && (e.soort === 'meeloop' ? e.ikMee : bezoekBij.has(e.id));
                                        return (
                                            <button key={`${e.soort}-${e.id}`} onClick={() => onKies(e)}
                                                className={`w-full text-left text-[11px] leading-tight px-1 py-0.5 rounded border-l-4 truncate block ${e.maker.kleur.blok} ${vink ? 'ring-1 ring-green-600' : ''}`}>
                                                {vink && '✓ '}<span className="opacity-75">{hhmm(e.start)}</span> {e.maker.titel}
                                            </button>
                                        );
                                    })}
                                    {lijst.length > MAX_IN_CEL && (
                                        <button onClick={() => onDag(d)} className="text-[11px] text-ctf-primary hover:underline px-1">+{lijst.length - MAX_IN_CEL} {t.ag_meer}</button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function plusUur(d) { return new Date(d.getTime() + 60 * 60 * 1000); }

function DagKolom({ dag, items, vanUur, uren, bezoekBij, stand, onKies, lang }) {
    // Overlappende blokjes naast elkaar: per blok de eerste vrije baan.
    const gesorteerd = [...items].sort((a, b) => a.start - b.start);
    const banenEind = [];
    const geplaatst = gesorteerd.map((e) => {
        const eind = e.eind && e.eind > e.start ? e.eind : plusUur(e.start);
        let baan = banenEind.findIndex((t) => t <= e.start);
        if (baan === -1) { baan = banenEind.length; banenEind.push(eind); } else banenEind[baan] = eind;
        return { e, eind, baan };
    });
    const aantalBanen = Math.max(1, banenEind.length);
    const dagStart = new Date(dag.getFullYear(), dag.getMonth(), dag.getDate(), vanUur);
    const maxPx = uren.length * UUR_PX;

    return (
        <div className="relative border-l" style={{ height: maxPx }}>
            {uren.map((u, i) => <div key={u} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: i * UUR_PX }} />)}
            {geplaatst.map(({ e, eind, baan }) => {
                const top = Math.max(0, ((e.start - dagStart) / 60000) * (UUR_PX / 60));
                const hoogte = Math.max(22, Math.min(maxPx - top, ((eind - e.start) / 60000) * (UUR_PX / 60)));
                const bezoek = stand === 'plannen' ? (e.soort === 'meeloop' ? (e.ikMee ? e : null) : bezoekBij.get(e.id)) : null;
                const met = (e.soort === 'repetitie' ? bezoek?.meelopers : e.meelopers) || [];
                return (
                    <button key={`${e.soort}-${e.id}`} onClick={() => onKies(e)}
                        className={`absolute rounded-md border-l-4 px-1.5 py-0.5 text-left overflow-hidden text-[11px] leading-tight shadow-sm hover:brightness-95 ${e.maker.kleur.blok} ${bezoek ? 'ring-2 ring-green-600' : ''}`}
                        style={{ top, height: hoogte, left: `calc(${(baan / aantalBanen) * 100}% + 2px)`, width: `calc(${100 / aantalBanen}% - 4px)` }}>
                        <div className="font-semibold truncate">{bezoek && '✓ '}{e.maker.titel}</div>
                        <div className="truncate opacity-80">{hhmm(e.start)}{e.eind ? `–${hhmm(e.eind)}` : ''}</div>
                        {e.soort === 'meeloop' && e.programmer && <div className="truncate opacity-80">{e.programmer}</div>}
                        {e.soort !== 'meeloop' && met.length > 0 && <div className="truncate opacity-80">+ {met.join(', ')}</div>}
                    </button>
                );
            })}
        </div>
    );
}

function BlokDialoog({ item, bezoek, lopers, onSluit, onKlaar, onOpenMaker, lang, t }) {
    const [form, setForm] = useState(() => ({
        start: hhmm(item.start),
        eind: item.eind ? hhmm(item.eind) : '',
        note: '',
    }));
    const [bezig, setBezig] = useState(false);
    const [fout, setFout] = useState('');

    useEffect(() => {
        const esc = (ev) => { if (ev.key === 'Escape') onSluit(); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onSluit]);

    const datum = dagSleutel(item.start);
    const tijd = (d) => d.toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' });
    const wanneer = `${item.start.toLocaleDateString(locale(lang), { weekday: 'long', day: 'numeric', month: 'long' })}, ${tijd(item.start)}${item.eind ? `–${tijd(item.eind)}` : ''}`;

    const inplannen = async (e) => {
        e.preventDefault();
        setBezig(true); setFout('');
        try {
            await api.createProposal(item.maker.id, {
                rehearsal_id: item.id,
                starts_at: `${datum}T${form.start || hhmm(item.start)}:00`,
                ends_at: form.eind ? `${datum}T${form.eind}:00` : null,
                note: form.note || null,
            });
            onKlaar();
        } catch (err) { setFout(err.message || t.ag_mislukt); setBezig(false); }
    };

    const meegaan = async (mee) => {
        setBezig(true); setFout('');
        try { await api.meelopen(item.id, mee); onKlaar(); } catch (err) { setFout(err.message || t.ag_mislukt); setBezig(false); }
    };

    const weg = async (id) => {
        if (!window.confirm(t.proposal_delete_confirm)) return;
        setBezig(true);
        try { await api.deleteProposal(id); onKlaar(); } catch (err) { setFout(err.message || t.ag_mislukt); setBezig(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onSluit}>
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{item.soort === 'repetitie' ? t.ag_repetitie : item.soort === 'meeloop' ? t.ag_bezoek_van.replace('{naam}', item.programmer || t.ag_begeleider) : t.ag_bezoek}</div>
                        <div className="font-bold text-lg truncate">{item.maker.titel}</div>
                        {item.maker.gezelschap && <div className="text-sm text-gray-500 truncate">{item.maker.gezelschap}</div>}
                    </div>
                    <button onClick={onSluit} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label={t.ag_sluiten}>×</button>
                </div>
                <div className="text-sm">
                    <div className="font-medium first-letter:uppercase">{wanneer}</div>
                    {item.note && <div className="text-gray-500 mt-1">{item.note}</div>}
                </div>

                {item.soort === 'meeloop' && (
                    <div className="space-y-2">
                        {(item.meelopers || []).length > 0 && <p className="text-sm text-gray-600">{t.ag_gaan_mee}: {item.meelopers.join(', ')}</p>}
                        {item.ikMee ? (
                            <>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">✓ {t.ag_jij_gaat_mee}</div>
                                <button onClick={() => meegaan(false)} disabled={bezig} className="w-full border border-red-300 text-red-700 py-2 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50">{t.ag_toch_niet_mee}</button>
                            </>
                        ) : (
                            <button onClick={() => meegaan(true)} disabled={bezig} className="w-full bg-ctf-primary text-white py-2.5 rounded-lg font-semibold hover:bg-ctf-primary/90 disabled:opacity-50">
                                {bezig ? t.loading : t.ag_ik_ga_mee}
                            </button>
                        )}
                        <p className="text-xs text-gray-500">{t.ag_mee_uitleg}</p>
                    </div>
                )}

                {item.soort !== 'meeloop' && lopers.length > 0 && (
                    <p className="text-sm text-gray-600">{t.ag_gaan_mee}: {lopers.join(', ')}</p>
                )}

                {item.soort === 'repetitie' && bezoek && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm flex items-center justify-between gap-3">
                        <span className="text-green-800">✓ {t.ag_al_ingepland} {tijd(bezoek.start)}{bezoek.eind ? `–${tijd(bezoek.eind)}` : ''}{bezoek.meelopers?.length ? ` (${t.ag_met} ${bezoek.meelopers.join(', ')})` : ''}</span>
                        <button onClick={() => weg(bezoek.id)} disabled={bezig} className="text-xs text-red-600 hover:underline disabled:opacity-50">{t.delete}</button>
                    </div>
                )}

                {item.soort === 'repetitie' && !bezoek && (
                    <form onSubmit={inplannen} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <label className="text-sm"><span className="block text-gray-600 mb-1">{t.start}</span>
                                <input type="time" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} className="w-full p-2 border rounded" /></label>
                            <label className="text-sm"><span className="block text-gray-600 mb-1">{t.end}</span>
                                <input type="time" value={form.eind} onChange={(e) => setForm((f) => ({ ...f, eind: e.target.value }))} className="w-full p-2 border rounded" /></label>
                        </div>
                        <input type="text" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder={t.note} className="w-full p-2 border rounded text-sm" />
                        <p className="text-xs text-gray-500">{t.ag_inplannen_uitleg}</p>
                        <button type="submit" disabled={bezig} className="w-full bg-ctf-primary text-white py-2.5 rounded-lg font-semibold hover:bg-ctf-primary/90 disabled:opacity-50">
                            {bezig ? t.loading : t.ag_langskomen}
                        </button>
                    </form>
                )}

                {item.soort === 'bezoek' && (
                    <button onClick={() => weg(item.id)} disabled={bezig} className="w-full border border-red-300 text-red-700 py-2 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50">{t.ag_bezoek_weg}</button>
                )}

                {fout && <div className="text-sm text-red-600">{fout}</div>}
                <button onClick={() => { onSluit(); onOpenMaker(item.maker.id); }} className="text-sm text-ctf-primary hover:underline">{t.ag_naar_maker} →</button>
            </div>
        </div>
    );
}
