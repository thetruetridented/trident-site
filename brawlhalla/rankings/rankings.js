const API_ROOT = "https://api.brawlhalla.com/v1";
const CACHE_API_ROOT = "https://sussyrakas.onrender.com";
const SCAN_PAGES = 3;
const PAGE_SIZE = 50;
const CONCURRENCY = 8;

const legendSelect = document.getElementById("legend-select");
const regionSelect = document.getElementById("region-select");
const showProsToggle = document.getElementById("show-pros-toggle");
const statusLine = document.getElementById("rankings-status");
const rankingsBody = document.getElementById("rankings-body");

const statsCache = new Map();
const PRO_PLAYER_IDS = new Set(["4077949", "20778713", "42206820", "71809945", "6193054", "24116692", "110282750"]);
const CONTENT_CREATOR_PLAYER_IDS = new Set(["3666461", "42206820", "6193054", "24116692", "71960285", "26941318", "110282750"]);
const SEMI_PRO_PLAYER_IDS = new Set(["97534882", "20849670", "84122951", "1546291", "71960285", "26941318", "40843260"]);
const FORCED_LEGEND_PLAYERS = [
  { legendId: 52, playerId: 7140519 },
];
let leaderboard = [];
let currentRankingRows = [];
let activeRequest = 0;
let legendsById = new Map();

