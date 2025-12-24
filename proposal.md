# BeckerBox — Wiimote Emulator Experience (Project Proposal)

> BeckerBox is a plug-and-play Windows app that wraps Dolphin to let people use their phones as simple, low-latency Wiimote controllers via a QR-based, WebRTC P2P connection.

---

# 1. Overview & Motivation

**Problem:** Dolphin is a powerful Wii/Wii U emulator, but it requires nontrivial setup and configuration for casual players who are unfamilier with the interface and/or don't have technical knowledge, not to mention the cost of Wii Remotes these days. Current workflows are not plug-and-play.

**Solution (BeckerBox):** provide an easy, minimal-friction application for Windows that bundles Dolphin, shows a QR code that phones scan, and lets up to 4 players connect over the LAN using a simple phone UI that exposes standard Wiimote buttons and a gyro/accelerometer pointer. BeckerBox will translate phone inputs to Dolphin using the DSU protocol so the experience is authentic.

**Audience:** general public / casual gamers. No technical setup knowledge required beyond having used a real Wii before.

**Project Purpose:** bring back the joy of the Wii without the hastle today's restrictions

---

# 2. High-level Goals & Success Criteria

**Primary goals**

* True plug-n-play experience on Windows: automatic installer, bundled Dolphin, create `Games/` folder.
* Phone controllers connect via QR code and WebRTC P2P (PeerJS).
* Up to 4 players, each using one phone as a Wiimote (buttons + gyro pointer).
* BeckerBox sends inputs to Dolphin using the DSU protocol so phones behave like real remotes.
* Simple UI for Player 1 to change “disk” (select games from `Games/` via phone pointer) while Dolphin is in the Wii Menu.

**Success metrics**

* First-time user can connect a phone and navigate the Wii Menu without reading docs.
* Pointer and button latency are “good enough” for casual play on the same LAN.
<!-- * Player 1 can pick and insert a game file using their phone as pointer (disk change functionality present for MVP if possible). -->

---

# 3. Constraints & Assumptions

* **Platform (MVP):** Windows only. Backend is Node.js to preserve portability for later export to other OSes.
* **Networking:** Preferred flow is same-LAN P2P via WebRTC. Internet fallback is supported but with a visible latency warning.
* **Phone clients:** Any modern browser (Chrome, Safari, Edge) — phones do not require login.
* **Login/access:** PC app requires a BeckerSuite login to verify access. Phones connect as guests.
* **Game files:** Users supply their own game files (e.g., place them in a `Games/` folder). BeckerBox does not distribute games.
* **Emulator integration:** BeckerBox bundles Dolphin and communicates using the DSU protocol.
* **Controller features:** Only Wiimote buttons + gyro/accelerometer pointer. No nunchuk support for MVP. One phone = one controller.

---

# 4. User Experience (required flow)

1. **Launch BeckerBox on PC**

   * BeckerBox starts and shows a friendly launch screen with a large QR code and short instructions.
   * The QR code encodes a PeerJS/connection URL and the local session ID.

2. **Connect phones**

   * Players scan the QR code with their phone or directly visit the short link.
   * The phone opens the remote page (full-screen, keep-screen-on) and connects via WebRTC to BeckerBox.
   * Phones are auto-assigned to the next available player slot (1–4). A small animation or indicator confirms assignment.

3. **Ready & Start**

   * Player 1 (or the PC) presses Start in the BeckerBox GUI. Preferably the phone pointer can be used as a PC pointer to press Start.
   * BeckerBox instructs Dolphin to open the Wii Menu.

4. **In-menu behavior**

   * Phones function like Wiimotes: buttons and gyro pointer. Pointer is relative (edges stop movement).
   * While Dolphin is in the Wii Menu, Player 1 has an additional on-controller button that opens a “Change Disc / Select Game” UI. That UI displays files from the `Games/` folder and allows selecting a game using the phone pointer. Upon selection, BeckerBox tells Dolphin to insert that disk.

5. **Play**

   * Phone inputs are relayed via DSU to Dolphin as controller input.
   * BeckerBox shows connection/latency indicators; warns if players are not on the same LAN.

---

# 5. Technical Architecture

```
[BeckerBox Electron App (NodeJS)]  <--WebRTC (PeerJS P2P)-->  [Phone (Browser)]
  |
  +---> DSU (UDP) -> Dolphin (local)
  |
  +---> Local file system (Games/)
  |
  +---> BeckerSuite website (auth/signaling / QR generation)
```

**Components**

