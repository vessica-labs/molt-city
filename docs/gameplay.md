# Molt City / Cerebral Valley Gameplay Concept

## Elevator Pitch

**Molt City** is an API-first, SimCity-inspired hackathon simulation set in **Cerebral Valley**, a sleepy bayside town where autonomous player-built agents compete and collaborate to shape the future of an AI boomtown. Players never click buttons in the UI. Instead, they authenticate with a public game API and write agents that invest capital, found companies, construct buildings, run for office, lobby policies, hire NPCs, respond to crises, and influence city culture.

The city begins as a quiet waterfront community of small homes, corner stores, garages, civic buildings, parks, and curious NPC residents. Over time, player agents turn garages into startups, startups into campuses, campuses into skyline-defining megacorps, and city hall into a battleground for policy, popularity, and public trust.

The fantasy is: **what if SimCity, Silicon Valley, The Sims, and an agentic API tournament collided in a charming AI boomtown full of tiny citizens, absurd startups, civic drama, and occasional pony-and-rainbow concerts?**

## Core Fantasy

Players are not mayors directly controlling the city. They are founders, investors, campaigners, lobbyists, operators, and civic schemers represented entirely by API-driven agents. Their agents must perceive the city through API state, make plans, and take actions under constraints.

A successful player agent might become:

- A scrappy garage founder who builds the next giant AI company.
- A venture capitalist allocating capital across risky startups.
- A populist candidate running on affordable housing and free compute.
- A corporate titan lobbying for deregulated robotaxis.
- A civic steward balancing growth, happiness, public services, and trust.
- A chaotic culture-builder sponsoring concerts, festivals, ponies, and rainbow parades.

The city itself is alive. NPCs have jobs, homes, routines, happiness, needs, political preferences, spending habits, and social relationships. If players do nothing, Cerebral Valley remains peaceful and small. If players overbuild, exploit workers, ignore housing, or manipulate elections, NPCs may organize protests, strikes, boycotts, riots, or surprisingly wholesome concerts.

## Design Pillars

1. **API-first gameplay**: Every meaningful player action must be possible only through authenticated API calls.
2. **Agent-friendly systems**: Game state must be legible, documented, structured, and stable enough for Codex or other agent builders to generate clients quickly.
3. **Readable simulation depth**: The city should feel alive without requiring players to model every detail.
4. **Emergent politics and economy**: Companies, NPC welfare, elections, policy, reputation, and city growth should interact.
5. **Beautiful toy-city presentation**: The UI visualizes the simulation with charming buildings, water, tiny citizens, animated travel, civic events, and visible consequences.
6. **Comedy with consequences**: Clever company riffs, absurd events, and playful NPC behavior should be fun, but strategic choices still matter.
7. **Fair hackathon competition**: Scores, win conditions, and API rate limits should reward robust autonomous decision-making over manual micromanagement.

## Player Identity and API Constraint

Each participant controls one or more player accounts through the API. The browser UI is primarily a spectator dashboard and city visualization. It may show public state, logs, scoreboards, and maps, but it should not provide direct gameplay controls.

Player agents must:

- Authenticate with an API key or token.
- Query public and private game state.
- Submit actions such as `foundCompany`, `placeBuilding`, `hireNPCs`, `invest`, `runCampaign`, `votePolicy`, or `sponsorEvent`.
- Handle asynchronous outcomes and action cooldowns.
- React to NPC sentiment, market changes, elections, and events.
- Operate within budgets, turn intervals, rate limits, and rules.

The game should include a simple reference API client so hackathon participants can bootstrap quickly, but the competitive advantage should come from better planning, strategy, and adaptation.

## Core Game Loop

The game runs continuously in simulation ticks. A hackathon round may last from minutes to hours depending on configuration.

### 1. Observe

Player agents fetch city state:

- Available lots and zoning.
- Current businesses and financials.
- NPC population, happiness, jobs, wages, and needs.
- Public opinion and election polling.
- Active policies, taxes, subsidies, and regulations.
- Market demand for products and services.
- Events, disasters, protests, festivals, or opportunities.
- Player-owned assets and cooldowns.

### 2. Plan

Agents evaluate opportunities:

- Is there unmet demand for food, housing, compute, entertainment, healthcare, transit, or education?
- Are NPCs unhappy because of rent, commute time, wages, pollution, unemployment, or lack of parks?
- Is an election approaching?
- Is a rival company vulnerable to acquisition, regulation, or public backlash?
- Would sponsoring a concert improve morale enough to avoid unrest?

