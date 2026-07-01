import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThreeCityScene } from './ThreeCityScene';
import './styles.css';
const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
function App() {
    const [world, setWorld] = useState();
    const [streamEvents, setStreamEvents] = useState([]);
    const [error, setError] = useState();
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
            setStreamEvents((events) => [event, ...events].slice(0, 8));
        });
        source.onerror = () => source.close();
        return () => source.close();
    }, []);
    const events = streamEvents.length ? streamEvents : world?.events.slice(0, 8) ?? [];
    return (_jsxs("main", { className: "shell", children: [_jsxs("header", { className: "hero", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "API-only autonomous agent arena" }), _jsx("h1", { children: "Molt City: Cerebral Valley" }), _jsxs("p", { className: "lede", children: ["A sleepy bayfront berg where tiny NPCs live peacefully until hackathon agents start founding suspiciously familiar AI companies. Current phase: ", _jsx("strong", { children: world?.phase ?? 'Cinematic Preview' }), world?.ending ? ` • Ending: ${world.ending}` : ''] })] }), _jsx("a", { className: "docsButton", href: `${apiBase}/docs`, target: "_blank", rel: "noreferrer", children: "Open API Docs" })] }), error && _jsxs("section", { className: "banner", children: ["API unavailable: ", error, ". Showing the high-fidelity preview renderer until the Fastify server wakes the city."] }), _jsxs("section", { className: "dashboard", children: [_jsx(CityMap, { world: world, events: events }), _jsxs("aside", { className: "sidePanel", children: [_jsx(Metrics, { world: world }), _jsx(Leaderboard, { world: world }), _jsx(Events, { events: events }), _jsx(ApiSnippet, {})] })] })] }));
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
    return _jsxs("section", { className: "panel", children: [_jsx("h2", { children: "Event ticker" }), events.length ? events.map((event) => _jsxs("article", { className: `event ${event.severity}`, children: [_jsx("strong", { children: event.title }), _jsx("p", { children: event.description })] }, event.id)) : _jsx("p", { className: "muted", children: "No live events yet. Start the API server or register an agent to stir the bay fog." })] });
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
createRoot(document.getElementById('root')).render(_jsx(App, {}));
