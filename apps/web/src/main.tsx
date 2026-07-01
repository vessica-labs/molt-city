import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Building, CityEvent, Coordinates, Lot, Npc, WorldState } from '@molt-city/shared';
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
  const buildingsByLot = useMemo(() => new Map((world?.buildings ?? []).map((building) => [building.lotId, building])), [world]);
  const lots = useMemo(() => [...(world?.lots ?? [])].sort((a, b) => depthFor(a.coordinates) - depthFor(b.coordinates)), [world]);
  const npcs = world?.npcs ?? [];
  const recentSpectacle = world?.events.find((event) => ['concert', 'riot', 'protest', 'strike'].includes(event.type));

  return (
    <section className="mapCard" aria-label="Isometric Cerebral Valley city map">
      <div className="skyGlow" />
      <div className="sun"><span /></div>
      <div className="bayIso">
        <div className="bayLabel">Bay of Prompts</div>
        <div className="ferry ferryOne">⛴</div>
        <div className="ferry ferryTwo">⛵</div>
        <div className="sparkleWave waveOne" />
        <div className="sparkleWave waveTwo" />
      </div>
      <div className="cloud cloudOne" />
      <div className="cloud cloudTwo" />
      <div className="bird flockOne">⌁⌁</div>
      <div className="isoWorld">
        <div className="terrainShadow" />
        <div className="isoRoad mainRoad"><span /></div>
        <div className="isoRoad crossRoad"><span /></div>
        <div className="isoRoad waterfrontRoad"><span /></div>
        <div className="districtBadge badgeNorth">Garage Hills</div>
        <div className="districtBadge badgeBay">Bayfront</div>
        {lots.map((lot) => <LotTile key={lot.id} lot={lot} building={buildingsByLot.get(lot.id)} />)}
        {npcs.map((npc) => <NpcDot key={npc.id} npc={npc} />)}
      </div>
      {recentSpectacle && <div className={`spectacle ${recentSpectacle.severity}`}>{spectacleIcon(recentSpectacle)} {recentSpectacle.title}</div>}
      <div className="mapTitle">Cerebral Valley Waterfront</div>
      <div className="mapLegend"><span className="legendDot happy" /> happy NPCs <span className="legendDot warning" /> unrest <span className="legendDot culture" /> culture</div>
    </section>
  );
}

function LotTile({ lot, building }: { lot: Lot; building?: Building }) {
  const iso = isoPosition(lot.coordinates);
  const height = building ? Math.min(118, 32 + building.level * 10 + building.jobs * 1.15 + building.compute * 1.8) : 0;
  const label = building?.name ?? lot.district;
  const lotStyle = {
    left: `${iso.x}%`,
    top: `${iso.y}%`,
    zIndex: 20 + Math.round(iso.depth * 2),
    '--tile-scale': String(0.92 + lot.size * 0.08),
  } as React.CSSProperties;

  return (
    <div className={`lot isoLot ${lot.zone} size${lot.size} ${building ? 'built' : 'empty'}`} style={lotStyle} title={`${lot.name} • ${lot.zone}${building ? ` • ${building.name}` : ''}`}>
      <div className="lotGround">
        <div className="lotTop" />
        <div className="lotSide lotSideLeft" />
        <div className="lotSide lotSideRight" />
      </div>
      <LotDecor lot={lot} building={building} />
      {building ? <IsoBuilding building={building} height={height} /> : <EmptyLot zone={lot.zone} />}
      <small>{label}</small>
    </div>
  );
}

function LotDecor({ lot, building }: { lot: Lot; building?: Building }) {
  if (building?.type === 'pony_meadow' || lot.zone === 'park') {
    return <><i className="tree treeA" /><i className="tree treeB" /><i className="flowerPatch">✿</i></>;
  }
  if (building?.type === 'transit_kiosk') return <i className="tinyTrain">▰▰</i>;
  if (lot.zone === 'industrial') return <i className="pipeDecor" />;
  if (lot.zone === 'civic') return <i className="flagDecor">⚑</i>;
  return null;
}

