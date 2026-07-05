## **🏀 CourtIQ** 

**Real-Time Basketball Scoring & Player Recognition** Product Requirements Document & Roadmap Version 2.0  |  July 2026 

**Strategy update:** CourtIQ ships in two parts. **Part A** is a fully functional manual web app — create matches, score them by hand, share live match codes — built on the backend and data model that the automation work will reuse. **Part B** (the original PRD, unchanged below) layers on-device AI on top: face recognition, automatic score detection, and clip saving.

---

# **Part A — CourtIQ v1: Manual App (Initial Implementation)**

## **A1. Overview & Strategy**

Before any computer vision, CourtIQ must nail the core product loop: **create a match → assign players to teams → score it live → see stats → share it**. Doing this manually first validates the experience with zero CV risk, and everything built here — accounts, matches, players, score events, live updates — is exactly the foundation the automated version plugs into later (auto-detection simply replaces the manual tap as the source of score events).

**Platform decision:** web app first (responsive, mobile-friendly). A native mobile app comes later, once adoption justifies it — and it will be required anyway for the Part B automation roadmap, which needs device cameras.

**Product principles (non-negotiable):**

- **Intuitive** — a first-time game manager can create and start a match without instructions.
- **Uncluttered** — one primary action per screen; the live match screen shows the scoreboard, nothing competing with it.
- **Modular** — matches, scoring, stats, spectating, and comments are independent modules behind one API.
- **Fast** — optimistic UI on every scoring action; live updates pushed over WebSockets, not polling.

## **A2. Feature Requirements**

### **A2.1 Accounts & Player Model (low-friction)**

Only the **game manager** (the person who creates and scores matches) needs an account. Players never have to sign up — a pickup game might be a one-off with strangers. The manager registers players by **unique username**: instant, no email, no password.

| **Feature** | **Description** | **Priority** |
|---|---|---|
| Manager account | Email + password sign-up/login for match creators/scorekeepers | P0 |
| Username-based player registration | Manager adds a player by typing a unique username — creates a lightweight player record instantly | P0 |
| Assign existing players | If a username already exists in the app (saved roster player or registered user), the manager can select it to assign that player to a team | P0 |
| Keep players for future games | After a match (or anytime), the manager is asked whether to keep players — kept players form the manager's roster and accumulate career stats across matches; unkept players stay match-scoped | P1 |
| Player profile claiming | A player can later claim their username with a real account to own their stats and history | P2 |

### **A2.2 Match Creation & Team Setup**

| **Feature** | **Description** | **Priority** |
|---|---|---|
| Create match | Manager creates a match with two teams (name + colour each) | P0 |
| Team assignment | Manager assigns players to Team A or Team B (new usernames or existing players) | P0 |
| Match settings | Comments on/off, public (code-joinable) vs private, target score or timed game | P0 |
| Edit before start | Reorder/move/remove players and change settings any time before tip-off | P1 |

### **A2.3 Live Manual Scoring**

| **Feature** | **Description** | **Priority** |
|---|---|---|
| Start match | Manager starts the match; status goes live and the scoreboard opens | P0 |
| Award points | Tap a player, award +1 / +2 / +3; team total updates automatically | P0 |
| Undo / correct | Undo the last score event or correct a mis-attributed one | P0 |
| End match | Manager ends the match; winner is finalised and stats are locked | P0 |
| Game timer | Optional count-up or countdown timer per match settings | P1 |

### **A2.4 Match Stats**

Every finished match has a stats section.

| **Feature** | **Description** | **Priority** |
|---|---|---|
| Player scores | Points per player for the match | P0 |
| Winning team & final score | Winner, final team totals | P0 |
| MVP | Auto-suggested (top scorer), manually overridable by the manager | P0 |
| Score timeline | Chronological feed of score events through the match | P1 |
| Career stats | Aggregated totals (points, games, wins, MVPs) for kept-roster players | P1 |

### **A2.5 Match Codes & Live Spectating**

| **Feature** | **Description** | **Priority** |
|---|---|---|
| Match code | Every match gets a short shareable code + link | P0 |
| Spectator view | Anyone with the code watches the live scoreboard and event feed — no account, no scorer rights | P0 |
| Real-time updates | Score events reach spectators in under a second via WebSockets | P0 |

