import { db, ref, onValue, set, update, get, child, serverTimestamp } from "./firebase.js";

// ===== Utilities =====
const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));
const genId = () => Math.random().toString(36).slice(2, 10);
const short = (s) => s?.slice(0,6) ?? "";

// Ranks high→low for trick resolution
const RANKS = ["A","K","Q","J","10","9","8","7","6","5","4","3","2"]; // Note: 2s may be removed by setup rule
const SUITS = ["S","H","D","C"]; // ♠ ♥ ♦ ♣

// Points mapping per card
const CARD_POINTS = new Map([
  ...["A","K","Q","J","10"].map(r => [r, 10]),
  ["5", 5],
]);
// 3 of Spades = 30
const KALI_TEERI = "3S";

// ===== UI refs =====
const ui = {
  name: qs("#displayName"),
  createRoomBtn: qs("#createRoomBtn"),
  roomCodeInput: qs("#roomCodeInput"),
  joinBtn: qs("#joinRoomBtn"),
  roomInfo: qs("#roomInfo"),
  roomCodeText: qs("#roomCodeText"),
  playerCount: qs("#playerCount"),
  playerList: qs("#playerList"),
  dealerName: qs("#dealerName"),
  readyBtn: qs("#readyBtn"),
  leaveBtn: qs("#leaveBtn"),

  bidding: qs("#bidding"),
  bidTurnName: qs("#bidTurnName"),
  bidInput: qs("#bidInput"),
  placeBidBtn: qs("#placeBidBtn"),
  skipBidBtn: qs("#skipBidBtn"),
  bidTable: qs("#bidTable"),

  partnerTrump: qs("#partnerTrump"),
  trumpSelect: qs("#trumpSelect"),
  partnerCalls: qs("#partnerCalls"),
  callRank: qs("#callRank"),
  callSuit: qs("#callSuit"),
  addPartnerCallBtn: qs("#addPartnerCallBtn"),
  confirmPartnerTrumpBtn: qs("#confirmPartnerTrumpBtn"),

  tableSec: qs("#tableSec"),
  roundNum: qs("#roundNum"),
  phaseText: qs("#phaseText"),
  turnName: qs("#turnName"),
  trumpBadge: qs("#trumpBadge"),
  teamBadge: qs("#teamBadge"),
  bidValue: qs("#bidValue"),
  waitingText: qs("#waitingText"),
  tableCircle: qs("#tableCircle"),
  hand: qs("#hand"),
  playSelectedBtn: qs("#playSelectedBtn"),
  endTurnBtn: qs("#endTurnBtn"),

  scoresDlg: qs("#scoresDlg"),
  scoresBody: qs("#scoresBody"),
  closeScoresBtn: qs("#closeScoresBtn"),
  showScoresBtn: qs("#showScoresBtn"),

  rulesDlg: qs("#rulesDlg"),
  howToBtn: qs("#howToBtn"),
  closeRulesBtn: qs("#closeRulesBtn"),
};

// ===== Local state =====
const MAIN_CODE = "MAIN"; // single shared room on Firebase
let S = {
  roomCode: null,
  playerId: genId(),
  playerName: "",
  isHost: false,
  selectedCard: null,
  snap: null,
};

// ===== Deck helpers with 2-removal by player count =====
function fullDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push(r + s);
  return d;
}
function shuffle(a) {
  for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
}
function removeTwos(deck, playerCount) {
  const twos = deck.filter(c => c.startsWith("2"));
  const rest = deck.filter(c => !c.startsWith("2"));
  let toRemove = 0;
  if (playerCount === 5) toRemove = 2;
  if (playerCount === 6) toRemove = 4;
  if (playerCount === 7) toRemove = 3;
  if (playerCount === 8) toRemove = 4;
  shuffle(twos);
  return rest.concat(twos.slice(toRemove));
}

function dealAll(deck, playerIds) {
  // Deal entire deck round-robin
  const hands = Object.fromEntries(playerIds.map(id => [id, []]));
  let i = 0;
  while (deck.length) {
    hands[playerIds[i % playerIds.length]].push(deck.pop());
    i++;
  }
  return hands;
}

