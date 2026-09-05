const API_ROOT = "https://api.brawlhalla.com/v1";
const SCAN_PAGES = 3;
const PAGE_SIZE = 50;
const CONCURRENCY = 8;

const legendSelect = document.getElementById("legend-select");
const legendName = document.getElementById("legend-name");
const statusLine = document.getElementById("rankings-status");
const rankingsBody = document.getElementById("rankings-body");

const statsCache = new Map();
let leaderboard = [];

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

async function loadLeaderboard() {
  const requests = [];

  for (let page = 1; page <= SCAN_PAGES; page += 1) {
    requests.push(fetchJson(`${API_ROOT}/leaderboard/ranked?game_mode=1v1&region=ALL&order_by=rating&max_results=${PAGE_SIZE}&page=${page}`));
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

function renderRows(rows) {
  if (!rows.length) {
    rankingsBody.innerHTML = `<tr><td colspan="8">No legend results found in the scanned current leaderboard pages.</td></tr>`;
    return;
  }

  rankingsBody.innerHTML = rows
    .map((row, index) => {
      const record = `${row.legendWins}-${Math.max(row.legendGames - row.legendWins, 0)}`;
      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <strong>${escapeHtml(row.name)}</strong>
            <span>global #${escapeHtml(row.rank)}</span>
          </td>
          <td>${escapeHtml(row.legendRating)}</td>
          <td>${escapeHtml(row.rating)}</td>
          <td>${escapeHtml(row.legendPeak)}</td>
          <td>${escapeHtml(record)}</td>
          <td>${escapeHtml(row.region)}</td>
          <td>${escapeHtml(row.legendTier || row.tier)}</td>
        </tr>
      `;
    })
    .join("");
}

async function renderLegendRankings() {
  const legendId = Number(legendSelect.value);
  const selectedOption = legendSelect.options[legendSelect.selectedIndex];
  const name = selectedOption?.textContent || "selected legend";
  legendName.textContent = name;
  rankingsBody.innerHTML = `<tr><td colspan="8">Scanning current ranked players...</td></tr>`;
  setStatus(`Scanning the top ${SCAN_PAGES * PAGE_SIZE} current 1v1 ranked players for ${name}.`);

  try {
    const rows = await runPool(leaderboard, async (ranking) => {
      const player = ranking.players?.[0];
      if (!player?.id) {
        return null;
      }

      const stats = await loadPlayerStats(player.id);
      const legend = (stats.legends || []).find((entry) => Number(entry.legend_id) === legendId);

      if (!legend || Number(legend.games || 0) <= 0) {
        return null;
      }

      return {
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

    const filteredRows = rows
      .filter(Boolean)
      .sort((a, b) => Number(b.legendRating || 0) - Number(a.legendRating || 0) || Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, 50);

    renderRows(filteredRows);
    setStatus(`Showing ${filteredRows.length} ${name} players from the current top ${SCAN_PAGES * PAGE_SIZE} ranked 1v1 scan.`);
  } catch (error) {
    rankingsBody.innerHTML = `<tr><td colspan="8">Could not load rankings right now.</td></tr>`;
    setStatus(`${error.message}. Try refreshing in a minute.`);
  }
}

async function init() {
  try {
    const [legends, loadedLeaderboard] = await Promise.all([loadLegends(), loadLeaderboard()]);
    leaderboard = loadedLeaderboard;

    legendSelect.innerHTML = legends
      .map((legend) => `<option value="${escapeHtml(legend.legend_id)}">${escapeHtml(legend.legend_name)}</option>`)
      .join("");
    legendSelect.disabled = false;

    const defaultLegend = legends.find((legend) => legend.legend_name.toLowerCase() === "bodvar") || legends[0];
    if (defaultLegend) {
      legendSelect.value = defaultLegend.legend_id;
    }

    legendSelect.addEventListener("change", renderLegendRankings);
    await renderLegendRankings();
  } catch (error) {
    legendSelect.innerHTML = `<option>API unavailable</option>`;
    rankingsBody.innerHTML = `<tr><td colspan="8">Could not connect to the Brawlhalla API.</td></tr>`;
    setStatus(`${error.message}.`);
  }
}

init();
