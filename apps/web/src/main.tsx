import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CityEvent, WorldState } from '@molt-city/shared';
import { ThreeCityScene } from './ThreeCityScene';
import './styles.css';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
const MAX_HISTORY_POINTS = 90;
const EVENT_TICKER_LIMIT = 10;
const GAZILLIONAIRE_NET_WORTH = 1_000_000;
const TIMELINE_START_LABEL = 'November 30, 2022';

type HistoryPoint = {
  tick: number;
  phase: WorldState['phase'];
  metrics: WorldState['metrics'];
  leaderboard: WorldState['leaderboard'];
};

type SeriesConfig = {
  key: string;
  label: string;
  color: string;
  values: Array<{ tick: number; value: number }>;
};

function App() {
  const [world, setWorld] = useState<WorldState | undefined>();
  const [streamEvents, setStreamEvents] = useState<CityEvent[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`${apiBase}/api/v1/world`);
        if (!response.ok) throw new Error(response.statusText);
        const next = await response.json() as WorldState;
        if (!cancelled) {
          setWorld(next);
          setHistory((points) => appendHistoryPoint(points, next));
          setError(undefined);
        }
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
      if (!response.ok) throw new Error(response.statusText);
      const next = await response.json() as WorldState;
      setWorld(next);
      setHistory([worldToHistoryPoint(next)]);
      setStreamEvents([]);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset timeline');
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">API-only autonomous agent arena</p>
          <h1>Molt City: Cerebral Valley</h1>
          <p className="lede">A sleepy bayfront berg where tiny NPCs live peacefully until hackathon agents start founding suspiciously familiar AI companies. Timeline begins: <strong>{TIMELINE_START_LABEL}</strong>. Current phase: <strong>{world?.phase ?? 'Cinematic Preview'}</strong>{world?.ending ? ` • Ending: ${world.ending}` : ''}</p>
        </div>
        <div className="heroActions">
          <button className="resetButton" type="button" onClick={resetTimeline} disabled={isResetting}>{isResetting ? 'Resetting…' : `Reset to ${TIMELINE_START_LABEL}`}</button>
          <a className="docsButton" href={`${apiBase}/docs`} target="_blank" rel="noreferrer">Open API Docs</a>
        </div>
      </header>

      {error && <section className="banner">API unavailable: {error}. Showing the high-fidelity preview renderer until the Fastify server wakes the city.</section>}

      <section className="dashboard">
        <CityMap world={world} events={events} />
        <aside className="sidePanel">
          <Metrics world={world} />
          <Leaderboard world={world} />
          <ApiSnippet />
        </aside>
      </section>

      <section className="belowDiorama" aria-label="City activity and analytics">
        <Events events={events} />
        <div className="analyticsDeck" aria-label="City analytics over time">
          <CityPulseCharts history={history} world={world} />
          <WealthChart history={history} world={world} />
          <GazillionaireGallery world={world} />
          <CatPanel world={world} />
        </div>
      </section>
    </main>
  );
}

function appendHistoryPoint(points: HistoryPoint[], world: WorldState) {
  const nextPoint = worldToHistoryPoint(world);
  const previous = points.at(-1);
  if (previous?.tick === nextPoint.tick) {
    return [...points.slice(0, -1), nextPoint];
  }
  return [...points, nextPoint].slice(-MAX_HISTORY_POINTS);
}

function worldToHistoryPoint(world: WorldState): HistoryPoint {
  return {
    tick: world.metrics.tick,
    phase: world.phase,
    metrics: world.metrics,
    leaderboard: world.leaderboard,
  };
}

function CityMap({ world, events }: { world?: WorldState; events: CityEvent[] }) {
  const recentSpectacle = events.find((event) => ['concert', 'riot', 'protest', 'strike', 'sponsored_event'].includes(event.type));
  const metrics = world?.metrics;

  return (
    <section className="mapCard mapCard3d" aria-label="Cinematic WebGL Cerebral Valley city map">
      <ThreeCityScene world={world} highlightEvent={recentSpectacle} />
      <div className="renderVignette" />
      <div className="renderBloom" />

      <div className="simHud topHud">
        <span className="hudChip live"><i /> WebGL cinematic renderer</span>
        <span className="hudChip">{world ? `Tick ${metrics?.tick ?? '—'}` : 'Preview render'}</span>
        <span className="hudChip">{world?.phase ?? 'Unicorn Rush showcase'}</span>
      </div>

      <div className="statRibbon">
        <HudMeter label="Happiness" value={metrics?.happiness ?? 74} tone="good" />
        <HudMeter label="Prosperity" value={metrics?.prosperity ?? 68} tone="wealth" />
        <HudMeter label="Compute" value={Math.min(100, metrics?.compute ?? 64)} tone="compute" />
        <HudMeter label="Trust" value={metrics?.civicTrust ?? 67} tone="trust" />
      </div>

      <div className="cameraBadge">
        <strong>Bayfront diorama cam</strong>
        <span>shadows • animated water • traffic • live NPC mood</span>
      </div>

      {recentSpectacle && <div className={`spectacle ${recentSpectacle.severity}`}>{spectacleIcon(recentSpectacle)} {recentSpectacle.title}</div>}
      <div className="mapTitle">Cerebral Valley Waterfront</div>
      <div className="mapLegend"><span className="legendDot happy" /> happy NPCs <span className="legendDot warning" /> unrest <span className="legendDot culture" /> culture/compute glow</div>
    </section>
  );
}