// ===== Scoring =====
function cardPoints(card){
  if (card === KALI_TEERI) return 30;
  const r = card.slice(0, card.length-1);
  return CARD_POINTS.get(r) || 0;
}
function pilePoints(pile){ return pile.reduce((acc,c)=>acc+cardPoints(c),0); }

// ===== Rendering =====
function renderPlayers(players, hostId, bidderId, partners) {
  ui.playerList.innerHTML = "";
  const ids = Object.keys(players || {});
  ui.playerCount.textContent = ids.length;
  ids.forEach(pid => {
    const li = document.createElement("li");
    const p = players[pid];
    const role = pid===hostId?" host":"";
    const bidder = pid===bidderId?" bidder":"";
    const isPartner = partners?.includes(pid);
    const partner = isPartner?" partner":"";
    li.innerHTML = `<span class="name${role}${bidder}${partner}">${p?.name || short(pid)}</span> <span class="badge">${p?.isReady?"Ready":"Waiting"}</span>`;
    ui.playerList.appendChild(li);
  });
}

function renderHand(cards) {
  const renderInto = (id)=>{
    const elWrap = document.getElementById(id);
    if (!elWrap) return;
    elWrap.innerHTML = "";
    (cards||[]).forEach(c=>{
      const el = document.createElement("div");
      el.className = "card" + (S.selectedCard===c?" selected":"");
      el.textContent = c;
      el.onclick = ()=>{ S.selectedCard = (S.selectedCard===c?null:c); renderHand(cards); };
      elWrap.appendChild(el);
    });
  };
  renderInto("hand");
  renderInto("bidHand");
};
    ui.hand.appendChild(el);
  );
}

function seatPositions(n, radius){
  const arr = [];
  for (let i=0;i<n;i++){
    const angle = (2*Math.PI*i)/n - Math.PI/2; // start at top
    const x = radius + radius*Math.cos(angle);
    const y = radius + radius*Math.sin(angle);
    arr.push({x,y});
  }
  return arr;
}

function renderCircle(snap){
  const players = snap.players || {};
  const ids = Object.keys(players);
  const n = ids.length;
  const size = Math.max(320, Math.min(720, 120 + 80*n)); // scale with players
  ui.tableCircle.style.width = size+"px";
  ui.tableCircle.style.height = size+"px";
  ui.tableCircle.innerHTML = "";
  const pos = seatPositions(n, size/2 - 40);

  // Determine visible partners (only after reveal)
  const revealedPartners = (snap.revealedPartners||[]);

  ids.forEach((pid, idx)=>{
    const seat = document.createElement("div");
    seat.className = "seat";
    seat.style.left = (pos[idx].x-28)+"px";
    seat.style.top = (pos[idx].y-28)+"px";

    const name = document.createElement("div");
    const isHost = snap.hostId===pid;
    const isBidder = snap.bidding?.winnerId===pid;
    const isPartner = revealedPartners.includes(pid);
    name.className = "name" + (isHost?" host":"") + (isBidder?" bidder":"") + (isPartner?" partner":"");
    name.textContent = players[pid]?.name || short(pid);

    const pile = document.createElement("div");
    pile.className = "pile";
    const onTable = (snap.table||[]).find(t => t.playerId===pid);
    if (onTable) {
      const c = document.createElement("div");
      c.className = "card small";
      c.textContent = onTable.card;
      pile.appendChild(c);
    }

    seat.appendChild(name);
    seat.appendChild(pile);
    ui.tableCircle.appendChild(seat);
  });
}

function updateTopBar(snap){
  const players = snap.players||{};
  ui.dealerName.textContent = players[snap.dealerId]?.name || "-";
  ui.phaseText.textContent = snap.phase;
  ui.turnName.textContent = players[snap.turn]?.name || "-";
  ui.roundNum.textContent = snap.round || 1;
  ui.trumpBadge.textContent = snap.trump || "-";
  ui.teamBadge.textContent = (snap.bidding?.winnerId ? (players[snap.bidding.winnerId]?.name || short(snap.bidding.winnerId)) : "-");
  ui.bidValue.textContent = snap.bidding?.value || "-";
}

