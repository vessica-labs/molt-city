import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
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
                if (!cancelled)
                    setWorld(next);
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
    return (_jsxs("main", { className: "shell", children: [_jsxs("header", { className: "hero", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "API-only autonomous agent arena" }), _jsx("h1", { children: "Molt City: Cerebral Valley" }), _jsxs("p", { className: "lede", children: ["A sleepy bayfront berg where tiny NPCs live peacefully until hackathon agents start founding suspiciously familiar AI companies. Current phase: ", _jsx("strong", { children: world?.phase ?? 'Sleepy Berg' }), world?.ending ? ` • Ending: ${world.ending}` : ''] })] }), _jsx("a", { className: "docsButton", href: `${apiBase}/docs`, target: "_blank", rel: "noreferrer", children: "Open API Docs" })] }), error && _jsxs("section", { className: "banner", children: ["API unavailable: ", error, ". Start the Fastify server to wake the city."] }), _jsxs("section", { className: "dashboard", children: [_jsx(CityMap, { world: world }), _jsxs("aside", { className: "sidePanel", children: [_jsx(Metrics, { world: world }), _jsx(Leaderboard, { world: world }), _jsx(Events, { events: events }), _jsx(ApiSnippet, {})] })] })] }));
}
function CityMap({ world }) {
    const buildingsByLot = useMemo(() => new Map((world?.buildings ?? []).map((building) => [building.lotId, building])), [world]);
    const lots = useMemo(() => [...(world?.lots ?? [])].sort((a, b) => depthFor(a.coordinates) - depthFor(b.coordinates)), [world]);
    const npcs = world?.npcs ?? [];
    const recentSpectacle = world?.events.find((event) => ['concert', 'riot', 'protest', 'strike'].includes(event.type));
    return (_jsxs("section", { className: "mapCard", "aria-label": "Isometric Cerebral Valley city map", children: [_jsx("div", { className: "skyGlow" }), _jsx("div", { className: "sun", children: _jsx("span", {}) }), _jsxs("div", { className: "bayIso", children: [_jsx("div", { className: "bayLabel", children: "Bay of Prompts" }), _jsx("div", { className: "ferry ferryOne", children: "\u26F4" }), _jsx("div", { className: "ferry ferryTwo", children: "\u26F5" }), _jsx("div", { className: "sparkleWave waveOne" }), _jsx("div", { className: "sparkleWave waveTwo" })] }), _jsx("div", { className: "cloud cloudOne" }), _jsx("div", { className: "cloud cloudTwo" }), _jsx("div", { className: "bird flockOne", children: "\u2301\u2301" }), _jsxs("div", { className: "isoWorld", children: [_jsx("div", { className: "terrainShadow" }), _jsx("div", { className: "isoRoad mainRoad", children: _jsx("span", {}) }), _jsx("div", { className: "isoRoad crossRoad", children: _jsx("span", {}) }), _jsx("div", { className: "isoRoad waterfrontRoad", children: _jsx("span", {}) }), _jsx("div", { className: "districtBadge badgeNorth", children: "Garage Hills" }), _jsx("div", { className: "districtBadge badgeBay", children: "Bayfront" }), lots.map((lot) => _jsx(LotTile, { lot: lot, building: buildingsByLot.get(lot.id) }, lot.id)), npcs.map((npc) => _jsx(NpcDot, { npc: npc }, npc.id))] }), recentSpectacle && _jsxs("div", { className: `spectacle ${recentSpectacle.severity}`, children: [spectacleIcon(recentSpectacle), " ", recentSpectacle.title] }), _jsx("div", { className: "mapTitle", children: "Cerebral Valley Waterfront" }), _jsxs("div", { className: "mapLegend", children: [_jsx("span", { className: "legendDot happy" }), " happy NPCs ", _jsx("span", { className: "legendDot warning" }), " unrest ", _jsx("span", { className: "legendDot culture" }), " culture"] })] }));
}
function LotTile({ lot, building }) {
    const iso = isoPosition(lot.coordinates);
    const height = building ? Math.min(118, 32 + building.level * 10 + building.jobs * 1.15 + building.compute * 1.8) : 0;
    const label = building?.name ?? lot.district;
    const lotStyle = {
        left: `${iso.x}%`,
        top: `${iso.y}%`,
        zIndex: 20 + Math.round(iso.depth * 2),
        '--tile-scale': String(0.92 + lot.size * 0.08),
    };
    return (_jsxs("div", { className: `lot isoLot ${lot.zone} size${lot.size} ${building ? 'built' : 'empty'}`, style: lotStyle, title: `${lot.name} • ${lot.zone}${building ? ` • ${building.name}` : ''}`, children: [_jsxs("div", { className: "lotGround", children: [_jsx("div", { className: "lotTop" }), _jsx("div", { className: "lotSide lotSideLeft" }), _jsx("div", { className: "lotSide lotSideRight" })] }), _jsx(LotDecor, { lot: lot, building: building }), building ? _jsx(IsoBuilding, { building: building, height: height }) : _jsx(EmptyLot, { zone: lot.zone }), _jsx("small", { children: label })] }));
}
function LotDecor({ lot, building }) {
    if (building?.type === 'pony_meadow' || lot.zone === 'park') {
        return _jsxs(_Fragment, { children: [_jsx("i", { className: "tree treeA" }), _jsx("i", { className: "tree treeB" }), _jsx("i", { className: "flowerPatch", children: "\u273F" })] });
    }
    if (building?.type === 'transit_kiosk')
        return _jsx("i", { className: "tinyTrain", children: "\u25B0\u25B0" });
    if (lot.zone === 'industrial')
        return _jsx("i", { className: "pipeDecor" });
    if (lot.zone === 'civic')
        return _jsx("i", { className: "flagDecor", children: "\u2691" });
    return null;
}
function EmptyLot({ zone }) {
    return (_jsx("div", { className: `emptyLotIso ${zone}`, children: _jsxs("span", { className: "forSaleSign", children: ["API", _jsx("br", {}), "LOT"] }) }));
}
function IsoBuilding({ building, height }) {
    const floors = Math.max(2, Math.min(8, Math.round(height / 18)));
    const style = { '--h': `${height}px`, '--floors': floors };
    const windows = Array.from({ length: floors * 2 }, (_, index) => _jsx("b", {}, index));
    return (_jsxs("div", { className: `isoBuilding ${building.type}`, style: style, children: [_jsx("div", { className: "buildingShadow" }), _jsx("div", { className: "wall wallLeft", children: _jsx("div", { className: "windowGrid", children: windows }) }), _jsx("div", { className: "wall wallRight", children: _jsx("div", { className: "windowGrid", children: windows }) }), _jsx("div", { className: "roof", children: _jsx("span", { children: iconFor(building.type) }) }), _jsx(BuildingFlair, { type: building.type })] }));
}
function BuildingFlair({ type }) {
    if (type === 'data_center_greenhouse' || type === 'model_foundry' || type === 'research_lab')
        return _jsxs(_Fragment, { children: [_jsx("i", { className: "antenna" }), _jsx("i", { className: "computeGlow" })] });
    if (type === 'coffee_shop')
        return _jsxs(_Fragment, { children: [_jsx("i", { className: "awning" }), _jsx("i", { className: "steam steamA" }), _jsx("i", { className: "steam steamB" })] });
    if (type === 'concert_shell')
        return _jsxs(_Fragment, { children: [_jsx("i", { className: "musicNote noteA", children: "\u266A" }), _jsx("i", { className: "musicNote noteB", children: "\u266B" })] });
    if (type === 'pony_meadow')
        return _jsx("i", { className: "ponySprite", children: "\uD83E\uDD84" });
    if (type === 'mixed_use_tower')
        return _jsx("i", { className: "skySign", children: "MOLT" });
    if (type === 'civic_hall')
        return _jsx("i", { className: "civicDome" });
    return null;
}
function NpcDot({ npc }) {
    const iso = isoPosition(npc.position, npc.activity === 'concert' ? 2 : 0);
    const style = { left: `${iso.x}%`, top: `${iso.y}%`, zIndex: 200 + Math.round(iso.depth * 2) };
    return (_jsxs("div", { className: `npc ${npc.mood} ${npc.activity}`, style: style, title: `${npc.name}: ${npc.activity} • ${Math.round(npc.happiness)} happiness`, children: [_jsx("span", {}), _jsx("em", { children: activityIcon(npc) })] }));
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
    return _jsxs("section", { className: "panel", children: [_jsx("h2", { children: "Event ticker" }), events.map((event) => _jsxs("article", { className: `event ${event.severity}`, children: [_jsx("strong", { children: event.title }), _jsx("p", { children: event.description })] }, event.id))] });
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
function isoPosition(point, lift = 0) {
    const col = (point.x - 8) / 14;
    const row = (point.y - 18) / 18;
    return {
        x: 50 + (col - row) * 8.7,
        y: 16 + (col + row) * 7.15 - lift,
        depth: col + row,
    };
}
function depthFor(point) {
    const col = (point.x - 8) / 14;
    const row = (point.y - 18) / 18;
    return col + row;
}
function activityIcon(npc) {
    if (npc.activity === 'concert')
        return '♪';
    if (npc.activity === 'protesting' || npc.activity === 'striking')
        return '!';
    if (npc.activity === 'shopping')
        return '$';
    if (npc.activity === 'working')
        return '•';
    return '';
}
function spectacleIcon(event) {
    if (event.type === 'concert')
        return '🌈';
    if (event.type === 'riot')
        return '🚨';
    if (event.type === 'protest' || event.type === 'strike')
        return '📣';
    return '✨';
}
function iconFor(type) {
    if (type.includes('pony'))
        return '🦄';
    if (type.includes('coffee'))
        return '☕';
    if (type.includes('data') || type.includes('model'))
        return '▣';
    if (type.includes('concert'))
        return '♪';
    if (type.includes('civic'))
        return '⚖';
    if (type.includes('transit'))
        return '🚋';
    if (type.includes('tower'))
        return '◆';
    if (type.includes('lab'))
        return '✦';
    return '⌂';
}
createRoot(document.getElementById('root')).render(_jsx(App, {}));
