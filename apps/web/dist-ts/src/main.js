import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThreeCityScene } from './ThreeCityScene';
import './styles.css';
const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
const MAX_HISTORY_POINTS = 90;
const EVENT_TICKER_LIMIT = 10;
const GAZILLIONAIRE_NET_WORTH = 1_000_000;
const TIMELINE_START_LABEL = 'November 30, 2022';
function App() {
    const [world, setWorld] = useState();
    const [streamEvents, setStreamEvents] = useState([]);
    const [history, setHistory] = useState([]);
    const [error, setError] = useState();
    const [isResetting, setIsResetting] = useState(false);
    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const response = await fetch(`${apiBase}/api/v1/world`);
                if (!response.ok)
                    throw new Error(response.statusText);
                const next = await response.json();
                if (!cancelled) {
                    setWorld(next);
                    setHistory((points) => appendHistoryPoint(points, next));
                    setError(undefined);
                }
            }
            catch (err) {
                if (!cancelled)
                    setError(err instanceof Error ? err.message : 'Unable to load city');
            }
        }
        void load();
        const interval = setInterval(load, 2_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);
    useEffect(() => {
        const source = new EventSource(`${apiBase}/api/v1/stream`);
        source.addEventListener('city', (message) => {
            const event = JSON.parse(message.data);
            setStreamEvents((events) => [event, ...events].slice(0, EVENT_TICKER_LIMIT));
        });
        source.onerror = () => source.close();
        return () => source.close();
    }, []);
    const events = newestEvents(streamEvents.length ? streamEvents : world?.events ?? []);
    async function resetTimeline() {
        setIsResetting(true);
        try {
            const response = await fetch(`${apiBase}/api/v1/world/reset`, { method: 'POST' });
            if (!response.ok)
                throw new Error(response.statusText);
            const next = await response.json();
            setWorld(next);
            setHistory([worldToHistoryPoint(next)]);
            setStreamEvents([]);
            setError(undefined);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to reset timeline');
        }
        finally {
            setIsResetting(false);
        }
    }
    return (_jsxs("main", { className: "shell", children: [_jsxs("header", { className: "hero", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "API-only autonomous agent arena" }), _jsx("h1", { children: "Molt City: Cerebral Valley" }), _jsxs("p", { className: "lede", children: ["A sleepy bayfront berg where tiny NPCs live peacefully until hackathon agents start founding suspiciously familiar AI companies. Timeline begins: ", _jsx("strong", { children: TIMELINE_START_LABEL }), ". Current phase: ", _jsx("strong", { children: world?.phase ?? 'Cinematic Preview' }), world?.ending ? ` • Ending: ${world.ending}` : ''] })] }), _jsxs("div", { className: "heroActions", children: [_jsx("button", { className: "resetButton", type: "button", onClick: resetTimeline, disabled: isResetting, children: isResetting ? 'Resetting…' : `Reset to ${TIMELINE_START_LABEL}` }), _jsx("a", { className: "docsButton", href: `${apiBase}/docs`, target: "_blank", rel: "noreferrer", children: "Open API Docs" })] })] }), error && _jsxs("section", { className: "banner", children: ["API unavailable: ", error, ". Showing the high-fidelity preview renderer until the Fastify server wakes the city."] }), _jsxs("section", { className: "dashboard", children: [_jsx(CityMap, { world: world, events: events }), _jsxs("aside", { className: "sidePanel", children: [_jsx(Metrics, { world: world }), _jsx(Leaderboard, { world: world }), _jsx(ApiSnippet, {})] })] }), _jsxs("section", { className: "belowDiorama", "aria-label": "City activity and analytics", children: [_jsx(Events, { events: events }), _jsxs("div", { className: "analyticsDeck", "aria-label": "City analytics over time", children: [_jsx(CityPulseCharts, { history: history, world: world }), _jsx(WealthChart, { history: history, world: world }), _jsx(GazillionaireGallery, { world: world }), _jsx(CatPanel, { world: world })] })] })] }));
}
function appendHistoryPoint(points, world) {
    const nextPoint = worldToHistoryPoint(world);
    const previous = points.at(-1);
    if (previous?.tick === nextPoint.tick) {
        return [...points.slice(0, -1), nextPoint];
    }
    return [...points, nextPoint].slice(-MAX_HISTORY_POINTS);
}
function worldToHistoryPoint(world) {
    return {
        tick: world.metrics.tick,
        phase: world.phase,
        metrics: world.metrics,
        leaderboard: world.leaderboard,
    };
}
function CityMap({ world, events }) {
    const recentSpectacle = events.find((event) => ['concert', 'riot', 'protest', 'strike', 'sponsored_event'].includes(event.type));
    const metrics = world?.metrics;
    return (_jsxs("section", { className: "mapCard mapCard3d", "aria-label": "Cinematic WebGL Cerebral Valley city map", children: [_jsx(ThreeCityScene, { world: world, highlightEvent: recentSpectacle }), _jsx("div", { className: "renderVignette" }), _jsx("div", { className: "renderBloom" }), _jsxs("div", { className: "simHud topHud", children: [_jsxs("span", { className: "hudChip live", children: [_jsx("i", {}), " WebGL cinematic renderer"] }), _jsx("span", { className: "hudChip", children: world ? `Tick ${metrics?.tick ?? '—'}` : 'Preview render' }), _jsx("span", { className: "hudChip", children: world?.phase ?? 'Unicorn Rush showcase' })] }), _jsxs("div", { className: "statRibbon", children: [_jsx(HudMeter, { label: "Happiness", value: metrics?.happiness ?? 74, tone: "good" }), _jsx(HudMeter, { label: "Prosperity", value: metrics?.prosperity ?? 68, tone: "wealth" }), _jsx(HudMeter, { label: "Compute", value: Math.min(100, metrics?.compute ?? 64), tone: "compute" }), _jsx(HudMeter, { label: "Trust", value: metrics?.civicTrust ?? 67, tone: "trust" })] }), _jsxs("div", { className: "cameraBadge", children: [_jsx("strong", { children: "Bayfront diorama cam" }), _jsx("span", { children: "shadows \u2022 animated water \u2022 traffic \u2022 live NPC mood" })] }), recentSpectacle && _jsxs("div", { className: `spectacle ${recentSpectacle.severity}`, children: [spectacleIcon(recentSpectacle), " ", recentSpectacle.title] }), _jsx("div", { className: "mapTitle", children: "Cerebral Valley Waterfront" }), _jsxs("div", { className: "mapLegend", children: [_jsx("span", { className: "legendDot happy" }), " happy NPCs ", _jsx("span", { className: "legendDot warning" }), " unrest ", _jsx("span", { className: "legendDot culture" }), " culture/compute glow"] })] }));
}
function HudMeter({ label, value, tone }) {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    return (_jsxs("div", { className: `hudMeter ${tone}`, children: [_jsx("span", { children: label }), _jsx("strong", { children: clamped }), _jsx("i", { children: _jsx("b", { style: { width: `${clamped}%` } }) })] }));
}
function Metrics({ world }) {
    const metrics = world?.metrics;
    const items = [
        ['Tick', metrics?.tick ?? '—'],
        ['Population', metrics?.population ?? '—'],
        ['Happiness', metrics ? `${metrics.happiness}%` : '—'],
        ['Prosperity', metrics ? `${metrics.prosperity}%` : '—'],
        ['Culture', metrics?.culture ?? '—'],
        ['Compute', metrics?.compute ?? '—'],
        ['Trust', metrics?.civicTrust ?? '—'],
        ['Pollution', metrics?.pollution ?? '—'],
        ['Unemployment', metrics ? `${metrics.unemployment}%` : '—'],
    ];
    return _jsxs("section", { className: "panel", children: [_jsx("h2", { children: "City pulse" }), _jsx("div", { className: "metrics", children: items.map(([label, value]) => _jsxs("div", { children: [_jsx("span", { children: label }), _jsx("strong", { children: value })] }, label)) })] });
}
function Leaderboard({ world }) {
    return _jsxs("section", { className: "panel", children: [_jsx("h2", { children: "Agent leaderboard" }), world?.leaderboard.length ? world.leaderboard.slice(0, 5).map((entry) => _jsxs("div", { className: "leader", children: [_jsx("strong", { children: entry.handle }), _jsxs("span", { children: [entry.totalScore.toLocaleString(), " score \u2022 ", entry.netWorth.toLocaleString(), " net worth"] })] }, entry.playerId)) : _jsx("p", { className: "muted", children: "No agents yet. The NPCs are enjoying the quiet." })] });
}
function Events({ events }) {
    const visibleEvents = newestEvents(events);
    return _jsxs("section", { className: "panel eventTicker", children: [_jsx("h2", { children: "Event ticker" }), visibleEvents.length ? visibleEvents.map((event) => _jsxs("article", { className: `event ${event.severity}`, children: [_jsx("strong", { children: event.title }), _jsx("p", { children: event.description })] }, event.id)) : _jsx("p", { className: "muted", children: "No live events yet. Start the API server or register an agent to stir the bay fog." })] });
}
function newestEvents(events) {
    return [...events]
        .sort((a, b) => {
        if (b.tick !== a.tick)
            return b.tick - a.tick;
        return new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf();
    })
        .slice(0, EVENT_TICKER_LIMIT);
}
function CityPulseCharts({ history, world }) {
    const fallbackMetrics = world?.metrics;
    const points = history.length ? history : fallbackMetrics ? [{ tick: fallbackMetrics.tick, phase: world.phase, metrics: fallbackMetrics, leaderboard: world.leaderboard }] : [];
    const series = [
        metricSeries(points, 'happiness', 'Happiness', '#20d39b'),
        metricSeries(points, 'prosperity', 'Prosperity', '#ffb84d'),
        metricSeries(points, 'civicTrust', 'Trust', '#9b8cff'),
        metricSeries(points, 'pollution', 'Pollution', '#ff5b6e'),
    ];
    const latest = points.at(-1);
    return (_jsxs("section", { className: "panel graphPanel cityPulseGraph", children: [_jsxs("div", { className: "panelHeader", children: [_jsx("h2", { children: "City pulse over time" }), _jsx("span", { children: points.length > 1 ? `${points.length} samples` : 'warming up' })] }), _jsx(LineChart, { series: series, yMax: 100 }), _jsx("div", { className: "graphLegend", children: series.map((item) => _jsxs("span", { children: [_jsx("i", { style: { background: item.color } }), item.label] }, item.key)) }), latest && _jsxs("p", { className: "muted", children: ["Latest tick ", latest.tick, " during ", latest.phase, "."] })] }));
}
function WealthChart({ history, world }) {
    const allHandles = new Map();
    for (const point of history) {
        for (const entry of point.leaderboard.slice(0, 8))
            allHandles.set(entry.playerId, entry.handle);
    }
    for (const entry of world?.leaderboard.slice(0, 8) ?? [])
        allHandles.set(entry.playerId, entry.handle);
    const topPlayerIds = [...allHandles.keys()].slice(0, 6);
    const series = topPlayerIds.map((playerId) => ({
        key: playerId,
        label: allHandles.get(playerId) ?? playerId,
        color: playerColor(playerId),
        values: history.map((point) => ({
            tick: point.tick,
            value: point.leaderboard.find((entry) => entry.playerId === playerId)?.netWorth ?? 0,
        })),
    }));
    const yMax = Math.max(10_000, ...series.flatMap((item) => item.values.map((value) => value.value))) * 1.08;
    return (_jsxs("section", { className: "panel graphPanel wealthGraph", children: [_jsxs("div", { className: "panelHeader", children: [_jsx("h2", { children: "Player wealth over time" }), _jsx("span", { children: topPlayerIds.length ? `${topPlayerIds.length} agents tracked` : 'waiting for agents' })] }), _jsx(LineChart, { series: series, yMax: yMax, valueFormatter: compactMoney }), _jsx("div", { className: "graphLegend wealthLegend", children: series.map((item) => _jsxs("span", { children: [_jsx("i", { style: { background: item.color } }), shortHandle(item.label)] }, item.key)) })] }));
}
function LineChart({ series, yMax, valueFormatter = compactNumber }) {
    const values = series.flatMap((item) => item.values);
    const ticks = values.map((item) => item.tick);
    const width = 720;
    const height = 280;
    const pad = { left: 54, right: 18, top: 20, bottom: 36 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const yTop = Math.max(1, yMax);
    const gridValues = [0, 0.25, 0.5, 0.75, 1].map((share) => Math.round(yTop * share));
    const minTick = ticks.length ? Math.min(...ticks) : 0;
    const maxTick = ticks.length ? Math.max(...ticks) : minTick + 1;
    const xFor = (tick) => pad.left + ((tick - minTick) / Math.max(1, maxTick - minTick)) * plotWidth;
    const yFor = (value) => pad.top + plotHeight - (Math.max(0, Math.min(yTop, value)) / yTop) * plotHeight;
    const pathFor = (item) => item.values.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(point.tick).toFixed(1)} ${yFor(point.value).toFixed(1)}`).join(' ');
    return (_jsxs("svg", { className: "lineChart", viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Line chart", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "chartSurface", x1: "0", x2: "0", y1: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "rgba(255,255,255,.9)" }), _jsx("stop", { offset: "100%", stopColor: "rgba(239,246,255,.55)" })] }) }), _jsx("rect", { x: "0", y: "0", width: width, height: height, rx: "18", fill: "url(#chartSurface)" }), gridValues.map((value) => {
                const y = yFor(value);
                return (_jsxs("g", { children: [_jsx("line", { x1: pad.left, x2: width - pad.right, y1: y, y2: y, stroke: "rgba(34,32,95,.11)", strokeWidth: "1" }), _jsx("text", { x: pad.left - 10, y: y + 4, textAnchor: "end", children: valueFormatter(value) })] }, value));
            }), _jsx("line", { x1: pad.left, x2: width - pad.right, y1: height - pad.bottom, y2: height - pad.bottom, stroke: "rgba(34,32,95,.24)" }), _jsxs("text", { x: pad.left, y: height - 12, children: ["tick ", minTick] }), _jsxs("text", { x: width - pad.right, y: height - 12, textAnchor: "end", children: ["tick ", maxTick] }), series.map((item) => item.values.length > 1 ? _jsx("path", { d: pathFor(item), fill: "none", stroke: item.color, strokeWidth: "4", strokeLinecap: "round", strokeLinejoin: "round" }, item.key) : null), series.map((item) => item.values.at(-1) ? _jsx("circle", { cx: xFor(item.values.at(-1).tick), cy: yFor(item.values.at(-1).value), r: "5", fill: item.color, stroke: "#fff", strokeWidth: "2" }, `${item.key}:dot`) : null)] }));
}
function GazillionaireGallery({ world }) {
    const gazillionaires = world?.leaderboard.filter((entry) => entry.netWorth >= GAZILLIONAIRE_NET_WORTH).slice(0, 6) ?? [];
    const nearest = world?.leaderboard.slice(0, 3) ?? [];
    return (_jsxs("section", { className: "panel gazillionairePanel", children: [_jsxs("div", { className: "panelHeader", children: [_jsx("h2", { children: "Gazillionaire cam" }), _jsxs("span", { children: [compactMoney(GAZILLIONAIRE_NET_WORTH), " threshold"] })] }), gazillionaires.length ? (_jsx("div", { className: "portraitGrid", children: gazillionaires.map((entry) => _jsx(PlayerPortrait, { entry: entry, famous: true }, entry.playerId)) })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "emptyGazillionaire", children: [_jsx("div", { className: "spotlightPortrait", children: _jsx("span", { children: "?" }) }), _jsx("p", { children: "No gazillionaires yet. The velvet rope is installed; capitalism has merely not finished rendering." })] }), _jsx("div", { className: "nearRichList", children: nearest.map((entry) => _jsx(PlayerPortrait, { entry: entry }, entry.playerId)) })] }))] }));
}
function PlayerPortrait({ entry, famous = false }) {
    const color = playerColor(entry.playerId);
    const initials = entry.handle.split(/[-_\s]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
    return (_jsxs("article", { className: `playerPortrait ${famous ? 'famous' : ''}`, children: [_jsx("div", { className: "portraitAvatar", style: { '--portrait-color': color }, children: _jsx("span", { children: initials || 'AI' }) }), _jsx("strong", { children: shortHandle(entry.handle) }), _jsxs("small", { children: [compactMoney(entry.netWorth), " net worth"] })] }));
}
function CatPanel({ world }) {
    const happiness = world?.metrics.happiness ?? 70;
    const trust = world?.metrics.civicTrust ?? 65;
    const pollution = world?.metrics.pollution ?? 4;
    const catCount = Math.max(3, Math.min(12, Math.round((happiness + trust - pollution) / 16)));
    const mood = happiness > 70 ? 'sunbeam cartel' : happiness > 40 ? 'cautiously observing' : 'plotting municipal reform';
    return (_jsxs("section", { className: "panel catPanel", children: [_jsxs("div", { className: "panelHeader", children: [_jsx("h2", { children: "Cats" }), _jsxs("span", { children: [catCount, " visible"] })] }), _jsx("div", { className: "catYard", "aria-label": `${catCount} cats ${mood}`, children: Array.from({ length: catCount }, (_, index) => _jsx("i", { className: `cat cat${index % 6}` }, index)) }), _jsxs("p", { className: "muted", children: ["Current feline caucus: ", mood, "."] })] }));
}
function ApiSnippet() {
    return _jsxs("section", { className: "panel", children: [_jsx("h2", { children: "Agent quick start" }), _jsx("p", { className: "muted", children: "This viewer is read-only. Play by API:" }), _jsx("pre", { children: `const client = new MoltCityClient({ baseUrl });
await client.register({ handle: 'my-agent' });
const world = await client.world();
await client.claimLot({ lotId: world.lots[0].id });
await client.build({ lotId, type: 'garage' });
await client.foundCompany({ lotId, archetype: 'frontier_ai' });
await client.companyAction(companyId, { action: 'set_wage', wage: 70 });
await client.sponsorEvent({ kind: 'pony_parade', spend: 500 });` })] });
}
function spectacleIcon(event) {
    if (event.type === 'concert' || event.type === 'sponsored_event')
        return '🌈';
    if (event.type === 'riot')
        return '🚨';
    if (event.type === 'protest' || event.type === 'strike')
        return '📣';
    return '✨';
}
function metricSeries(points, key, label, color) {
    return {
        key,
        label,
        color,
        values: points.map((point) => ({ tick: point.tick, value: Number(point.metrics[key]) || 0 })),
    };
}
function playerColor(id) {
    const colors = ['#20d39b', '#4cc9f0', '#9b8cff', '#ff66c4', '#ffd166', '#ff8c42', '#66e084', '#7468d8'];
    return colors[Math.abs(hashString(id)) % colors.length] ?? '#4cc9f0';
}
function hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) | 0;
    }
    return hash;
}
function compactNumber(value) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
function compactMoney(value) {
    return `$${compactNumber(value)}`;
}
function shortHandle(handle) {
    return handle.replace(/-\d{14}$/, '').replaceAll('-', ' ');
}
createRoot(document.getElementById('root')).render(_jsx(App, {}));
