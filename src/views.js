function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function serializeForScript(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function formatDateTime(value) {
  if (!value) {
    return "Just now";
  }

  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function renderAvatar(name, pictureUrl, sizeClass = "") {
  const className = ["avatar", sizeClass].filter(Boolean).join(" ");

  if (pictureUrl) {
    return `<img class="${escapeHtml(className)}" src="${escapeHtml(pictureUrl)}" alt="Profile picture for ${escapeHtml(name)}" />`;
  }

  const initials = String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return `<div class="${escapeHtml(`${className} avatar-fallback`)}" aria-hidden="true">${escapeHtml(initials || "?")}</div>`;
}

function renderNav(user, activeNav) {
  const links = user
    ? `
      <a class="nav-link ${activeNav === "dashboard" ? "active" : ""}" href="/dashboard">Dashboard</a>
      <a class="nav-link ${activeNav === "play" ? "active" : ""}" href="/play">Play</a>
      <a class="nav-link ${activeNav === "leaderboard" ? "active" : ""}" href="/leaderboard">Leaderboard</a>
    `
    : `
      <a class="nav-link ${activeNav === "leaderboard" ? "active" : ""}" href="/leaderboard">Leaderboard</a>
      <a class="nav-link ${activeNav === "play" ? "active" : ""}" href="/play">Try the Game</a>
    `;

  const authSection = user
    ? `
      <div class="nav-user">
        ${renderAvatar(user.name, user.picture_url, "avatar-small")}
        <div class="nav-user-copy">
          <strong>${escapeHtml(user.name)}</strong>
          <span>${escapeHtml(user.email)}</span>
        </div>
      </div>
      <form method="post" action="/logout">
        <button type="submit" class="button button-ghost">Logout</button>
      </form>
    `
    : `
      <a class="button button-primary" href="/auth/google">Sign in with Google</a>
    `;

  return `
    <header class="site-header">
      <div class="shell header-shell">
        <a class="brand" href="/">
          <span class="brand-mark">SH</span>
          <span class="brand-copy">
            <strong>Sky Hopper</strong>
            <span>Google login + mini game demo</span>
          </span>
        </a>
        <nav class="site-nav" aria-label="Primary navigation">
          ${links}
        </nav>
        <div class="header-actions">
          ${authSection}
        </div>
      </div>
    </header>
  `;
}

function renderLayout({ title, body, user = null, activeNav = "dashboard", pageData = null, pageScript = null }) {
  const pageDataScript = pageData
    ? `<script id="page-data" type="application/json">${serializeForScript(pageData)}</script>`
    : "";
  const pageScriptTag = pageScript ? `<script src="${escapeHtml(pageScript)}" defer></script>` : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="page-shell">
      ${renderNav(user, activeNav)}
      <main class="main-content">
        ${body}
      </main>
      <footer class="site-footer">
        <div class="shell footer-shell">
          <span>Built with Express, Google SSO, PostgreSQL, and a lightweight Canvas game.</span>
          <span>Simple enough for a demo, polished enough to feel like a product.</span>
        </div>
      </footer>
    </div>
    ${pageDataScript}
    ${pageScriptTag}
  </body>
</html>`;
}

function renderLeaderboardItems(scores, emptyMessage) {
  if (!scores.length) {
    return `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
  }

  return `
    <div class="leaderboard-list">
      ${scores
        .map(
          (entry, index) => `
            <div class="leaderboard-item">
              <div class="leaderboard-rank">#${index + 1}</div>
              <div class="leaderboard-player">
                ${renderAvatar(entry.name, entry.picture_url, "avatar-small")}
                <div>
                  <strong>${escapeHtml(entry.name)}</strong>
                  <span>${escapeHtml(formatDateTime(entry.created_at))}</span>
                </div>
              </div>
              <div class="leaderboard-score">${escapeHtml(entry.score)}</div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderRecentScoreItems(scores, emptyMessage) {
  if (!scores.length) {
    return `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
  }

  return `
    <div class="score-history">
      ${scores
        .map(
          (entry) => `
            <div class="score-history-item">
              <strong>${escapeHtml(entry.score)} pts</strong>
              <span>${escapeHtml(formatDateTime(entry.created_at))}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderLandingPage(leaderboardPreview) {
  return renderLayout({
    title: "Sky Hopper",
    activeNav: "dashboard",
    body: `
      <section class="shell hero-section">
        <div class="hero-card hero-card-wide">
          <div class="eyebrow">Google login + browser game</div>
          <h1>Turn your existing SSO demo into a polished little game product.</h1>
          <p class="lead">
            Sky Hopper keeps your Google sign-in flow, stores user scores in PostgreSQL,
            and adds a lightweight Flappy Bird style game with a real leaderboard.
          </p>
          <div class="hero-actions">
            <a class="button button-primary" href="/auth/google">Sign in with Google</a>
            <a class="button button-secondary" href="/leaderboard">View leaderboard</a>
            <a class="button button-ghost" href="/play">Try the game first</a>
          </div>
          <div class="feature-grid">
            <article class="feature-card">
              <h2>Existing auth kept intact</h2>
              <p>Google SSO, sessions, and user records stay exactly where they belong.</p>
            </article>
            <article class="feature-card">
              <h2>Canvas mini game</h2>
              <p>Simple controls, fast load time, and no heavy frontend framework required.</p>
            </article>
            <article class="feature-card">
              <h2>Real score tracking</h2>
              <p>Every saved score is attached to an authenticated user and ranked globally.</p>
            </article>
          </div>
        </div>
        <aside class="panel-card">
          <div class="section-heading">
            <h2>Top pilots</h2>
            <p>Recent high scores from the live leaderboard.</p>
          </div>
          ${renderLeaderboardItems(leaderboardPreview, "No scores yet. Be the first to set the pace.")}
        </aside>
      </section>
    `
  });
}

function renderDashboardPage(user, { stats, bestRank, recentScores, leaderboardPreview }) {
  return renderLayout({
    title: "Dashboard",
    user,
    activeNav: "dashboard",
    body: `
      <section class="shell page-section">
        <div class="hero-card">
          <div class="eyebrow">Welcome back</div>
          <h1>${escapeHtml(user.name)}, your next run is ready.</h1>
          <p class="lead">
            Jump straight into the game, track your personal best, and see how you stack up on the global leaderboard.
          </p>
          <div class="hero-actions">
            <a class="button button-primary" href="/play">Play Sky Hopper</a>
            <a class="button button-secondary" href="/leaderboard">Open leaderboard</a>
          </div>
        </div>
      </section>

      <section class="shell dashboard-grid">
        <article class="panel-card profile-card">
          <div class="profile-summary">
            ${renderAvatar(user.name, user.picture_url)}
            <div>
              <h2>${escapeHtml(user.name)}</h2>
              <p>${escapeHtml(user.email)}</p>
            </div>
          </div>
          <div class="data-list">
            <div>
              <span class="label">Google account ID</span>
              <strong>${escapeHtml(user.google_id)}</strong>
            </div>
            <div>
              <span class="label">Joined</span>
              <strong>${escapeHtml(formatDateTime(user.created_at))}</strong>
            </div>
            <div>
              <span class="label">Last sign in</span>
              <strong>${escapeHtml(formatDateTime(user.last_login_at))}</strong>
            </div>
          </div>
        </article>

        <article class="panel-card stat-card">
          <span class="label">Personal best</span>
          <strong class="stat-value">${stats.bestScore ?? "No score yet"}</strong>
          <p>Finish a clean run to save a score tied to your Google account.</p>
        </article>

        <article class="panel-card stat-card">
          <span class="label">Games saved</span>
          <strong class="stat-value">${stats.totalGames}</strong>
          <p>Each valid game over creates a score record in the database.</p>
        </article>

        <article class="panel-card stat-card">
          <span class="label">Best rank</span>
          <strong class="stat-value">${bestRank ? `#${bestRank}` : "Unranked"}</strong>
          <p>Your ranking is based on the best score you have posted so far.</p>
        </article>

        <article class="panel-card">
          <div class="section-heading">
            <h2>Your recent runs</h2>
            <p>Saved score history for the current account.</p>
          </div>
          ${renderRecentScoreItems(recentScores, "You have not saved any scores yet. Play a round to populate this list.")}
        </article>

        <article class="panel-card">
          <div class="section-heading">
            <h2>Leaderboard preview</h2>
            <p>The current top players across the whole app.</p>
          </div>
          ${renderLeaderboardItems(leaderboardPreview, "No leaderboard entries yet.")}
        </article>
      </section>
    `
  });
}

function renderGamePage({ user, bestScore, leaderboardPreview, playToken }) {
  const authNotice = user
    ? `
      <div class="callout success">
        Scores from this page will be saved automatically after a valid game over.
      </div>
    `
    : `
      <div class="callout">
        You can play as a guest, but you need to <a href="/auth/google">sign in with Google</a> before a score can be saved.
      </div>
    `;

  return renderLayout({
    title: "Play Sky Hopper",
    user,
    activeNav: "play",
    pageData: {
      bestScore,
      canSaveScore: Boolean(user),
      leaderboard: leaderboardPreview,
      playToken,
      scoreSubmissionUrl: "/api/scores",
      sessionUrl: "/api/game/session"
    },
    pageScript: "/game.js",
    body: `
      <section class="shell page-section">
        <div class="section-heading">
          <div>
            <div class="eyebrow">Mini game</div>
            <h1>Sky Hopper</h1>
            <p class="lead">Press <strong>space</strong>, click, or tap to flap upward. Avoid every pipe and keep your run alive.</p>
          </div>
          <a class="button button-secondary" href="/leaderboard">View leaderboard</a>
        </div>
      </section>

      <section class="shell play-grid">
        <article class="panel-card game-panel">
          <div class="game-toolbar">
            <div>
              <span class="label">Current score</span>
              <strong id="current-score">0</strong>
            </div>
            <div>
              <span class="label">Personal best</span>
              <strong id="best-score">${bestScore ?? "No score yet"}</strong>
            </div>
            <div>
              <span class="label">Save status</span>
              <strong id="save-status">${user ? "Ready to save" : "Guest mode"}</strong>
            </div>
          </div>

          <div class="game-stage">
            <canvas id="game-canvas" width="480" height="640" aria-label="Sky Hopper game canvas"></canvas>
            <div class="game-overlay" id="game-overlay">
              <div class="overlay-card">
                <span class="eyebrow">Ready</span>
                <h2 id="overlay-title">Press play to start</h2>
                <p id="overlay-copy">Keep the bird airborne and fly through the gaps.</p>
                <div class="overlay-stats">
                  <div>
                    <span class="label">Score</span>
                    <strong id="overlay-score">0</strong>
                  </div>
                  <div>
                    <span class="label">Best</span>
                    <strong id="overlay-best">${bestScore ?? "No score yet"}</strong>
                  </div>
                </div>
                <div class="hero-actions">
                  <button type="button" class="button button-primary" id="play-again-button">Play now</button>
                  <a class="button button-ghost" href="/leaderboard">Leaderboard</a>
                </div>
              </div>
            </div>
          </div>

          ${authNotice}

          <div class="instruction-list">
            <div>
              <span class="label">Controls</span>
              <strong>Space, click, or tap</strong>
            </div>
            <div>
              <span class="label">Goal</span>
              <strong>Pass pipes to increase your score</strong>
            </div>
            <div>
              <span class="label">Tip</span>
              <strong>Use short, rhythmic flaps instead of holding</strong>
            </div>
          </div>
        </article>

        <aside class="sidebar-stack">
          <article class="panel-card">
            <div class="section-heading">
              <h2>Live leaderboard</h2>
              <p>Top saved runs across all players.</p>
            </div>
            <div id="game-leaderboard">
              ${renderLeaderboardItems(leaderboardPreview, "No scores yet.")}
            </div>
          </article>
        </aside>
      </section>
    `
  });
}

function renderLeaderboardTable(leaderboard) {
  if (!leaderboard.length) {
    return `<div class="empty-state">No scores yet. Play a round and become the first ranked player.</div>`;
  }

  return `
    <div class="leaderboard-table-wrap">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Score</th>
            <th>Achieved</th>
          </tr>
        </thead>
        <tbody>
          ${leaderboard
            .map(
              (entry, index) => `
                <tr>
                  <td>#${index + 1}</td>
                  <td>
                    <div class="table-player">
                      ${renderAvatar(entry.name, entry.picture_url, "avatar-small")}
                      <span>${escapeHtml(entry.name)}</span>
                    </div>
                  </td>
                  <td><strong>${escapeHtml(entry.score)}</strong></td>
                  <td>${escapeHtml(formatDateTime(entry.created_at))}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderLeaderboardPage({ user, userStats, userRank, leaderboard, recentScores }) {
  const summaryCard = user
    ? `
      <article class="panel-card">
        <div class="section-heading">
          <h2>Your standing</h2>
          <p>A quick snapshot for the account currently signed in.</p>
        </div>
        <div class="stats-inline">
          <div>
            <span class="label">Best score</span>
            <strong>${userStats.bestScore ?? "No score yet"}</strong>
          </div>
          <div>
            <span class="label">Best rank</span>
            <strong>${userRank ? `#${userRank}` : "Unranked"}</strong>
          </div>
          <div>
            <span class="label">Saved runs</span>
            <strong>${userStats.totalGames}</strong>
          </div>
        </div>
      </article>
    `
    : `
      <article class="panel-card">
        <div class="section-heading">
          <h2>Want to join the leaderboard?</h2>
          <p>Guest players can try the game, but only signed-in players can save scores.</p>
        </div>
        <a class="button button-primary" href="/auth/google">Sign in with Google</a>
      </article>
    `;

  return renderLayout({
    title: "Leaderboard",
    user,
    activeNav: "leaderboard",
    body: `
      <section class="shell page-section">
        <div class="section-heading">
          <div>
            <div class="eyebrow">Leaderboard</div>
            <h1>Top runs across all players</h1>
            <p class="lead">The leaderboard ranks the highest saved scores, with earlier runs winning ties.</p>
          </div>
          <a class="button button-secondary" href="/play">Play now</a>
        </div>
      </section>

      <section class="shell leaderboard-grid">
        <article class="panel-card leaderboard-main">
          ${renderLeaderboardTable(leaderboard)}
        </article>
        <aside class="sidebar-stack">
          ${summaryCard}
          <article class="panel-card">
            <div class="section-heading">
              <h2>Your recent saves</h2>
              <p>Most recent runs saved under your account.</p>
            </div>
            ${renderRecentScoreItems(recentScores, "No recent scores to show yet.")}
          </article>
        </aside>
      </section>
    `
  });
}

function renderErrorPage(message) {
  return renderLayout({
    title: "Something Went Wrong",
    body: `
      <section class="shell centered-shell">
        <article class="panel-card narrow-card">
          <div class="section-heading">
            <h1>Something went wrong</h1>
            <p class="error-message">${escapeHtml(message)}</p>
          </div>
          <div class="hero-actions">
            <a class="button button-secondary" href="/">Back to home</a>
          </div>
        </article>
      </section>
    `
  });
}

module.exports = {
  renderDashboardPage,
  renderLandingPage,
  renderGamePage,
  renderLeaderboardPage,
  renderErrorPage
};