function EmptyLot({ zone }: { zone: Lot['zone'] }) {
  return (
    <div className={`emptyLotIso ${zone}`}>
      <span className="forSaleSign">API<br />LOT</span>
    </div>
  );
}

function IsoBuilding({ building, height }: { building: Building; height: number }) {
  const floors = Math.max(2, Math.min(8, Math.round(height / 18)));
  const style = { '--h': `${height}px`, '--floors': floors } as React.CSSProperties;
  const windows = Array.from({ length: floors * 2 }, (_, index) => <b key={index} />);

  return (
    <div className={`isoBuilding ${building.type}`} style={style}>
      <div className="buildingShadow" />
      <div className="wall wallLeft"><div className="windowGrid">{windows}</div></div>
      <div className="wall wallRight"><div className="windowGrid">{windows}</div></div>
      <div className="roof"><span>{iconFor(building.type)}</span></div>
      <BuildingFlair type={building.type} />
    </div>
  );
}

function BuildingFlair({ type }: { type: Building['type'] }) {
  if (type === 'data_center_greenhouse' || type === 'model_foundry' || type === 'research_lab') return <><i className="antenna" /><i className="computeGlow" /></>;
  if (type === 'coffee_shop') return <><i className="awning" /><i className="steam steamA" /><i className="steam steamB" /></>;
  if (type === 'concert_shell') return <><i className="musicNote noteA">♪</i><i className="musicNote noteB">♫</i></>;
  if (type === 'pony_meadow') return <i className="ponySprite">🦄</i>;
  if (type === 'mixed_use_tower') return <i className="skySign">MOLT</i>;
  if (type === 'civic_hall') return <i className="civicDome" />;
  return null;
}

function NpcDot({ npc }: { npc: Npc }) {
  const iso = isoPosition(npc.position, npc.activity === 'concert' ? 2 : 0);
  const style = { left: `${iso.x}%`, top: `${iso.y}%`, zIndex: 200 + Math.round(iso.depth * 2) } as React.CSSProperties;
  return (
    <div className={`npc ${npc.mood} ${npc.activity}`} style={style} title={`${npc.name}: ${npc.activity} • ${Math.round(npc.happiness)} happiness`}>
      <span />
      <em>{activityIcon(npc)}</em>
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

function isoPosition(point: Coordinates, lift = 0) {
  const col = (point.x - 8) / 14;
  const row = (point.y - 18) / 18;
  return {
    x: 50 + (col - row) * 8.7,
    y: 16 + (col + row) * 7.15 - lift,
    depth: col + row,
  };
}

function depthFor(point: Coordinates) {
  const col = (point.x - 8) / 14;
  const row = (point.y - 18) / 18;
  return col + row;
}

function activityIcon(npc: Npc) {
  if (npc.activity === 'concert') return '♪';
  if (npc.activity === 'protesting' || npc.activity === 'striking') return '!';
  if (npc.activity === 'shopping') return '$';
  if (npc.activity === 'working') return '•';
  return '';
}

function spectacleIcon(event: CityEvent) {
  if (event.type === 'concert') return '🌈';
  if (event.type === 'riot') return '🚨';
  if (event.type === 'protest' || event.type === 'strike') return '📣';
  return '✨';
}

function iconFor(type: Building['type']) {
  if (type.includes('pony')) return '🦄';
  if (type.includes('coffee')) return '☕';
  if (type.includes('data') || type.includes('model')) return '▣';
  if (type.includes('concert')) return '♪';
  if (type.includes('civic')) return '⚖';
  if (type.includes('transit')) return '🚋';
  if (type.includes('tower')) return '◆';
  if (type.includes('lab')) return '✦';
  return '⌂';
}

createRoot(document.getElementById('root')!).render(<App />);