### **A2.6 Live Comments**

| **Feature** | **Description** | **Priority** |
|---|---|---|
| Comment during live match | Spectators/players post comments **only if match settings allow it** | P0 |
| No account needed | Commenters just pick a display name | P0 |
| Live stream | Comments appear in real time alongside the event feed | P0 |
| Mid-match toggle | Manager can disable comments during a live match | P1 |

## **A3. Technical Architecture**

| **Layer** | **Technology** | **Rationale** |
|---|---|---|
| Frontend | React (responsive web) | Web-first: zero install for managers and spectators; mobile-friendly |
| Backend | Node.js (Express or Fastify) | Team familiarity; deploys cleanly on Railway |
| Real-time | Socket.IO (WebSockets) | Live scoreboard, event feed, and comments pushed to spectators |
| Database | PostgreSQL on Railway | Relational fit for matches/teams/players/stats; Railway-managed |
| ORM | Prisma or Drizzle | Typed schema, migrations |
| Auth | JWT + bcrypt (managers only) | Simple, stateless; players need no credentials |
| Hosting | Railway (backend + Postgres); frontend on Railway or Vercel | Single platform, simple deploys |

The v1 API and schema are deliberately designed so the future mobile app (Part B automation) consumes the **same backend** — auto-detection will emit the same ScoreEvent the manual tap does.

## **A4. Data Model**

| **Entity** | **Fields** |
|---|---|
| User | id, email, passwordHash, displayName, createdAt — *game managers only* |
| Player | id, username (unique), displayName, avatarColour, managerId, keptForFuture, claimedByUserId (nullable), createdAt — *lightweight, no credentials* |
| Match | id, code, managerId, status (pending/live/finished), settings (commentsEnabled, visibility, targetScore/timer), winnerTeamId, mvpPlayerId, startedAt, endedAt |
| MatchTeam | id, matchId, name, colour, finalScore |
| MatchPlayer | id, matchId, teamId, playerId, points |
| ScoreEvent | id, matchId, matchPlayerId, teamId, points (1/2/3), undone, createdAt |
| Comment | id, matchId, authorName, userId (nullable), body, createdAt |

Designed to extend cleanly for Part B (faceEmbedding on Player, Clip entity, etc.) and for future player-claimed accounts.

## **A5. Roadmap — Initial Implementation (Manual App)**

**This roadmap runs first. The original Part B roadmap (Section 5 below) follows once the manual app is live.**

| **Phase** | **Focus** | **Deliverables** |
|---|---|---|
| M1 (Weeks 1–2) | Foundation | Node.js + PostgreSQL on Railway, manager auth (JWT), React web shell, deploy pipeline |
| M2 (Weeks 3–4) | Matches | Match creation, team setup, username-based player registration & reuse, match codes |
| M3 (Weeks 5–6) | Live scoring | Scoring UI (+1/+2/+3, undo), WebSocket live scoreboard, spectator view via code |
| M4 (Weeks 7–8) | Stats & social | Match stats (player points, MVP, winner, timeline), keep-players roster flow, live comments with settings gate, polish/perf pass |

## **A6. Success Metrics (Manual App)**

| **Metric** | **Target** |
|---|---|
| Match creation flow (create → teams → start) | < 60 seconds for a returning manager |
| Score-to-spectator latency | < 1 second |
| Spectator join via code | No account required, works on any phone browser |
| Scoring integrity | Zero data loss on undo/correct |

---

# **Part B — CourtIQ v2: Automated Recognition & Scoring (Original PRD)**

*The original PRD below is unchanged. It builds directly on Part A: the manual app's backend, match model, and score events become the target that automated detection feeds into.*

CourtIQ — Product Requirements Document  |  Page 1 of 12 

## **1. Product Overview** 

## **1.1 Problem Statement** 

Pickup and leisure basketball games have no easy way to track scores per player and per team in real time. Existing solutions either require expensive hardware, save full game footage to third-party servers, or only provide post-game analysis. Players are left keeping score manually or relying on memory. 