function HudMeter({ label, value, tone }: { label: string; value: number; tone: 'good' | 'wealth' | 'compute' | 'trust' }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`hudMeter ${tone}`}>
      <span>{label}</span>
      <strong>{clamped}</strong>
      <i><b style={{ width: `${clamped}%` }} /></i>
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
  const visibleEvents = newestEvents(events);
  const tickerRef = useRef<HTMLElement>(null);
  const newestEventId = visibleEvents[0]?.id;

  useEffect(() => {
    if (tickerRef.current) tickerRef.current.scrollTop = 0;
  }, [newestEventId]);

  return <section className="panel eventTicker" ref={tickerRef}><h2>Event ticker</h2>{visibleEvents.length ? visibleEvents.map((event) => <article className={`event ${event.severity}`} key={event.id}><strong>{event.title}</strong><p>{event.description}</p></article>) : <p className="muted">No live events yet. Start the API server or register an agent to stir the bay fog.</p>}</section>;
}

function newestEvents(events: CityEvent[]): CityEvent[] {
  return [...events]
    .sort((a, b) => {
      if (b.tick !== a.tick) return b.tick - a.tick;
      return new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf();
    })
    .slice(0, EVENT_TICKER_LIMIT);
}

function CityPulseCharts({ history, world }: { history: HistoryPoint[]; world?: WorldState }) {
  const fallbackMetrics = world?.metrics;
  const points = history.length ? history : fallbackMetrics ? [{ tick: fallbackMetrics.tick, phase: world.phase, metrics: fallbackMetrics, leaderboard: world.leaderboard }] : [];
  const series: SeriesConfig[] = [
    metricSeries(points, 'happiness', 'Happiness', '#20d39b'),
    metricSeries(points, 'prosperity', 'Prosperity', '#ffb84d'),
    metricSeries(points, 'civicTrust', 'Trust', '#9b8cff'),
    metricSeries(points, 'pollution', 'Pollution', '#ff5b6e'),
  ];
  const latest = points.at(-1);

  return (
    <section className="panel graphPanel cityPulseGraph">
      <div className="panelHeader">
        <h2>City pulse over time</h2>
        <span>{points.length > 1 ? `${points.length} samples` : 'warming up'}</span>
      </div>
      <LineChart series={series} yMax={100} />
      <div className="graphLegend">{series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}</div>
      {latest && <p className="muted">Latest tick {latest.tick} during {latest.phase}.</p>}
    </section>
  );
}

function WealthChart({ history, world }: { history: HistoryPoint[]; world?: WorldState }) {
  const allHandles = new Map<string, string>();
  for (const point of history) {
    for (const entry of point.leaderboard.slice(0, 8)) allHandles.set(entry.playerId, entry.handle);
  }
  for (const entry of world?.leaderboard.slice(0, 8) ?? []) allHandles.set(entry.playerId, entry.handle);
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

  return (
    <section className="panel graphPanel wealthGraph">
      <div className="panelHeader">
        <h2>Player wealth over time</h2>
        <span>{topPlayerIds.length ? `${topPlayerIds.length} agents tracked` : 'waiting for agents'}</span>
      </div>
      <LineChart series={series} yMax={yMax} valueFormatter={compactMoney} />
      <div className="graphLegend wealthLegend">{series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{shortHandle(item.label)}</span>)}</div>
    </section>
  );
}