function setStatus(message) {
  statusLine.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function legendSlug(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function requestedLegendSlug() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const rankingsIndex = parts.indexOf("rankings");
  return rankingsIndex >= 0 ? parts[rankingsIndex + 1] || "" : "";
}

function updateLegendUrl() {
  const legend = legendsById.get(String(legendSelect.value));
  if (!legend) {
    return;
  }

  const slug = legendSlug(legend.legend_name);
  const nextPath = `/brawlhalla/rankings/${slug}/`;
  if (window.location.pathname !== nextPath) {
    history.replaceState(null, "", nextPath);
  }
}

function playerTags(playerId) {
  const tags = [];

  if (PRO_PLAYER_IDS.has(String(playerId))) {
    tags.push({ label: "PRO", className: "player-tag-pro" });
  }

  if (CONTENT_CREATOR_PLAYER_IDS.has(String(playerId))) {
    tags.push({ label: "CONTENT CREATOR", className: "player-tag-content-creator" });
  }

  if (SEMI_PRO_PLAYER_IDS.has(String(playerId))) {
    tags.push({ label: "SEMI PRO", className: "player-tag-semi-pro" });
  }

  return tags;
}

function visibleRows(rows) {
  if (showProsToggle?.checked) {
    return rows;
  }

  return rows.filter((row) => !PRO_PLAYER_IDS.has(String(row.playerId)));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Brawlhalla API returned ${response.status}`);
  }

  return response.json();
}

async function loadLegends() {
  const firstPage = await fetchJson(`${API_ROOT}/static/legends?max_results=100&page=1`);
  const totalPages = Number(firstPage.total_pages || 1);
  const legends = [...(firstPage.legends || [])];

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await fetchJson(`${API_ROOT}/static/legends?max_results=100&page=${page}`);
    legends.push(...(nextPage.legends || []));
  }

  return legends.sort((a, b) => a.legend_name.localeCompare(b.legend_name));
}

async function loadLeaderboard(region) {
  const requests = [];

  for (let page = 1; page <= SCAN_PAGES; page += 1) {
    requests.push(fetchJson(`${API_ROOT}/leaderboard/ranked?game_mode=1v1&region=${encodeURIComponent(region)}&order_by=rating&max_results=${PAGE_SIZE}&page=${page}`));
  }

  const pages = await Promise.all(requests);
  return pages.flatMap((page) => page.rankings || []);
}

async function runPool(items, worker) {
  const results = [];
  let nextIndex = 0;

  async function runner() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, runner);
  await Promise.all(runners);
  return results;
}

async function loadPlayerStats(playerId) {
  if (statsCache.has(playerId)) {
    return statsCache.get(playerId);
  }

  const stats = await fetchJson(`${API_ROOT}/player/stats?brawlhalla_id=${encodeURIComponent(playerId)}&mode=ranked_1v1`);
  statsCache.set(playerId, stats);
  return stats;
}

async function loadForcedLegendRows(legendId) {
  const forcedPlayers = FORCED_LEGEND_PLAYERS.filter((entry) => Number(entry.legendId) === Number(legendId));
  if (!forcedPlayers.length) {
    return [];
  }

  const rows = await runPool(forcedPlayers, async (entry) => {
    try {
      const stats = await loadPlayerStats(entry.playerId);
      const legend = (stats.legends || []).find((legendEntry) => Number(legendEntry.legend_id) === Number(legendId));

      if (!legend || Number(legend.games || 0) <= 0) {
        return null;
      }

      return {
        playerId: entry.playerId,
        name: stats.name || `Player ${entry.playerId}`,
        rank: stats.global_rank,
        rating: stats.rating,
        tier: stats.tier,
        region: stats.region,
        legendRating: legend.rating,
        legendPeak: legend.peak_rating,
        legendGames: Number(legend.games || 0),
        legendWins: Number(legend.wins || 0),
        legendTier: legend.tier
      };
    } catch {
      return null;
    }
  });

  return rows.filter(Boolean);
}

async function includeForcedLegendRows(rows, legendId) {
  const forcedRows = await loadForcedLegendRows(legendId);
  if (!forcedRows.length) {
    return rows;
  }

  const rowsById = new Map(rows.map((row) => [String(row.playerId), row]));
  for (const forcedRow of forcedRows) {
    rowsById.set(String(forcedRow.playerId), {
      ...rowsById.get(String(forcedRow.playerId)),
      ...forcedRow
    });
  }

  return sortRankingRows([...rowsById.values()], {
    alwaysIncludePlayerIds: forcedRows.map((row) => row.playerId)
  });
}

function sortRankingRows(rows, { alwaysIncludePlayerIds = [] } = {}) {
  const sortedRows = rows
    .filter(Boolean)
    .sort((a, b) => Number(b.legendRating || 0) - Number(a.legendRating || 0) || Number(b.rating || 0) - Number(a.rating || 0));
  const visibleRows = sortedRows.slice(0, 50);
  const visibleIds = new Set(visibleRows.map((row) => String(row.playerId)));

  for (const playerId of alwaysIncludePlayerIds) {
    const forcedRow = sortedRows.find((row) => String(row.playerId) === String(playerId));
    if (forcedRow && !visibleIds.has(String(playerId))) {
      visibleRows.push(forcedRow);
      visibleIds.add(String(playerId));
    }
  }

  return visibleRows;
}

function renderRows(rows) {
  currentRankingRows = rows;
  const filteredRows = visibleRows(rows);

  if (!filteredRows.length) {
    rankingsBody.innerHTML = `<li class="rankings-empty">No legend results found in the scanned current leaderboard pages.</li>`;
    return;
  }

  rankingsBody.innerHTML = filteredRows
    .map((row, index) => {
      const record = `${row.legendWins}-${Math.max(row.legendGames - row.legendWins, 0)}`;
      const tags = playerTags(row.playerId)
        .map((tag) => `<span class="player-tag ${escapeHtml(tag.className)}">${escapeHtml(tag.label)}</span>`)
        .join("");
      return `
        <li class="ranking-card">
          <span class="ranking-position">${index + 1}</span>
          <strong class="ranking-player">${escapeHtml(row.name)}${tags}</strong>
          <span class="ranking-elo">${escapeHtml(row.legendRating)}</span>
          <div class="ranking-details">
            <span>global #${escapeHtml(row.rank)}</span>
            <span>id ${escapeHtml(row.playerId)}</span>
            <span>overall ${escapeHtml(row.rating)}</span>
            <span>peak ${escapeHtml(row.legendPeak)}</span>
            <span>${escapeHtml(record)}</span>
            <span>${escapeHtml(row.region)}</span>
            <span>${escapeHtml(row.legendTier || row.tier)}</span>
          </div>
        </li>
      `;
    })
    .join("");
}

async function renderLegendRankings() {
  const requestId = activeRequest + 1;
  activeRequest = requestId;
  const legendId = Number(legendSelect.value);
  const selectedOption = legendSelect.options[legendSelect.selectedIndex];
  const name = selectedOption?.textContent || "selected legend";
  const region = regionSelect.value;
  rankingsBody.innerHTML = `<li class="rankings-empty">Scanning current ranked players...</li>`;
  setStatus(`Checking saved ${region} ${name} rankings.`);

  try {
    const payload = await loadCachedLegendRankings({ legendId, legendName: name, region });

    if (requestId !== activeRequest) {
      return;
    }

    renderRows(await includeForcedLegendRows(payload.rankings || [], legendId));
    setStatus(`Showing ${payload.rankings?.length || 0} saved ${name} players from the top ${payload.scannedCount || SCAN_PAGES * PAGE_SIZE} ${region} ranked 1v1 scan.`);

    if (payload.refreshing) {
      const freshPayload = await loadCachedLegendRankings({ legendId, legendName: name, region, fresh: true });

      if (requestId !== activeRequest) {
        return;
      }

      if (freshPayload.changed) {
        renderRows(await includeForcedLegendRows(freshPayload.rankings || [], legendId));
        setStatus(`Updated ${name} rankings from the latest ${region} scan.`);
      } else {
        setStatus(`Showing saved ${name} rankings. No higher elo or spot changes found in the latest ${region} scan.`);
      }
    }
  } catch (error) {
    await renderDirectLegendRankings({ requestId, legendId, name, region, note: "Render cache is waking up, using live API fallback." });
  }
}

async function loadCachedLegendRankings({ legendId, legendName, region, fresh = false }) {
  const url = new URL("/api/brawlhalla/rankings", CACHE_API_ROOT);
  url.searchParams.set("legend_id", legendId);
  url.searchParams.set("legend_name", legendName);
  url.searchParams.set("region", region);
  if (fresh) {
    url.searchParams.set("fresh", "1");
  }
  return fetchJson(url);
}

async function renderDirectLegendRankings({ requestId, legendId, name, region, note }) {
  setStatus(`${note} Scanning the top ${SCAN_PAGES * PAGE_SIZE} current ${region} 1v1 ranked players for ${name}.`);

  try {
    leaderboard = await loadLeaderboard(region);
    if (requestId !== activeRequest) {
      return;
    }

    const rows = await runPool(leaderboard, async (ranking) => {
      const player = ranking.players?.[0];
      if (!player?.id) {
        return null;
      }

      let stats;
      try {
        stats = await loadPlayerStats(player.id);
      } catch {
        return null;
      }

      const legend = (stats.legends || []).find((entry) => Number(entry.legend_id) === legendId);

      if (!legend || Number(legend.games || 0) <= 0) {
        return null;
      }

      return {
        playerId: player.id,
        name: player.username || stats.name || `Player ${player.id}`,
        rank: ranking.rank,
        rating: ranking.rating,
        tier: ranking.tier,
        region: ranking.region,
        legendRating: legend.rating,
        legendPeak: legend.peak_rating,
        legendGames: Number(legend.games || 0),
        legendWins: Number(legend.wins || 0),
        legendTier: legend.tier
      };
    });

    if (requestId !== activeRequest) {
      return;
    }

    const filteredRows = rows
      .filter(Boolean)
      .sort((a, b) => Number(b.legendRating || 0) - Number(a.legendRating || 0) || Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, 50);

    renderRows(await includeForcedLegendRows(filteredRows, legendId));
    setStatus(`Showing ${filteredRows.length} live ${name} players from the current top ${SCAN_PAGES * PAGE_SIZE} ${region} ranked 1v1 scan.`);
  } catch (error) {
    rankingsBody.innerHTML = `<li class="rankings-empty">Could not load rankings right now.</li>`;
    setStatus(`${error.message}. Try refreshing in a minute.`);
  }
}

async function init() {
  try {
    const legends = await loadLegends();
    legendsById = new Map(legends.map((legend) => [String(legend.legend_id), legend]));

    legendSelect.innerHTML = legends
      .map((legend) => `<option value="${escapeHtml(legend.legend_id)}">${escapeHtml(legend.legend_name)}</option>`)
      .join("");
    legendSelect.disabled = false;

    const pathSlug = requestedLegendSlug();
    const pathLegend = legends.find((legend) => legendSlug(legend.legend_name) === pathSlug);
    const defaultLegend = pathLegend || legends.find((legend) => legend.legend_name.toLowerCase() === "bodvar") || legends[0];
    if (defaultLegend) {
      legendSelect.value = defaultLegend.legend_id;
    }

    legendSelect.addEventListener("change", () => {
      updateLegendUrl();
      renderLegendRankings();
    });
    regionSelect.addEventListener("change", renderLegendRankings);
    showProsToggle?.addEventListener("change", () => renderRows(currentRankingRows));
    await renderLegendRankings();
  } catch (error) {
    legendSelect.innerHTML = `<option>API unavailable</option>`;
    rankingsBody.innerHTML = `<li class="rankings-empty">Could not connect to the Brawlhalla API.</li>`;
    setStatus(`${error.message}.`);
  }
}

init();