## **1.2 Solution** 

CourtIQ is a mobile-first application that uses a single iPhone on a tripod to: 

- Recognize each player's face in real time using on-device AI 

- Automatically detect when a basket is scored 

- Assign points to the scoring player and their team live 

- Display a live scoreboard (individual + team) on screen 

- Save only scored moments as short clips — never the full game 

## **1.3 Vision Statement** 

Give every pickup basketball player the analytics experience of a pro — privately, affordably, and in real time. 

## **1.4 Target Users** 

||||
|---|---|---|
|**User Type**|**Description**|**Core Need**|
||||
||||
|Pickup Player|Casual player at local court, park, or<br>gym|Know who scored what,<br>settle disputes|
||||
||||
|Rec League Organizer|Runs regular weekly games with<br>consistent teams|Per-game and season stats<br>per player|
||||
||||
|Friend Group|Same group plays weekly|Leaderboard, bragging<br>rights, highlights|
||||



CourtIQ — Product Requirements Document  |  Page 2 of 12 

## **2. Goals & Non-Goals** 

## **2.1 Goals** 

- Real-time face recognition — identify registered players from a live camera feed 

- Dual scoreboard — track individual player points AND team totals simultaneously 

- • Auto score detection — detect when a ball crosses the rim and increment scores 

- Privacy-first — no full game video stored; only scored moment clips saved locally 

- • Works on a single iPhone 13 Pro or newer on a tripod — no extra hardware 

- Player profiles — face embeddings + stats stored per player, not raw photos 

## **2.2 Non-Goals (MVP)** 

- Auto pan/zoom camera tracking (Phase 2) 

- 3-point vs 2-point automatic detection (Phase 2) 

- Cloud sync and cross-device access (Phase 2) 

- Full game video recording and upload (Phase 3) 

- Public leaderboards or social sharing (Phase 3) 

- Android support (post-MVP) 

CourtIQ — Product Requirements Document  |  Page 3 of 12 

## **3. Feature Requirements** 

## **3.1 Player Registration** 

Before a game, each player registers their face in the app. 

||||
|---|---|---|
|**Feature**|**Description**|**Priority**|
||||
||||
|Face capture|Capture 3–5 face photos per player via front or<br>rear camera|P0|
||||
||||
|Embedding extraction|Extract numeric face embedding vector on-<br>device (Apple Vision)|P0|
||||
||||
|Player profile|Store name, team colour, embedding — no raw<br>photos retained|P0|
||||
||||
|Team assignment|Assign player to Team A or Team B during<br>registration|P0|
||||
||||
|Edit/remove player|Update or delete a player profile before or after<br>a game|P1|
||||



## **3.2 Live Face Recognition** 

During a game, the app continuously identifies players appearing in the camera frame. 

||||
|---|---|---|
|**Feature**|**Description**|**Priority**|
||||
||||
|Real-time detection|Identify faces in live camera feed at minimum<br>15fps|P0|
||||
||||
|Confidence threshold|Only confirm identity above 85% confidence<br>score|P0|
||||
||||
|Unknown player flag|Flag unrecognised faces without crashing or<br>assigning points|P0|
||||
||||
|Multi-face support|Track up to 10 players simultaneously in frame|P1|
||||



## **3.3 Score Detection & Attribution** 

The core feature — detect a basket and assign points to the right player and team. 

CourtIQ — Product Requirements Document  |  Page 4 of 12 

||||
|---|---|---|
|**Feature**|**Description**|**Priority**|
||||
||||
|Ball detection|Detect basketball in frame using YOLOv8 model|P0|
||||
||||
|Rim detection|Identify basket rim coordinates via one-time<br>court calibration|P0|
||||
||||
|Score event trigger|Trigger score when ball trajectory passes<br>through rim zone|P0|
||||
||||
|Player attribution|Assign score to last recognised player who had<br>possession|P0|
||||
||||
|Manual override|Allow tap-to-correct if auto attribution is wrong|P0|
||||
||||
|Point value|Default +2 per basket; manual toggle for +3<br>(Phase 2 auto)|P1|
||||



## **3.4 Dual Scoreboard** 

Live scoreboard visible on screen at all times during a game. 