function renderBidsTable(snap){
  ui.bidTable.innerHTML = "";
  const ids = Object.keys(snap.players||{});
  ids.forEach(pid=>{
    const tr = document.createElement("tr");
    const name = snap.players[pid]?.name || short(pid);
    const bid = snap.bidding?.bids?.[pid] ?? "-";
    const skipped = snap.bidding?.skipped?.includes(pid);
    tr.innerHTML = `<td>${name}</td><td>${bid}</td><td>${skipped?"Skipped":""}</td>`;
    ui.bidTable.appendChild(tr);
  });
}

// ===== Rules: validation =====
function canPlay(card, snap){
  const myHand = (snap.hands?.[S.playerId]||[]);
  if (!myHand.includes(card)) return false;
  if ((snap.table||[]).length===0) return true; // leader can play anything (after bidding phase)

  const ledSuit = (snap.table[0].card).slice(-1);
  const myHasLedSuit = myHand.some(c => c.slice(-1)===ledSuit);

  const suit = card.slice(-1);
  if (myHasLedSuit && suit!==ledSuit) return false; // must follow suit

  // If not led suit, any card allowed. (Including trump.)
  return true;
}

// ===== Firebase actions =====
async function createRoom(){
  const code = MAIN_CODE; // single fixed room
  const roomRef = ref(db, `rooms/${code}`);
  const snap = await get(roomRef);
  if (!snap.exists()) {
    await set(roomRef, {
      hostId: S.playerId,
      createdAt: serverTimestamp(),
      phase: "lobby",
      players: {},
      ready: [],
      round: 1,
      dealerId: S.playerId,
      bidding: null,
      trump: null,
      partnerCalls: [],
      revealedPartners: [],
      table: [],
      hands: {},
      turn: null,
      scores: {},
      timeout: null
    });
  }
  await joinRoom(code);
}

async function joinRoom(code){
  S.playerName = ui.name.value || `Player-${short(S.playerId)}`;
  const roomRef = ref(db, `rooms/${code}`);
  let snap = await get(roomRef);
  // Auto-create MAIN if missing
  if (!snap.exists()) {
    await set(roomRef, {
      hostId: S.playerId,
      createdAt: serverTimestamp(),
      phase: "lobby",
      players: {},
      ready: [],
      round: 1,
      dealerId: S.playerId,
      bidding: null,
      trump: null,
      partnerCalls: [],
      revealedPartners: [],
      table: [],
      hands: {},
      turn: null,
      scores: {},
      timeout: null
    });
    snap = await get(roomRef);
  }
  const players = snap.val().players || {};
  if (Object.keys(players).length >= 8) return alert("Room full (max 8)");

  await update(roomRef, {
    [`players/${S.playerId}`]: { name: S.playerName, isReady:false, joinedAt: Date.now() }
  });

  S.roomCode = code;
  wireRoom(code);
  ui.roomCodeText.textContent = code;
  ui.roomInfo.classList.remove("hidden");
}