* **Electron app (Windows)** — main BeckerBox app. Hosts UI, starts/stops Dolphin, runs Node.js backend logic, integrates with PeerJS signaling and WebRTC handling for the P2P connections.
* **Node.js process (inside Electron)** — Converts packets from phone to the DSU packet format, sends to Dolphin via UDP (DSU).
* **Dolphin (bundled)** — installed together with BeckerBox. BeckerBox runs Dolphin and configures it for DSU input (virtual controllers).
* **Phone UI (website)** — hosted at `beckersuite` (HTTPS). Phones load the remote UI as an ordinary web page (no login). Page uses the PeerJS client library for simple P2P setup with the PC.
* **Signaling / Access control** — BeckerSuite site verifies login only for the PC app (to grant access / entitlement). The signaling flow can be handled by using PeerJS (public or your own PeerServer) or minimal custom signaling on BeckerSuite.
* **QR / short link** — BeckerBox generates a QR code that encodes the session + optional signaling info. Phones scan and connect.

**Key technical notes**

* **PeerJS** (or equivalent) will be used for WebRTC signaling (user provided CDN: `https://cdn.jsdelivr.net/npm/peerjs@1.3.2/dist/peerjs.min.js`).
* **DSU Protocol** will be used to inject Wii controller packets into Dolphin (BeckerBox will implement DSU packet format and CRC as required).
* **P2P Data Channels** will carry small JSON/binary packets: button states, pointer deltas, gyro/accel telemetry (processed into pointer deltas on PC), heartbeat & latency pings.

---

# 6. Phone Controller Design

**Supported controls**

* Standard Wiimote buttons: A, B, 1, 2, +, -, Home, and D-pad
* Pointer: relative movement derived from phone gyro + accelerometer

  * Behavior: relative motion with bounds at screen edges (no wraparound).
  * Touch area for click/touch events
* Player 1: extra “Disc” UI button to open disk selection in the Wii Menu.

**UI characteristics**

* Fullscreen, single-page web app.
* Large touch targets, minimal text.
* “Keep screen on” flag (prevent sleep) and request to give permission to orientation sensors.
* Simple pairing animation: “Connected — assigned to Player 3”.

**Browser compatibility**

* Works on modern mobile browsers: Chrome (Android), Safari (iOS), Edge.
* Desktop browsers can be used for testing, but phones are primary.

---

# 7. Networking & Latency Strategy

* **Primary mode:** Local LAN P2P (WebRTC direct). This minimizes latency and should be sufficient for casual play.
* **Fallback:** If direct P2P fails, fallback to routed connections via signaling server or TURN. BeckerBox will detect increased RTT and show a user warning: “Latency may be noticeable — try connecting phones and PC to the same Wi-Fi network.”
* **Latency handling:** use small packets on data channels
* **Security:** WebRTC uses DTLS; data channels are encrypted in transit. Phone pages do not require login, but the PC must be authorized via BeckerSuite enterprise/login flow.

---

# 8. Installation & Distribution

* **Installer** (MVP assumption): single Windows installer that:

  * Installs BeckerBox (Electron app).
  * Installs/places bundled Dolphin (preconfigured for DSU).
  * Creates a `BeckerBox/Games/` folder (user places game files here).
  * Creates desktop/start menu shortcuts.
<!-- * **Auto updates:** Option to check for BeckerBox updates; Dolphin updates may be handled separately or bundled with BeckerBox updates. -->
* **Permissions:** No elevation required (unless installing program for all users)
---

# 9. Games / Disc Management

* **Games folder:** `BeckerBox/Games/` — user places legally obtained Wii ISOs/GC disks.
* **Disc change UI:** When Dolphin is at the Wii Menu, Player 1 presses the “Change Disc” button on the phone UI; BeckerBox opens an overlay listing files in `Games/`. Player uses phone pointer to select, then BeckerBox commands Dolphin (via DSU or Dolphin CLI) to insert the game.
* **Legal note:** BeckerBox will **not** distribute games. Users are responsible for obtaining legal copies. (Legal section below.)

---

# 10. MVP Scope (explicit)

**Minimum Viable Product:**

* Windows Electron app bundling Dolphin.
* Automatic installer that creates `Games/`.
* QR code pairing, PeerJS WebRTC P2P connections from phones (no phone login).
* Up to 4 players connected (1 phone = 1 controller).
* Wiimote buttons + gyro pointer working reliably.
* Wii Menu navigation supported.
* Disc select UI for Player 1 is highly preferred — include if achievable without delaying MVP; otherwise mark as Phase 2.

**Out of scope for MVP**

* Nunchuk/motion-plus features.
* Multi-OS builds (macOS/Linux) — later phases.
* In-app ROM downloading UI (may be considered later).
* Extensive matchmaking beyond LAN.