||||
|---|---|---|
|**Feature**|**Description**|**Priority**|
||||
||||
|Team score display|Show Team A vs Team B total points<br>prominently|P0|
||||
||||
|Individual score display|Show each player's personal points tally|P0|
||||
||||
|Score animation|Visual flash/animation when a basket is scored|P1|
||||
||||
|Game timer|Optional countdown or count-up timer|P1|
||||
||||
|Undo last score|Remove the last attributed basket in case of<br>error|P0|
||||



## **3.5 Clip Saving (Event-Triggered)** 

Video is only written to storage when a score event is detected — never the full game. 

||||
|---|---|---|
|**Feature**|**Description**|**Priority**|
||||
||||
|Circular buffer|Keep rolling 15s video buffer in memory at all<br>times|P0|
||||
||||
|Clip trigger|On score event: save 10s before + 5s after to<br>local storage|P0|
||||
||||
|Clip metadata|Tag each clip with player name, team, points,<br>timestamp|P0|
||||
||||
|Clip viewer|In-app gallery of scored moment clips per game|P1|
||||



CourtIQ — Product Requirements Document  |  Page 5 of 12 

||||
|---|---|---|
|**Feature**|**Description**|**Priority**|
||||
||||
|Highlight reel|Auto-compile all clips from a game into one<br>video per player|P2|
||||



CourtIQ — Product Requirements Document  |  Page 6 of 12 

## **4. Technical Architecture** 

## **4.1 Tech Stack** 

||||
|---|---|---|
|**Layer**|**Technology**|**Rationale**|
||||
||||
|Frontend / UI|React Native (Expo)|Frontend dev familiarity, cross-platform<br>future|
||||
||||
|Camera access|react-native-vision-camera|Frame processor support for real-time<br>CV|
||||
||||
|Face recognition|Apple Vision Framework (via<br>native module)|On-device, private, fast|
||||
||||
|Ball detection|YOLOv8 nano — CoreML<br>converted|Lightweight, runs on iPhone GPU|
||||
||||
|Ball tracking|ByteTrack + Kalman Filter|Handles occlusion and fast movement|
||||
||||
|Score logic|Custom JS engine (event-<br>driven)|Simple state machine for possession +<br>rim event|
||||
||||
|Video buffer|AVFoundation circular buffer<br>(native)|Efficient memory, no disk writes until<br>score|
||||
||||
|Local storage|SQLite via Expo SQLite|Player profiles, embeddings, game<br>history|
||||
||||
|Clip storage|iOS local file system (no cloud)|Privacy-first — stays on device|
||||



## **4.2 Data Model** 

|||
|---|---|
|**Entity**|**Fields**|
|||
|||
|Player|id, name, teamId, faceEmbedding (vector), totalPoints, gamesPlayed,<br>createdAt|
|||
|||
|Team|id, name, colour, playerIds[]|
|||
|||
|Game|id, date, teamAId, teamBId, winnerId, duration, clipIds[]|
|||
|||
|ScoreEvent|id, gameId, playerId, teamId, points, timestamp, clipPath|
|||
|||
|Clip|id, scoreEventId, filePath, duration, thumbnailPath|
|||



CourtIQ — Product Requirements Document  |  Page 7 of 12 

## **4.3 Score Attribution Flow** 

The logic for assigning a basket to a player follows this sequence: 

- Camera frame processed every ~66ms (15fps minimum) 

- Detected faces matched against stored embeddings above confidence threshold 

- Ball position tracked frame by frame via YOLOv8 + ByteTrack 

- Last player within 2m of ball (by position estimate) flagged as possessor 

- When ball trajectory crosses rim zone → score event fired 

- Points (+2 default) assigned to flagged possessor and their team 

- Circular buffer flushes clip to disk; metadata written to SQLite 

CourtIQ — Product Requirements Document  |  Page 8 of 12 

## **5. Product Roadmap** 

## **Phase 1 — MVP (Weeks 1–4)** 

## **Goal: Working real-time scoreboard with face recognition. No video saved.** 