function wireRoom(code){
  const roomRef = ref(db, `rooms/${code}`);
  onValue(roomRef, (ss)=>{
    const data = ss.val();
    S.snap = data;
    S.isHost = data.hostId===S.playerId;

    const bidderId = data.bidding?.winnerId || null;
    const partners = data.revealedPartners || [];

    renderPlayers(data.players, data.hostId, bidderId, partners);
    updateTopBar(data);
    renderCircle(data);

    // Hand
    renderHand((data.hands?.[S.playerId])||[]);

    // Phase visibility
    ui.bidding.classList.toggle("hidden", data.phase!=="bidding");
    ui.partnerTrump.classList.toggle("hidden", data.phase!=="partner_trump");
    ui.tableSec.classList.toggle("hidden", data.phase!=="playing");

    // Bidding turn panel and table
    if (data.phase==="bidding"){
      ui.bidTurnName.textContent = data.players?.[data.turn]?.name || "-";
      const iSkipped = data.bidding?.skipped?.includes(S.playerId);
      ui.bidInput.disabled = iSkipped || data.turn!==S.playerId;
      ui.placeBidBtn.disabled = iSkipped || data.turn!==S.playerId;
      ui.skipBidBtn.disabled = iSkipped || data.turn!==S.playerId;
      renderBidsTable(data);
    }

    // Partner/trump phase: only bidder can act
    if (data.phase==="partner_trump"){
      const amBidder = data.bidding?.winnerId===S.playerId;
      ui.trumpSelect.disabled = !amBidder;
      ui.addPartnerCallBtn.disabled = !amBidder;
      ui.confirmPartnerTrumpBtn.disabled = !amBidder;
      drawPartnerCalls(data.partnerCalls||[]);
    }

    // Waiting overlay for disconnect timeouts
    if (data.timeout?.active){
      ui.waitingText.classList.remove("hidden");
      ui.waitingText.textContent = `Paused: waiting for ${data.players?.[data.timeout.playerId]?.name || short(data.timeout.playerId)} (${Math.ceil((data.timeout.expiresAt - Date.now())/1000)}s)`;
    } else {
      ui.waitingText.classList.add("hidden");
    }
  });
}

function drawPartnerCalls(calls){
  ui.partnerCalls.innerHTML = "";
  calls.forEach((c,i)=>{
    const div = document.createElement("div");
    div.textContent = `#${i+1} Called: ${c.rank}${c.suit}`;
    ui.partnerCalls.appendChild(div);
  });
}

// ===== Game flow =====
async function allReady(){
  const roomRef = ref(db, `rooms/${S.roomCode}`);
  const ss = await get(roomRef);
  const d = ss.val();
  const ids = Object.keys(d.players||{});
  return ids.length>=4 && ids.length<=8 && ids.every(pid=>d.players[pid].isReady);
}

async function startDeal(){
  const roomRef = ref(db, `rooms/${S.roomCode}`);
  const ss = await get(roomRef); if (!ss.exists()) return;
  const d = ss.val();
  const ids = Object.keys(d.players||{});
  const n = ids.length;
  if (n<4||n>8) return alert("Need 4–8 players");

  // Build deck per rule
  let deck = fullDeck();
  deck = removeTwos(deck, n);
  shuffle(deck);

  // Set order starting at dealer+1
  const dealerIdx = ids.indexOf(d.dealerId);
  const order = ids.slice(dealerIdx+1).concat(ids.slice(0,dealerIdx+1)); // player after dealer leads bidding; dealer last in order

  const hands = dealAll([...deck], ids);

  // Init bidding state
  await update(roomRef, {
    phase: "bidding",
    hands,
    table: [],
    trump: null,
    partnerCalls: [],
    revealedPartners: [],
    bidding: { bids: {}, winnerId: null, value: null, skipped: [] },
    turn: order[0]
  });
}

function nextBidderTurn(d){
  const ids = Object.keys(d.players||{});
  const dealerIdx = ids.indexOf(d.dealerId);
  const order = ids.slice(dealerIdx+1).concat(ids.slice(0,dealerIdx+1));
  const skipped = new Set(d.bidding.skipped||[]);

  // If someone bid 250, they already won (handled elsewhere)
  // Find next in order who hasn't skipped and hasn't already placed a max lock
  let idx = order.indexOf(d.turn);
  for (let step=1; step<=order.length; step++){
    const p = order[(idx+step)%order.length];
    if (!skipped.has(p)) return p;
  }
  return null; // no one left
}