---

# 11. Future Features & Roadmap (phases — no hard dates)

**Phase 2 (post-MVP)**

* Disc change UI shipped if postponed.
* Alternative Controller layouts.
* Better installer UX + auto Dolphin config.

**Phase 3**

* Cross-platform builds (macOS, Linux).
* Freemium / paid features (account-based access, cloud settings).
* Community profiles / controller skins.

---

# 12. Legal & Ethical Considerations

* **Dolphin:** A third-party open-source emulator; not affiliated with Nintendo or BeckerBox. BeckerBox bundles Dolphin but must respect Dolphin licensing and attribution.
* **Games / ROMs:** BeckerBox **does not** distribute copyrighted game content and will not include ROMs. Users must provide their own legally obtained game files. BeckerBox will include an explicit notice and simple guidelines in the installer and app.
* **Access model:** BeckerSuite login required for the PC app to verify access/entitlement. Phones remain guest and do not require login.
* **Liability note (proposal):** BeckerBox and it's creators are not responsible for user copyright infringement.

---

# 13. Technical Stack & Tools

* **Frontend (PC GUI):** Electron (HTML/CSS/JS), React/vanilla depending on preference.
* **Backend (inside Electron):** Node.js for DSU implementation, process management, file IO.
* **Phone UI:** Static website hosted on BeckerSuite (HTML/JS). PeerJS client library for WebRTC.
* **Signaling / Auth:** BeckerSuite site for PC login and initial signaling info / access provisioning. PeerJS server or minimal signaling endpoints on BeckerSuite as needed.
* **Emulator:** Dolphin (bundled).
* **Networking libraries:** PeerJS (client) + optional PeerServer for signaling/TURN, native WebRTC DataChannels.
* **Build & Installer:** Electron builder for Windows installer (.exe / .msi).

---

# 14. Development Plan & Deliverables (phased, no explicit time estimates)

**Phase: Prototype**

* Deliverable: Proof-of-concept Electron app that shows QR + accepts a phone connection and prints incoming inputs to console.
* Tasks: Implement PeerJS handshake logic; test WebRTC data channel.

**Phase: DSU integration**

* Deliverable: NodeJS DSU packet builder + ability to inject basic button presses into Dolphin.
* Tasks: Implement DSU packet format & CRC; spawn Dolphin process; verify inputs are recognized in Dolphin.

**Phase: Controller & UX**

* Deliverable: Phone UI with button grid + gyro pointer; PC GUI shows connected players and start button.
* Tasks: UX polish, pointer smoothing, full-screen phone UI, keep-alive heartbeats.

**Phase: Installer & Bundling**

* Deliverable: Windows installer that bundles Dolphin and configures `Games/`.
* Tasks: Electron build pipeline, installer packaging, startup scripts, firewall notes.

**Phase: Polish & Documentation**

* Deliverable: README, small help screens, “how to add games” guide, legal disclaimers.
* Tasks: Basic automated tests, playtesting on LAN, bug fixes.

---

# 15. Testing & Validation

**Test types**

* **Functional tests:** pairing, button mapping, pointer responsiveness, disk insertion flow (Player 1).
* **Network tests:** LAN vs routed/Web fallback; measure RTT and detect cases needing TURN.
* **Usability tests:** first-time setup with nontechnical users — can they connect within 3 minutes? (qualitative).
* **Compatibility tests:** Chrome/Safari/Edge on a variety of phones.

**Key test cases**

* 1–4 phones connect simultaneously and remain stable for a 30-minute play session.
* Dolphin recognizes button presses for each player.
* Player 1 selects and inserts a game from the `Games/` folder via phone pointer.
* Failure modes: abrupt disconnect, reconnect handling, noisy Wi-Fi, TURN fallbacks.

---

# 16. Risks & Mitigations

* **High latency on non-LAN connections** — mitigate with clear user warnings, smoothing/prediction, recommend LAN.
* **DSU fidelity issues** — test thoroughly with Dolphin; implement accurate packet CRC and emulate expected timing.
* **Signaling reliability** — run a small, reliable signaling server or use a managed PeerJS server; failover strategy documented.
* **Legal concerns re: ROMs** — prominent disclaimers and no ROM distribution.
* **Cross-platform complexity later** — architect Node.js code to be portable so porting to macOS/Linux later is practical.

---

# 17. Deliverables for Portfolio

* Project README (this Markdown proposal + development notes).
* Architecture diagram & short video demo (screen recording of pairing & Wii Menu navigation).
* Source code (GitHub) with clear setup & contributor notes.
* Installer for Windows with short user guide.

---