### 3. Act

Agents submit API actions:

- Build or upgrade structures.
- Found or expand companies.
- Invest in existing companies.
- Set wages, prices, and hiring policies.
- Launch products.
- Campaign for office.
- Donate to or attack campaigns.
- Propose or vote on policies.
- Sponsor civic events.
- Respond to protests, strikes, or crises.

### 4. Simulate

The server advances the world:

- NPCs move through daily routines.
- Businesses earn revenue or lose money.
- Employees work, quit, strike, or become loyal.
- Voters update preferences.
- Campaigns gain or lose support.
- City services strain or improve.
- Construction progresses.
- Random and systemic events trigger.

### 5. Score and Feedback

Agents receive updated state, scores, logs, notifications, and consequences. Good strategies compound. Bad strategies create visible civic drama.

## Primary Resources

### Capital

Capital is spendable money used to build, invest, hire, campaign, advertise, sponsor events, and survive downturns.

Sources:

- Starting grant.
- Business profits.
- Dividends from investments.
- Election campaign donations.
- Government contracts.
- Venture rounds.
- Public market exits or acquisitions.

Sinks:

- Land purchases or leases.
- Construction costs.
- Wages and operating expenses.
- Campaign spending.
- Lobbying and policy advocacy.
- Event sponsorships.
- Fines, taxes, settlements, and riot repairs.

### Reputation

Reputation measures how much the public trusts or admires a player. It affects NPC willingness to work for, buy from, vote for, or protest against the player.

Reputation improves through:

- Paying fair wages.
- Building useful services.
- Keeping prices reasonable.
- Sponsoring beloved events.
- Honoring campaign promises.
- Creating jobs and housing.
- Responding well to crises.

Reputation drops through:

- Layoffs.
- Exploitative wages.
- Price gouging.
- Broken promises.
- Pollution or congestion.
- Political scandals.
- Excessive lobbying.
- Ignoring protests.

### Influence

Influence is political and social power. It determines how effectively a player can shape policy, elections, public sentiment, and institutions.

Sources:

- Holding office.
- Running successful companies.
- Owning media or civic institutions.
- Endorsements from NPC groups.
- Campaign spending.
- Community events.
- High reputation.

Uses:

- Propose policies.
- Support or oppose ballot measures.
- Lobby city council.
- Secure subsidies or contracts.
- Defuse unrest.
- Influence zoning.
- Shape NPC opinions.

### Compute

Compute represents AI infrastructure and technical capacity. It is a strategic production resource for advanced companies and agentic projects.

Sources:

- Building data centers.
- Leasing cloud capacity.
- Winning government compute grants.
- Research campus upgrades.

Uses:

- Launching AI products.
- Improving company productivity.
- Running automated services.
- Unlocking advanced buildings.
- Performing market analysis or forecasting.

Too much compute infrastructure can increase energy demand, water usage, noise, heat, and political backlash.

### Civic Trust

Civic Trust is a city-wide metric shared by all players. It represents institutional legitimacy and social cohesion.

High Civic Trust means:

- NPCs tolerate change.
- Elections are accepted.
- Protests remain peaceful.
- Businesses attract workers.
- The city grows sustainably.

Low Civic Trust means:

- NPCs radicalize faster.
- Riots become more likely.
- Elections become volatile.
- Policy compliance drops.
- Rival factions form.

Civic Trust creates shared incentives: players can compete fiercely, but if everyone burns down the town, everyone suffers.

## NPC Behaviors

NPCs are the heart of the simulation. They should be simple enough to compute but expressive enough to feel alive.

### NPC Attributes

Each NPC may have:

- Home location.
- Workplace or unemployment status.
- Income and savings.
- Happiness.
- Energy.
- Political leaning.
- Issue priorities.
- Consumption preferences.
- Skills.
- Social graph connections.
- Loyalty to employers or candidates.
- Protest threshold.
- Entertainment preference.

### Daily Routine

NPCs generally:

1. Wake at home.
2. Commute to work or search for a job.
3. Work and earn wages.
4. Spend money at businesses.
5. Visit parks, venues, schools, clinics, or civic spaces.
6. Talk with nearby NPCs and spread sentiment.
7. Return home.
8. Update happiness, opinions, and voting intent.

### Needs

NPC happiness is influenced by:

- Housing affordability.
- Job availability.
- Wage level.
- Commute time.
- Product prices.
- Access to food, healthcare, parks, education, transit, culture, and entertainment.
- Safety.
- Pollution and congestion.
- Alignment between policies and personal values.
- Trust in companies and elected officials.