async function placeBid(val){
  const roomRef = ref(db, `rooms/${S.roomCode}`);
  const ss = await get(roomRef); const d = ss.val();
  if (d.phase!=="bidding" || d.turn!==S.playerId) return;
  const v = Math.max(150, Math.min(250, Number(val||0)));

  const bids = d.bidding.bids || {};
  bids[S.playerId] = v;

  // Update current winner
  let winnerId = d.bidding.winnerId; let value = d.bidding.value ?? 0;
  if (v > value){ winnerId = S.playerId; value = v; }

  // If max 250, lock bidding instantly
  if (v===250){
    await update(roomRef, { bidding: { bids, winnerId, value, skipped: Object.keys(d.players) }, turn: null });
    await moveToPartnerTrump();
    return;
  }

  // Move to next bidder who hasn't skipped
  const next = nextBidderTurn({ ...d, bidding: { ...d.bidding, bids } });
  if (next){
    await update(roomRef, { bidding: { ...d.bidding, bids }, turn: next });
  } else {
    // No more bidders; proceed
    await update(roomRef, { bidding: { ...d.bidding, bids, winnerId, value }, turn: null });
    await moveToPartnerTrump();
  }
}

async function skipBid(){
  const roomRef = ref(db, `rooms/${S.roomCode}`);
  const ss = await get(roomRef); const d = ss.val();
  if (d.phase!=="bidding" || d.turn!==S.playerId) return;
  const skipped = new Set(d.bidding.skipped||[]);
  skipped.add(S.playerId);
  const next = nextBidderTurn({ ...d, bidding: { ...d.bidding, skipped: Array.from(skipped) } });
  // If the skipper had the current high bid, keep winner unchanged; skipping just forfeits future bids
  await update(roomRef, { bidding: { ...d.bidding, skipped: Array.from(skipped) }, turn: next });
  if (!next){ await moveToPartnerTrump(); }
}

async function moveToPartnerTrump(){
  const roomRef = ref(db, `rooms/${S.roomCode}`);
  const ss = await get(roomRef); const d = ss.val();
  if (!d.bidding?.winnerId) return; // edge
  await update(roomRef, { phase: "partner_trump", turn: d.bidding.winnerId });
}

function partnersNeeded(playerCount){
  return (playerCount<=5) ? 1 : 2;
}

function normalizeRank(r){
  const u = r.toUpperCase();
  if (u==="T") return "10";
  return u;
}

async function addPartnerCall(){
  const rank = normalizeRank(ui.callRank.value.trim());
  const suit = ui.callSuit.value;
  if (!RANKS.includes(rank)) return alert("Invalid rank");
  const card = rank + suit;

  const roomRef = ref(db, `rooms/${S.roomCode}`);
  const ss = await get(roomRef); const d = ss.val();
  if (S.playerId !== d.bidding.winnerId) return;

  // Error if card is in bidder hand
  const bidderHand = d.hands?.[S.playerId] || [];
  if (bidderHand.includes(card)) return alert("You hold that card. Choose another.");

  const calls = d.partnerCalls || [];
  const needed = partnersNeeded(Object.keys(d.players||{}).length);
  if (calls.length >= needed) return alert("You already called enough partners");

  if (calls.some(c => c.rank===rank && c.suit===suit)) return alert("Duplicate call");

  await update(roomRef, { partnerCalls: calls.concat({rank, suit}) });
  ui.callRank.value = "";
}

async function confirmPartnerTrump(){
  const roomRef = ref(db, `rooms/${S.roomCode}`);
  const ss = await get(roomRef); const d = ss.val();
  if (S.playerId !== d.bidding?.winnerId) return;
  const calls = d.partnerCalls||[];
  const need = partnersNeeded(Object.keys(d.players||{}).length);
  if (calls.length!==need) return alert(`You must call ${need} partner card(s)`);

  const trump = ui.trumpSelect.value; // S/H/D/C

  // Determine first leader = bidder
  await update(roomRef, {
    phase: "playing",
    trump,
    turn: d.bidding.winnerId,
    table: [],
    revealedPartners: []
  });
}