||||
|---|---|---|
|**Week**|**Focus**|**Deliverables**|
||||
||||
|Week 1|Foundation|Expo project setup, camera feed via vision-camera,<br>Supabase/SQLite schema, player registration UI|
||||
||||
|Week 2|Face Recognition|Apple Vision face embedding extraction, player registration<br>flow, real-time face matching in live feed|
||||
||||
|Week 3|Score Detection|YOLOv8 ball detection on iPhone, court calibration (rim<br>coordinates), score event trigger logic|
||||
||||
|Week 4|Scoreboard + Polish|Live dual scoreboard UI (team + individual), manual score<br>override, undo, basic game session management|
||||



## **Phase 2 — Enhanced Camera (Weeks 5–7)** 

**Goal: BallerCam-style experience using just an iPhone.** 

||||
|---|---|---|
|**Week**|**Focus**|**Deliverables**|
||||
||||
|Week 5|Auto Zoom|AVCaptureDevice zoom API — auto-zoom toward<br>ball/action zone|
||||
||||
|Week 6|Ball Tracking|ByteTrack + Kalman Filter integration for smoother tracking<br>across frames|
||||
||||
|Week 7|3-Point Detection|Detect shot origin distance from rim to auto-assign +2 or +3<br>points|
||||



## **Phase 3 — Highlights & Clips (Weeks 8–10)** 

**Goal: Scored moment clips auto-saved. Highlight reel per player per game.** 

||||
|---|---|---|
|**Week**|**Focus**|**Deliverables**|
||||
||||
|Week 8|Circular Buffer|15s rolling video buffer in memory; write to disk only on<br>score event|
||||



CourtIQ — Product Requirements Document  |  Page 9 of 12 

||||
|---|---|---|
|**Week**|**Focus**|**Deliverables**|
||||
||||
|Week 9|Clip Metadata|Tag clips with player, team, points, timestamp; in-app clip<br>viewer|
||||
||||
|Week 10|Highlight Reel|Auto-compile all clips per game into a player highlight<br>video; share sheet|
||||



## **Phase 4 — Growth (Post Week 10)** 

- Season stats and historical leaderboard across multiple games 

- Android support (React Native makes this viable) 

- Optional cloud sync for teams who want cross-device access 

- Social sharing of highlight clips 

- Rec league mode — scheduled games, standings, season rankings 

CourtIQ — Product Requirements Document  |  Page 10 of 12 

## **6. Success Metrics** 

||||
|---|---|---|
|**Phase**|**Metric**|**Target**|
||||
||||
|MVP|Face recognition accuracy (known players)|> 85% in outdoor lighting|
||||
||||
|MVP|Score detection accuracy|> 80% of made baskets<br>correctly attributed|
||||
||||
|MVP|Latency from basket to scoreboard update|< 2 seconds|
||||
||||
|Phase 2|Auto-zoom responsiveness|Ball in frame > 90% of play time|
||||
||||
|Phase 3|Clip save success rate|> 95% of score events produce<br>a saved clip|
||||
||||
|Phase 3|False positive score events|< 5% of detected events are<br>non-scores|
||||



CourtIQ — Product Requirements Document  |  Page 11 of 12 

## **7. Risks & Mitigations** 

||||
|---|---|---|
|**Risk**|**Impact**|**Mitigation**|
||||
||||
|Poor outdoor lighting degrades<br>face recognition|High|Tune confidence threshold; add optional flash<br>mode; prompt user to register in similar<br>lighting|
||||
||||
|Ball moves too fast for detection<br>at 15fps|High|Use TrackNet heatmap model as fallback;<br>increase frame rate to 30fps if device allows|
||||
||||
|Wrong player attributed for a<br>score|Medium|Manual override tap always available; undo<br>last score button|
||||
||||
|iPhone overheats running CV +<br>video simultaneously|Medium|Profile and throttle YOLOv8 to GPU; run face<br>recognition at lower frequency (every 5<br>frames)|
||||
||||
|Rim detection fails on different<br>court setups|Medium|One-time court calibration step before each<br>game; allow manual rim zone adjustment|
||||



CourtIQ — Confidential Product Document — v1.0 — May 2026 

CourtIQ — Product Requirements Document  |  Page 12 of 12 