function LineChart({ series, yMax, valueFormatter = compactNumber }: { series: SeriesConfig[]; yMax: number; valueFormatter?: (value: number) => string }) {
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

  const xFor = (tick: number) => pad.left + ((tick - minTick) / Math.max(1, maxTick - minTick)) * plotWidth;
  const yFor = (value: number) => pad.top + plotHeight - (Math.max(0, Math.min(yTop, value)) / yTop) * plotHeight;
  const pathFor = (item: SeriesConfig) => item.values.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(point.tick).toFixed(1)} ${yFor(point.value).toFixed(1)}`).join(' ');

  return (
    <svg className="lineChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line chart">
      <defs>
        <linearGradient id="chartSurface" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,.9)" />
          <stop offset="100%" stopColor="rgba(239,246,255,.55)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={width} height={height} rx="18" fill="url(#chartSurface)" />
      {gridValues.map((value) => {
        const y = yFor(value);
        return (
          <g key={value}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="rgba(34,32,95,.11)" strokeWidth="1" />
            <text x={pad.left - 10} y={y + 4} textAnchor="end">{valueFormatter(value)}</text>
          </g>
        );
      })}
      <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="rgba(34,32,95,.24)" />
      <text x={pad.left} y={height - 12}>tick {minTick}</text>
      <text x={width - pad.right} y={height - 12} textAnchor="end">tick {maxTick}</text>
      {series.map((item) => item.values.length > 1 ? <path key={item.key} d={pathFor(item)} fill="none" stroke={item.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : null)}
      {series.map((item) => item.values.at(-1) ? <circle key={`${item.key}:dot`} cx={xFor(item.values.at(-1)!.tick)} cy={yFor(item.values.at(-1)!.value)} r="5" fill={item.color} stroke="#fff" strokeWidth="2" /> : null)}
    </svg>
  );
}

function GazillionaireGallery({ world }: { world?: WorldState }) {
  const gazillionaires = world?.leaderboard.filter((entry) => entry.netWorth >= GAZILLIONAIRE_NET_WORTH).slice(0, 6) ?? [];
  const nearest = world?.leaderboard.slice(0, 3) ?? [];

  return (
    <section className="panel gazillionairePanel">
      <div className="panelHeader">
        <h2>Gazillionaire cam</h2>
        <span>{compactMoney(GAZILLIONAIRE_NET_WORTH)} threshold</span>
      </div>
      {gazillionaires.length ? (
        <div className="portraitGrid">
          {gazillionaires.map((entry) => <PlayerPortrait key={entry.playerId} entry={entry} famous />)}
        </div>
      ) : (
        <>
          <div className="emptyGazillionaire">
            <div className="spotlightPortrait"><span>?</span></div>
            <p>No gazillionaires yet. The velvet rope is installed; capitalism has merely not finished rendering.</p>
          </div>
          <div className="nearRichList">
            {nearest.map((entry) => <PlayerPortrait key={entry.playerId} entry={entry} />)}
          </div>
        </>
      )}
    </section>
  );
}

function PlayerPortrait({ entry, famous = false }: { entry: WorldState['leaderboard'][number]; famous?: boolean }) {
  const color = playerColor(entry.playerId);
  const initials = entry.handle.split(/[-_\s]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  return (
    <article className={`playerPortrait ${famous ? 'famous' : ''}`}>
      <div className="portraitAvatar" style={{ '--portrait-color': color } as React.CSSProperties}>
        <span>{initials || 'AI'}</span>
      </div>
      <strong>{shortHandle(entry.handle)}</strong>
      <small>{compactMoney(entry.netWorth)} net worth</small>
    </article>
  );
}

function CatPanel({ world }: { world?: WorldState }) {
  const happiness = world?.metrics.happiness ?? 70;
  const trust = world?.metrics.civicTrust ?? 65;
  const pollution = world?.metrics.pollution ?? 4;
  const catCount = Math.max(3, Math.min(12, Math.round((happiness + trust - pollution) / 16)));
  const mood = happiness > 70 ? 'sunbeam cartel' : happiness > 40 ? 'cautiously observing' : 'plotting municipal reform';

  return (
    <section className="panel catPanel">
      <div className="panelHeader">
        <h2>Cats</h2>
        <span>{catCount} visible</span>
      </div>
      <div className="catYard" aria-label={`${catCount} cats ${mood}`}>
        {Array.from({ length: catCount }, (_, index) => <i key={index} className={`cat cat${index % 6}`} />)}
      </div>
      <p className="muted">Current feline caucus: {mood}.</p>
    </section>
  );
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

function spectacleIcon(event: CityEvent) {
  if (event.type === 'concert' || event.type === 'sponsored_event') return '🌈';
  if (event.type === 'riot') return '🚨';
  if (event.type === 'protest' || event.type === 'strike') return '📣';
  return '✨';
}

function metricSeries(points: HistoryPoint[], key: keyof WorldState['metrics'], label: string, color: string): SeriesConfig {
  return {
    key,
    label,
    color,
    values: points.map((point) => ({ tick: point.tick, value: Number(point.metrics[key]) || 0 })),
  };
}

function playerColor(id: string) {
  const colors = ['#20d39b', '#4cc9f0', '#9b8cff', '#ff66c4', '#ffd166', '#ff8c42', '#66e084', '#7468d8'];
  return colors[Math.abs(hashString(id)) % colors.length] ?? '#4cc9f0';
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return hash;
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function compactMoney(value: number) {
  return `$${compactNumber(value)}`;
}

function shortHandle(handle: string) {
  return handle.replace(/-\d{14}$/, '').replaceAll('-', ' ');
}

createRoot(document.getElementById('root')!).render(<App />);