function trickWinner(table, trump){
  // table = [{playerId, card}] in play order
  const ledSuit = table[0].card.slice(-1);
  let best = table[0];
  const rankIdx = (c)=> RANKS.indexOf(c.slice(0, c.length-1));
  const isTrump = (c)=> c.slice(-1)===trump;
  const isLed = (c)=> c.slice(-1)===ledSuit;

  for (let i=1;i<table.length;i++){
    const t = table[i];
    const bc = best.card, tc = t.card;
    if (isTrump(tc) && !isTrump(bc)) { best = t; continue; }
    if (isTrump(tc) && isTrump(bc)) { if (rankIdx(tc) < rankIdx(bc)) best = t; continue; }
    if (!isTrump(tc) && !isTrump(bc)) {
      if (isLed(tc) && !isLed(bc)) { best = t; continue; }
      if (isLed(tc) && isLed(bc)) { if (rankIdx(tc) < rankIdx(bc)) best = t; continue; }
    }
  }
  return best;
}

async function playSelected(){
  const d = S.snap; if (d.phase!=="playing" || d.turn!==S.playerId) return;
  const card = S.selectedCard; if (!card) return;
  if (!canPlay(card, d)) return alert("You must follow suit if possible");

  const roomRef = ref(db, `rooms/${S.roomCode}`);
  const myHand = (d.hands?.[S.playerId]||[]).filter(c=>c!==card);
  const newTable = (d.table||[]).concat({ playerId: S.playerId, card });

  // Reveal partner if this card matches a called card
  let revealed = new Set(d.revealedPartners||[]);
  const called = (d.partnerCalls||[]);
  if (called.some(c => (c.rank + c.suit) === card)) revealed.add(S.playerId);

  await update(roomRef, { [`hands/${S.playerId}`]: myHand, table: newTable, revealedPartners: Array.from(revealed) });
  S.selectedCard = null;
}

async function endTurn(){
  const d = S.snap; if (d.phase!=="playing" || d.turn!==S.playerId) return;
  const ids = Object.keys(d.players||{});

  // If trick incomplete, simply pass turn clockwise
  if ((d.table||[]).length < ids.length){
    const idx = ids.indexOf(S.playerId);
    const next = ids[(idx+1)%ids.length];
    await update(ref(db, `rooms/${S.roomCode}`), { turn: next });
    return;
  }

  // Resolve trick
  const winner = trickWinner(d.table, d.trump);
  const points = pilePoints(d.table.map(t=>t.card));

  // Track piles per winner (optional): we’ll track team totals at round end instead
  const roomRef = ref(db, `rooms/${S.roomCode}`);
  const piles = d.piles || {}; // piles[playerId] = cumulative points this round
  const cur = piles[winner.playerId] || 0;
  piles[winner.playerId] = cur + points;

  await update(roomRef, { table: [], piles, turn: winner.playerId });

  // Check round end: all hands empty
  const allEmpty = Object.values(d.hands||{}).every(arr => arr.length===0);
  if (allEmpty){ await finalizeRound(); }
}

function teamOf(d, bidderId){
  const team = new Set([bidderId]);
  for (const [pid, hand] of Object.entries(d.hands||{})){
    // If already revealed as partner, include
    if ((d.revealedPartners||[]).includes(pid)) team.add(pid);
  }
  // Hidden partners not revealed will be determined at scoring: if a player owns any called card (even if never played), they count as partner
  const called = d.partnerCalls||[];
  for (const pid of Object.keys(d.players||{})){
    const hand = d.hands?.[pid]||[];
    if (called.some(c => hand.includes(c.rank + c.suit))) team.add(pid);
  }
  return Array.from(team);
}

