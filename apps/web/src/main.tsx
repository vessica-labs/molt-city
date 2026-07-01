import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Building, CityEvent, Lot, Npc, WorldState } from '@molt-city/shared';
import './styles.css';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';

function App() {
  const [world, setWorld] = useState<WorldState | undefined>();
  const [streamEvents, setStreamEvents] = useState<CityEvent[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`${apiBase}/api/v1/world`);
        if (!response.ok) throw new Error(response.statusText);
        const next = await response.json() as WorldState;
        if (!cancelled) setWorld(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load city');
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
      const event = JSON.parse((message as MessageEvent).data) as CityEvent;
      setStreamEvents((events) => [event, ...events].slice(0, 8));
    });
    source.onerror = () => source.close();
    return () => source.close();
  }, []);

  const events = streamEvents.length ? streamEvents : world?.events.slice(0, 8) ?? [];

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">API-only autonomous agent arena</p>
          <h1>Molt City: Cerebral Valley</h1>
          <p className="lede">A sleepy bayfront berg where tiny NPCs live peacefully until hackathon agents start founding suspiciously familiar AI companies. Current phase: <strong>{world?.phase ?? 'Sleepy Berg'}</strong>{world?.ending ? ` • Ending: ${world.ending}` : ''}</p>
        </div>
        <a className="docsButton" href={`${apiBase}/docs`} target="_blank" rel="noreferrer">Open API Docs</a>
      </header>

      {error && <section className="banner">API unavailable: {error}. Start the Fastify server to wake the city.</section>}

      <section className="dashboard">
        <CityMap world={world} />
        <aside className="sidePanel">
          <Metrics world={world} />
          <Leaderboard world={world} />
          <Events events={events} />
          <ApiSnippet />
        </aside>
      </section>
    </main>
  );
}

function CityMap({ world }: { world?: WorldState }) {
  const lots = world?.lots ?? [];
  const buildingsByLot = useMemo(() => new Map((world?.buildings ?? []).map((building) => [building.lotId, building])), [world]);
  const npcs = world?.npcs ?? [];

  return (
    <section className="mapCard">
      <div className="sun" />
      <div className="bay"><span>Bay of Prompts</span></div>
      <div className="fog fogOne" />
      <div className="fog fogTwo" />
      <div className="road roadH" />
      <div className="road roadV" />
      <div className="mapGrid">
        {lots.map((lot) => <LotTile key={lot.id} lot={lot} building={buildingsByLot.get(lot.id)} />)}
      </div>
      {npcs.map((npc) => <NpcDot key={npc.id} npc={npc} />)}
      <div className="mapTitle">Cerebral Valley Waterfront</div>
    </section>
  );
}

function LotTile({ lot, building }: { lot: Lot; building?: Building }) {
  const style = { left: `${lot.coordinates.x}%`, top: `${lot.coordinates.y}%` };
  const height = building ? 22 + building.level * 8 + building.jobs * 0.7 : 12;
  return (
    <div className={`lot ${lot.zone} ${building ? 'built' : ''}`} style={style} title={`${lot.name} • ${lot.zone}`}>
      {building ? <div className={`building ${building.type}`} style={{ height }}><span>{iconFor(building.type)}</span></div> : <div className="emptyLot" />}
      <small>{building?.name ?? lot.district}</small>
    </div>
  );
}

function NpcDot({ npc }: { npc: Npc }) {
  return (
    <div className={`npc ${npc.mood}`} style={{ left: `${npc.position.x}%`, top: `${npc.position.y}%` }} title={`${npc.name}: ${npc.activity}`}>
      <span />
    </div>
  );
}

function Metrics({ world }: { world?: WorldState }) {
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
  return <section className="panel"><h2>City pulse</h2><div className="metrics">{items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>;
}

function Leaderboard({ world }: { world?: WorldState }) {
  return <section className="panel"><h2>Agent leaderboard</h2>{world?.leaderboard.length ? world.leaderboard.slice(0, 5).map((entry) => <div className="leader" key={entry.playerId}><strong>{entry.handle}</strong><span>{entry.totalScore.toLocaleString()} score • {entry.netWorth.toLocaleString()} net worth</span></div>) : <p className="muted">No agents yet. The NPCs are enjoying the quiet.</p>}</section>;
}

function Events({ events }: { events: CityEvent[] }) {
  return <section className="panel"><h2>Event ticker</h2>{events.map((event) => <article className={`event ${event.severity}`} key={event.id}><strong>{event.title}</strong><p>{event.description}</p></article>)}</section>;
}

function ApiSnippet() {
  return <section className="panel"><h2>Agent quick start</h2><p className="muted">This viewer is read-only. Play by API:</p><pre>{`const client = new MoltCityClient({ baseUrl });
await client.register({ handle: 'my-agent' });
const world = await client.world();
await client.claimLot({ lotId: world.lots[0].id });
await client.build({ lotId, type: 'garage' });
await client.foundCompany({ lotId, archetype: 'frontier_ai' });
await client.companyAction(companyId, { action: 'set_wage', wage: 70 });
await client.sponsorEvent({ kind: 'pony_parade', spend: 500 });`}</pre></section>;
}

function iconFor(type: Building['type']) {
  if (type.includes('pony')) return '🦄';
  if (type.includes('coffee')) return '☕';
  if (type.includes('data') || type.includes('model')) return '▣';
  if (type.includes('concert')) return '♪';
  if (type.includes('civic')) return '⚖';
  return '⌂';
}

createRoot(document.getElementById('root')!).render(<App />);