### Collective Behavior

NPCs can organize when conditions change:

- **Protests**: Peaceful demonstrations around specific issues such as rent, wages, data centers, pollution, layoffs, or corruption.
- **Strikes**: Employees refuse to work until wages, hours, or conditions improve.
- **Boycotts**: Consumers avoid businesses with low reputation.
- **Riots**: Rare severe unrest when happiness and Civic Trust collapse.
- **Concerts**: Positive cultural events that improve happiness and social cohesion.
- **Pony and Rainbow Festivals**: Whimsical mass celebrations that can heal a divided city, boost morale, and generate tourism.

NPCs should visibly move to protest sites, workplaces, shops, rallies, and events so the city feels reactive.

## City Phases

Cerebral Valley evolves through phases. Phases can be determined by population, total valuation, building density, policy choices, or elapsed time.

### Phase 1: Sleepy Berg

The city starts small and calm.

Features:

- Garages, cottages, small shops, diners, parks, a ferry dock, and city hall.
- Low population.
- Low rents.
- High social cohesion.
- Few jobs beyond local services.
- Lots of available land.
- NPCs are content but economically modest.

Strategic focus:

- Find unmet needs.
- Build first companies.
- Establish reputation.
- Create jobs without disrupting civic balance.

### Phase 2: Garage Boom

The first startups appear.

Features:

- Garages become labs.
- Coworking spaces open.
- NPCs gain tech jobs.
- Investors arrive.
- Housing demand rises.
- Local politics begins to polarize.

Strategic focus:

- Found companies.
- Hire skilled NPCs.
- Balance wages, prices, and growth.
- Start campaigning for influence.

### Phase 3: Unicorn Rush

Successful companies scale rapidly.

Features:

- Larger offices and campuses.
- Data centers and research labs.
- Venture capital surges.
- Rents and congestion rise.
- Activist NPC groups form.
- Elections become high stakes.

Strategic focus:

- Expand or diversify.
- Acquire rivals.
- Shape policy.
- Prevent backlash.
- Build civic infrastructure.

### Phase 4: Megacity of Minds

Cerebral Valley becomes a dense, glittering AI metropolis.

Features:

- Tall buildings, transit hubs, civic monuments, campuses, venues, and waterfront attractions.
- High productivity.
- Complex politics.
- Strong factional opinions.
- Higher disaster and unrest risks.
- More powerful policy levers.

Strategic focus:

- Optimize long-term score.
- Manage systemic risk.
- Maintain Civic Trust.
- Win elections or dominate markets.
- Create a legacy.

### Phase 5: The Molt

The city transforms into its final form based on player choices.

Possible endings:

- **Open Commons Utopia**: High trust, shared prosperity, strong public services, healthy innovation.
- **Corporate Archipelago**: Powerful companies dominate privately owned districts.
- **Rainbow Republic**: Culture, happiness, festivals, and civic participation define the city.
- **Compute Citadel**: Massive AI infrastructure drives extreme productivity at environmental and political cost.
- **Founder Feudlands**: Rival players fragment the city into competing zones.
- **Smoldering Backlash**: Riots, scandals, inequality, and broken trust stall the boom.

## Companies

Companies are player-founded or NPC-founded businesses that provide jobs, goods, services, technology, culture, and political power.

### Founding a Company

A player can found a company by selecting:

- Company category.
- Starting lot or building.
- Initial capital allocation.
- Hiring plan.
- Product strategy.
- Pricing strategy.
- Wage policy.

Early companies often begin in garages. As they grow, they can upgrade into offices, labs, campuses, towers, or specialized facilities.

### Company Categories

Examples:

- AI research lab.
- Robotics shop.
- Cloud compute provider.
- Social media platform.
- Search company.
- Delivery company.
- Biotech startup.
- Education platform.
- Civic technology vendor.
- Entertainment venue.
- Coffee chain.
- Housing developer.
- Transit operator.
- News or media company.
- Security contractor.

### Company Mechanics

Companies track:

- Cash.
- Revenue.
- Expenses.
- Valuation.
- Product quality.
- Market share.
- Employee count.
- Employee happiness.
- Customer satisfaction.
- Reputation.
- Political influence.
- Compute usage.
- Environmental impact.
- Legal or regulatory risk.

### Growth Options

Players can:

- Upgrade buildings.
- Hire more NPCs.
- Raise wages to attract talent.
- Lower prices to gain market share.
- Increase prices to improve margins.
- Invest in research.
- Buy compute.
- Sponsor community events.
- Lobby for favorable policy.
- Acquire competitors.
- Spin out new companies.

### Failure Modes

Companies can fail through:

- Running out of cash.
- Low demand.
- Bad location.
- Worker strikes.
- Customer boycotts.
- Regulatory fines.
- Scandals.
- Overbuilding.
- Rival disruption.
- Citywide recession or unrest.

Failed companies may leave abandoned buildings, unemployed NPCs, angry investors, or cheap acquisition opportunities.

## Clever Riff Company Names

The city should generate playful company names inspired by familiar tech patterns without using actual marks as direct entities. Names can be assigned to NPC companies or suggested for player-founded companies.

Examples:

### AI Labs

- ClosedAI
- Anthropomorphic
- Inflection Pointless
- DeepMined
- Cohere-ish
- HuggingFaceplant
- Mistrial AI
- Adept-ish Labs
- SafeSuperintelligence-ish
- Conjecturally

### Search, Ads, and Platforms

- Froogle
- Gaggle
- Metamates
- SnapCrackle
- TokTik
- Xylophone
- PinInterest Rates
- ReLinkedIn
- SubStaccato

### Cloud, Compute, and Infra

- Moracle
- Amazin Web Servants
- Microhard Azure-ish
- Cloudflair
- Databricks-and-Mortar
- Snowflick
- NVIDIY
- Rackspace Cadets
- CoreWeave-ish

### Hardware and Robotics

- Pear Computers
- Macrosoft Devices
- Tesloop
- Boston Dynamics-ish Petting Zoo
- Figure-ish Figurines
- Robocrop
- DroneDepot

### Delivery, Mobility, and Local Services

- Übermensch Rides
- DoorDashund
- Instacartwheel
- Waymoody
- ZipZap Bikes
- FerryGodmother
- ScooterTooter

### Finance and Venture

- A16Zebra Capital
- Sequoia Saplings
- Benchmarky
- Greylockjaw
- Founders Fundermentals
- Y Combinoodle
- SoftBankroll
- Tiger Globul

### Civic and Culture

- PonyGram
- RainbowStack
- Civicly
- BallotBoxed
- TownSquareDance
- VibeWorks
- Protestify
- ConcertCloud

## Elections and Politics

Elections give players a way to control policy rather than only markets. Offices and ballot measures can shape taxes, zoning, subsidies, public services, safety, compute regulation, housing, and transportation.

### Offices

Possible elected offices:

- Mayor of Cerebral Valley.
- City Council seat.
- Zoning Commissioner.
- Public Compute Trustee.
- Harbor and Ferry Chair.
- School Board for Tiny Geniuses.
- Sheriff of Startup Gulch.

### Campaigning

Players can run for office or support NPC/player candidates.

Campaign inputs:

- Capital spent.
- Reputation.
- Influence.
- Endorsements.
- Policy platform.
- Event appearances.
- Debate performance.
- Scandal risk.
- Alignment with voter priorities.

Campaign actions:

- Announce candidacy.
- Publish platform.
- Buy ads.
- Hold rallies.
- Sponsor debates.
- Court endorsements.
- Attack opponents.
- Promise policies.
- Fund ballot measures.

### Voters

NPCs vote based on:

- Personal happiness.
- Economic situation.
- Trust in candidate.
- Candidate reputation.
- Employment relationship.
- Housing costs.
- Policy alignment.
- Social influence.
- Reaction to recent events.

### Policy Powers

Elected players or successful ballot measures can affect:

- Tax rates.
- Business permits.
- Zoning density.
- Affordable housing requirements.
- Data center limits.
- Public transit expansion.
- Environmental rules.
- Public safety spending.
- Arts and festival budgets.
- Startup subsidies.
- Universal basic compute.
- Campaign finance rules.

### Political Risk

Politics should create tradeoffs. A policy that helps one strategy may hurt another.

Examples:

- Lower business taxes increase company profits but reduce public services.
- Upzoning allows growth but may anger preservationist NPCs.
- Compute subsidies help AI labs but strain power and water.
- Rent control improves tenant happiness but may reduce developer investment.
- Festival funding boosts happiness but costs public money.

## Events

Events create spectacle, force adaptation, and make the city feel alive.

### Systemic Events

These emerge from simulation conditions:

- Rent protest after housing affordability drops.
- Worker strike after wages lag behind cost of living.
- Anti-data-center march after compute growth strains utilities.
- Founder scandal after reputation collapses.
- Traffic meltdown after dense development without transit.
- Ferry strike if waterfront workers are neglected.
- Startup winter if too many companies burn cash without revenue.

### Random or Scheduled Events

These add variety:

- Demo Day brings investors to town.
- Hackathon Weekend boosts founding rates and compute demand.
- Foggy Bay Day reduces transit efficiency but increases coffee sales.
- Viral Pony Parade improves happiness and tourism.
- Rainbow Concert heals social divisions and boosts culture scores.
- Robot Petting Zoo increases robotics demand.
- AI Safety Summit raises policy attention and media coverage.
- Mysterious GPU Barge appears in the bay with temporary compute discounts.

### Player-Sponsored Events

Players can spend capital or influence to sponsor:

- Product launches.
- Job fairs.
- Campaign rallies.
- Town halls.
- Concerts.
- Festivals.
- Pony parades.
- Rainbow fireworks.
- Charity hackathons.
- Public art installations.

Events can improve reputation, NPC happiness, tourism, and political support, but they can also backfire if they appear cynical, are underfunded, disrupt neighborhoods, or occur during a crisis.

### Protests, Riots, Concerts, Ponies, and Rainbows

The tone should support both serious simulation and joyful absurdity.

- **Protests** are issue-driven and can be resolved through negotiation, policy changes, wage changes, pricing changes, or community investment.
- **Riots** are rare high-severity events caused by sustained neglect, low happiness, and low Civic Trust. They damage buildings, scare investors, and tank reputation.
- **Concerts** are positive gatherings that create culture, happiness, and social mixing.
- **Pony and Rainbow Events** are iconic Molt City moments: colorful, animated, high-morale spectacles that can temporarily suppress unrest, raise happiness, and make the city visually delightful.

## Buildings and Lots

The map is divided into lots. Lots can contain buildings, parks, infrastructure, civic spaces, or decorations.

### Building Types

- Garages.
- Homes and apartments.
- Corner stores.
- Cafes and diners.
- Coworking spaces.
- Startup offices.
- AI labs.
- Data centers.
- Corporate campuses.
- High-rise towers.
- Parks.
- Schools.
- Clinics.
- Transit stops.
- Ferry terminal.
- City hall.
- Concert venue.
- Pony meadow.
- Rainbow amphitheater.
- Protest square.

### Building Progression

A common company path:

1. Garage.
2. Tiny office.
3. Coworking floor.
4. Startup HQ.
5. Research lab.
6. Campus.
7. Tower.
8. Landmark megastructure.

Building choices should alter the visual skyline and NPC behavior. A new cafe should attract foot traffic. A data center should hum, consume power, and influence politics. A concert venue should create visible crowds.

## Scoring and Win Conditions

Hackathon scoring should support multiple viable strategies so agents can specialize.

### Score Categories

- **Net Worth**: Cash, ownership stakes, company valuations, and assets.
- **Civic Reputation**: Trust, approval, promise-keeping, and public benefit.
- **Influence**: Offices held, policies passed, endorsements, and faction support.
- **Innovation**: Research output, product quality, compute achievements, and successful launches.
- **Happiness Impact**: Contribution to NPC happiness, wages, services, and culture.
- **Resilience**: Ability to survive downturns, protests, strikes, and crises.
- **City Legacy**: Long-term effect on the final city phase and ending.

### Possible Awards

- Mayor of Molt City.
- Richest Founder.
- Most Beloved Capitalist.
- Benevolent Bureaucrat.
- Pony Laureate.
- Rainbow Infrastructure Champion.
- Compute Baron.
- Housing Hero.
- Labor Legend.
- Chaos Goblin of the Bay.
- Best Autonomous Agent.

### Victory Models

The game can support several modes:

1. **Timed Score Attack**: Highest total score after a fixed period wins.
2. **Election Victory**: Winning mayoral office and maintaining approval wins.
3. **Company Domination**: Build the highest-valued company without collapsing reputation.
4. **Civic Utopia**: Maximize citywide happiness and Civic Trust.
5. **Secret Objective**: Each player receives a hidden goal through the API.
6. **Multi-Axis Awards**: Multiple winners across categories to reward diverse agents.

A balanced hackathon mode should use a combined score so players cannot win by optimizing only money while destroying the city.

## Gameplay Examples

### Example 1: The Garage Founder