async function finalizeRound(){
  const d = S.snap; const roomRef = ref(db, `rooms/${S.roomCode}`);
  const bidderId = d.bidding.winnerId; const bidValue = d.bidding.value;
  const team = new Set(teamOf(d, bidderId));

  // Sum points captured by each player’s piles
  const pileMap = d.piles || {};
  let teamPoints = 0; let oppPoints = 0;
  for (const [pid, pts] of Object.entries(pileMap)){
    if (team.has(pid)) teamPoints += pts; else oppPoints += pts;
  }

  const scores = d.scores || {};
  // Everyone’s personal total is based on bids outcome per spec
  const ids = Object.keys(d.players||{});
  ids.forEach(pid=>{ if(!(pid in scores)) scores[pid]=0; });

  const success = teamPoints >= bidValue;
  const reward = bidValue;
  if (success){
    ids.forEach(pid=>{ if (team.has(pid)) scores[pid] += reward; });
  } else {
    ids.forEach(pid=>{ if (!team.has(pid)) scores[pid] += reward; });
  }

  // Advance round / rotate dealer
  const round = (d.round||1)+1;
  const dealerOrder = ids;
  const dealerIdx = dealerOrder.indexOf(d.dealerId);
  const nextDealer = dealerOrder[(dealerIdx+1)%dealerOrder.length];

  // Clear transient state; keep scores
  await update(roomRef, {
    lastRound: { success, teamPoints, oppPoints, team: Array.from(team), bidderId, bidValue },
    piles: {},
    table: [],
    partnerCalls: [],
    revealedPartners: [],
    bidding: null,
    trump: null,
    turn: null,
    round,
    dealerId: nextDealer,
    hands: {},
    phase: round>10 ? "ended" : "lobby",
    scores
  });
}

// ===== Timeouts / disconnects (manual pause) =====
async function setPauseFor(pid){
  const expiresAt = Date.now() + 3*60*1000; // 3 min
  await update(ref(db, `rooms/${S.roomCode}`), { timeout: { active:true, playerId: pid, expiresAt } });
}
async function clearPause(){
  await update(ref(db, `rooms/${S.roomCode}`), { timeout: null });
}

// ===== Scores dialog =====
function showScores(d){
  const players = d.players||{}; const scores = d.scores||{};
  const rows = Object.keys(players).map(pid => {
    const name = players[pid]?.name || short(pid);
    const sc = scores[pid]||0;
    return `<tr><td>${name}</td><td>${sc}</td></tr>`;
  }).join("");
  ui.scoresBody.innerHTML = `<table class="table"><thead><tr><th>Player</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>`;
  ui.scoresDlg.showModal();
}

// ===== Event wiring =====
ui.createRoomBtn && (ui.createRoomBtn.onclick = createRoom);
ui.joinBtn.onclick = ()=>{ joinRoom(MAIN_CODE); };
ui.readyBtn.onclick = async ()=>{
  if (!S.roomCode) return;
  const pr = ref(db, `rooms/${S.roomCode}/players/${S.playerId}`);
  await update(pr, { isReady:true });
  if (S.isHost && await allReady()) await startDeal();
};
ui.leaveBtn.onclick = async ()=>{
  if (!S.roomCode) return;
  const roomRef = ref(db, `rooms/${S.roomCode}`);
  await update(roomRef, { [`hands/${S.playerId}`]: null, [`players/${S.playerId}`]: null });
};

// Bidding
ui.placeBidBtn.onclick = ()=>{
  const d = S.snap;
  if (!d || d.phase !== "bidding") { alert("Bidding isn't active."); return; }
  if (d.turn !== S.playerId) { alert("Not your turn to bid."); return; }
  const val = Number(ui.bidInput.value);
  if (!(val >= 150 && val <= 250)) { alert("Enter a valid bid between 150–250."); return; }
  placeBid(val);
};
ui.skipBidBtn.onclick = ()=>{
  const d = S.snap;
  if (!d || d.phase !== "bidding") { alert("Bidding isn't active."); return; }
  if (d.turn !== S.playerId) { alert("Not your turn."); return; }
  skipBid();
};

// Partner & trump
ui.addPartnerCallBtn.onclick = addPartnerCall;
ui.confirmPartnerTrumpBtn.onclick = confirmPartnerTrump;

// Play
ui.playSelectedBtn.onclick = playSelected;
ui.endTurnBtn.onclick = endTurn;

// Scores & Rules dialogs
ui.showScoresBtn.onclick = ()=> showScores(S.snap);
ui.closeScoresBtn.onclick = ()=> ui.scoresDlg.close();
ui.howToBtn.onclick = ()=> ui.rulesDlg.showModal();
ui.closeRulesBtn.onclick = ()=> ui.rulesDlg.close();

// Default name
ui.name.value = `Player-${short(S.playerId)}`;
// Auto-join main room on load if desired
// joinRoom(MAIN_CODE);