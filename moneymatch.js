const FEE_RATE = 0.02;
const API_BASE = "https://sussyrakas.onrender.com/api/moneymatch";

const elements = {
  matchId: document.querySelector("#match-id"),
  playerId: document.querySelector("#player-id"),
  loadMatch: document.querySelector("#load-match"),
  paypalButton: document.querySelector("#paypal-button"),
  refreshStatus: document.querySelector("#refresh-status"),
  status: document.querySelector("#checkout-status"),
  matchState: document.querySelector("#match-state"),
  playerOne: document.querySelector("#player-one"),
  playerTwo: document.querySelector("#player-two"),
  stake: document.querySelector("#stake"),
  pot: document.querySelector("#pot"),
  fee: document.querySelector("#fee"),
  payout: document.querySelector("#payout")
};

let currentMatch = null;

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value) || 0);
}

function setStatus(message) {
  elements.status.textContent = message;
}

function setLoading(isLoading) {
  elements.loadMatch.disabled = isLoading;
  elements.loadMatch.textContent = isLoading ? "LOADING" : "LOAD";
}

function getDisplayName(player, fallback) {
  if (!player) return fallback;
  return player.displayName || player.username || player.discordTag || player.id || fallback;
}

function renderMatch(match) {
  const stake = Number(match.stake || match.amount || 0);
  const pot = stake * 2;
  const fee = pot * FEE_RATE;
  const payout = pot - fee;

  currentMatch = match;
  elements.matchState.textContent = match.status || "ready";
  elements.playerOne.textContent = getDisplayName(match.players?.[0], "player one");
  elements.playerTwo.textContent = getDisplayName(match.players?.[1], "player two");
  elements.stake.textContent = money(stake);
  elements.pot.textContent = money(pot);
  elements.fee.textContent = `2% / ${money(fee)}`;
  elements.payout.textContent = money(payout);
  elements.paypalButton.disabled = !match.canPay;
  elements.refreshStatus.disabled = false;
}

function renderEmpty() {
  currentMatch = null;
  elements.matchState.textContent = "awaiting match";
  elements.playerOne.textContent = "waiting";
  elements.playerTwo.textContent = "waiting";
  elements.stake.textContent = "$0.00";
  elements.pot.textContent = "$0.00";
  elements.fee.textContent = "2% / $0.00";
  elements.payout.textContent = "$0.00";
  elements.paypalButton.disabled = true;
  elements.refreshStatus.disabled = true;
}

function buildPreviewMatch(matchId) {
  const params = new URLSearchParams(window.location.search);
  const amount = Number(params.get("amount")) || 0;

  return {
    id: matchId,
    status: amount > 0 ? "preview" : "backend offline",
    stake: amount,
    canPay: false,
    players: [
      { displayName: params.get("player1") || "player one" },
      { displayName: params.get("player2") || "player two" }
    ]
  };
}

async function fetchMatch(matchId) {
  const playerId = elements.playerId.value.trim();
  const url = new URL(`${API_BASE}/${encodeURIComponent(matchId)}`);
  if (playerId) {
    url.searchParams.set("playerId", playerId);
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error("match lookup is not connected yet.");
  }

  return response.json();
}

async function loadMatch() {
  const matchId = elements.matchId.value.trim();
  if (!matchId) {
    renderEmpty();
    setStatus("paste the match id from discord to begin.");
    return;
  }

  setLoading(true);
  setStatus("checking match...");

  try {
    const match = await fetchMatch(matchId);
    renderMatch(match);
    setStatus("match loaded. continue to paypal when you are ready.");
  } catch (error) {
    const preview = buildPreviewMatch(matchId);
    renderMatch(preview);
    setStatus("frontend ready. backend lookup is not connected yet, so checkout is disabled for now.");
  } finally {
    setLoading(false);
  }
}

async function startPaypalCheckout() {
  if (!currentMatch) return;

  const playerId = elements.playerId.value.trim();
  if (!playerId) {
    setStatus("enter your discord id before starting checkout.");
    return;
  }

  elements.paypalButton.disabled = true;
  setStatus("creating paypal checkout...");

  try {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(currentMatch.id)}/pay`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ playerId })
    });

    if (!response.ok) throw new Error("paypal checkout is not connected yet.");

    const data = await response.json();
    if (!data.approvalUrl) throw new Error("paypal did not return a checkout link.");

    window.location.href = data.approvalUrl;
  } catch (error) {
    elements.paypalButton.disabled = false;
    setStatus(error.message);
  }
}

const params = new URLSearchParams(window.location.search);
const initialMatchId = params.get("matchId") || params.get("match-id");
const initialPlayerId = params.get("playerId") || params.get("player-id");

if (initialPlayerId) {
  elements.playerId.value = initialPlayerId;
}

if (initialMatchId) {
  elements.matchId.value = initialMatchId;
  loadMatch();
}

elements.loadMatch.addEventListener("click", loadMatch);
elements.refreshStatus.addEventListener("click", loadMatch);
elements.paypalButton.addEventListener("click", startPaypalCheckout);
elements.matchId.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    loadMatch();
  }
});
elements.playerId.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    loadMatch();
  }
});