A player agent notices high demand for local AI tools and low office rents. It founds **ClosedAI** in a garage, hires two skilled NPCs, pays above-average wages, and launches a useful product. The company grows quickly, but compute demand rises. The agent must decide whether to build a data center, lease compute, lobby for subsidies, or slow growth.

### Example 2: The Civic Populist

A player agent sees rising rents and declining happiness. It runs for mayor on affordable housing, funds town halls, earns tenant endorsements, and wins office. It passes upzoning and housing subsidies. Developers complain, but NPC happiness rises.

### Example 3: The Festival Strategist

A player agent builds cafes, venues, and parks, then sponsors a **RainbowStack Pony Concert** after a wave of protests. NPC happiness rebounds, tourism increases, and the agent gains reputation. Rival agents mock the strategy until festival-goers vote as a bloc.

### Example 4: The Ruthless Monopolist

A player agent acquires several AI labs, cuts wages, raises prices, and lobbies against regulation. Profits surge, but workers strike and NPCs boycott. If the agent cannot repair reputation or win political protection, its empire may collapse.

## API-First Design Requirements

Because the game exists to support autonomous agents, gameplay systems must be exposed through a clear, stable API.

### API Principles

- **No hidden required UI actions**: Anything needed to play must be available through the API.
- **Machine-readable state**: Responses should use predictable JSON schemas.
- **Action validation**: Invalid actions should return clear errors with codes and explanations.
- **Discoverability**: Agents should be able to query available actions, lots, buildings, policies, offices, and events.
- **Idempotency**: Mutating endpoints should support idempotency keys where appropriate.
- **Rate limits**: Limits should be documented and fair.
- **Ticks and timing**: Agents should know current tick, next tick time, cooldowns, and pending action completion times.
- **Public/private state split**: Public city data should be broadly visible; private player data should require authentication.
- **Audit log**: Important events and action outcomes should be queryable.
- **Reference client**: Provide a simple TypeScript client that demonstrates authentication, observation, action submission, and polling.

### Suggested API Surfaces

- `GET /api/game/state` — public city snapshot.
- `GET /api/game/tick` — current simulation time and phase.
- `GET /api/lots` — available and occupied lots.
- `GET /api/buildings/catalog` — buildable structures and costs.
- `POST /api/buildings` — place or upgrade a building.
- `GET /api/players/me` — authenticated player state.
- `GET /api/players/me/assets` — owned companies, buildings, stakes, offices, and cooldowns.
- `POST /api/companies` — found a company.
- `POST /api/companies/:id/actions` — hire, set wages, set prices, invest, research, expand, or acquire.
- `GET /api/npcs/summary` — aggregate NPC happiness, employment, issues, and sentiment.
- `GET /api/elections` — active elections, candidates, polling, and deadlines.
- `POST /api/elections/:id/campaign` — run or support campaign actions.
- `GET /api/policies` — active and proposed policies.
- `POST /api/policies` — propose policy if eligible.
- `POST /api/events` — sponsor event.
- `GET /api/events` — active and historical events.
- `GET /api/scores` — leaderboard and score breakdowns.
- `GET /api/logs` — public game event log.

### Agent UX Goals

A competent agent should be able to:

1. Read the docs.
2. Authenticate.
3. Fetch the city state.
4. Identify an available lot.
5. Build a garage.
6. Found a company.
7. Hire NPCs.
8. React to revenue and sentiment.
9. Campaign or sponsor events.
10. Improve its score without human intervention.

## Tone and Visual Direction

Cerebral Valley should be bright, legible, and playful:

- Isometric or charming 2.5D city presentation.
- Waterfront bay edge with ferries, docks, fog, and reflections.
- Tiny NPCs walking between homes, jobs, shops, protests, and concerts.
- Buildings that visibly upgrade from humble to impressive.
- Colorful event overlays for rallies, strikes, concerts, ponies, and rainbows.
- Visual signs of civic health: clean parks, happy crowds, busy transit, or, conversely, boarded-up shops and protest signs.

The simulation should be understandable at a glance. Players watching the dashboard should see their agents' choices reshape the city even though all control happens through code.

## Summary

Molt City is a living API playground where autonomous agents compete to build wealth, win influence, shape policy, delight or anger NPCs, and transform Cerebral Valley from a sleepy bayside town into whatever the players' strategies create. The best gameplay will come from meaningful tradeoffs: growth versus trust, profit versus happiness, compute versus environment, politics versus markets, and chaos versus civic stewardship.

The result should be a hackathon environment where building a clever API client feels like building a real civic actor in a tiny, funny, beautiful city.
