const crypto = require("crypto");
const path = require("path");
const express = require("express");
const cookieSession = require("cookie-session");
const { getAppConfig } = require("./src/config");
const {
  createScore,
  initDatabase,
  findUserById,
  getGlobalLeaderboard,
  getUserBestRank,
  getUserBestScore,
  getUserRecentScores,
  getUserScoreStats,
  upsertGoogleUser
} = require("./src/db");
const { buildGoogleAuthUrl, exchangeCodeForProfile } = require("./src/googleAuth");
const {
  renderDashboardPage,
  renderLandingPage,
  renderGamePage,
  renderLeaderboardPage,
  renderErrorPage
} = require("./src/views");

const config = getAppConfig();
const app = express();
const startupState = {
  error: null,
  ready: false
};
const startupPromise = initDatabase()
  .then(() => {
    startupState.ready = true;
    console.log("Database schema is ready.");
  })
  .catch((error) => {
    startupState.error = error;
    console.error("Database startup failed:", error);
    throw error;
  });

app.set("trust proxy", 1);
// Vercel serves files from public/ at the root path, while local Express and Render
// still benefit from explicit static middleware. Exposing both paths keeps all
// environments working with the same templates.
app.use(express.static(path.join(config.projectRoot, "public")));
app.use("/static", express.static(path.join(config.projectRoot, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// cookie-session stores only small, non-sensitive values in the cookie.
app.use(
  cookieSession({
    name: "session",
    keys: [config.sessionSecret],
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000
  })
);

app.use((req, res, next) => {
  if (!req.session) {
    req.session = {};
  }

  next();
});

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get("/health", (req, res) => {
  res.status(startupState.error ? 503 : 200).json({
    ok: !startupState.error,
    startupReady: startupState.ready,
    startupError: startupState.error ? startupState.error.message : null
  });
});

app.use(
  asyncHandler(async (req, res, next) => {
    await startupPromise;
    next();
  })
);

function getSingleQueryValue(value) {
  return typeof value === "string" ? value : null;
}

function clampLimit(value, fallback, max = 50) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function requireAuthenticatedUser(req, res) {
  if (!req.currentUser) {
    res.status(401).json({ error: "You need to sign in with Google to do that." });
    return false;
  }

  return true;
}

function issuePlaySession(req) {
  const playToken = crypto.randomBytes(24).toString("hex");
  req.session.currentGame = {
    token: playToken,
    startedAt: Date.now()
  };

  return playToken;
}

async function getCurrentUser(req) {
  const userId = req.session?.userId;

  if (!userId) {
    return null;
  }

  const user = await findUserById(userId);

  if (!user) {
    req.session = null;
    return null;
  }

  return user;
}

async function loadDashboardModel(user) {
  const [stats, bestRank, recentScores, leaderboardPreview] = await Promise.all([
    getUserScoreStats(user.id),
    getUserBestRank(user.id),
    getUserRecentScores(user.id, 5),
    getGlobalLeaderboard(5)
  ]);

  return {
    bestRank,
    leaderboardPreview,
    recentScores,
    stats
  };
}

app.use(
  asyncHandler(async (req, res, next) => {
    req.currentUser = await getCurrentUser(req);
    next();
  })
);

app.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.currentUser;

    if (user) {
      const dashboardModel = await loadDashboardModel(user);
      res.send(renderDashboardPage(user, dashboardModel));
      return;
    }

    const leaderboardPreview = await getGlobalLeaderboard(5);
    res.send(renderLandingPage(leaderboardPreview));
  })
);

app.get("/auth/google", (req, res) => {
  const state = crypto.randomBytes(32).toString("hex");
  req.session.oauthState = state;
  res.redirect(buildGoogleAuthUrl(state));
});

app.get(
  "/auth/google/callback",
  asyncHandler(async (req, res) => {
    const oauthError = getSingleQueryValue(req.query.error);
    const code = getSingleQueryValue(req.query.code);
    const state = getSingleQueryValue(req.query.state);
    const expectedState = req.session.oauthState;
    delete req.session.oauthState;

    if (oauthError) {
      res.status(400).send(renderErrorPage(`Google sign-in failed: ${oauthError}`));
      return;
    }

    if (!code || !state) {
      res
        .status(400)
        .send(renderErrorPage("Missing OAuth callback parameters from Google."));
      return;
    }

    if (!expectedState || state !== expectedState) {
      res.status(400).send(renderErrorPage("Invalid OAuth state. Please try signing in again."));
      return;
    }

    const googleProfile = await exchangeCodeForProfile(code);
    const user = await upsertGoogleUser(googleProfile);

    req.session.userId = user.id;
    res.redirect("/dashboard");
  })
);

app.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const user = req.currentUser;

    if (!user) {
      res.redirect("/");
      return;
    }

    const dashboardModel = await loadDashboardModel(user);
    res.send(renderDashboardPage(user, dashboardModel));
  })
);

app.get("/profile", (req, res) => {
  res.redirect("/dashboard");
});

app.get(
  "/play",
  asyncHandler(async (req, res) => {
    const user = req.currentUser;
    const [leaderboardPreview, bestScore] = await Promise.all([
      getGlobalLeaderboard(10),
      user ? getUserBestScore(user.id) : Promise.resolve(null)
    ]);

    const playToken = user ? issuePlaySession(req) : null;

    res.send(
      renderGamePage({
        bestScore,
        leaderboardPreview,
        playToken,
        user
      })
    );
  })
);

app.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const user = req.currentUser;
    const [leaderboard, userStats, userRank, recentScores] = await Promise.all([
      getGlobalLeaderboard(20),
      user ? getUserScoreStats(user.id) : Promise.resolve({ bestScore: null, totalGames: 0 }),
      user ? getUserBestRank(user.id) : Promise.resolve(null),
      user ? getUserRecentScores(user.id, 5) : Promise.resolve([])
    ]);

    res.send(
      renderLeaderboardPage({
        leaderboard,
        recentScores,
        user,
        userRank,
        userStats
      })
    );
  })
);

app.get(
  "/api/leaderboard",
  asyncHandler(async (req, res) => {
    const limit = clampLimit(req.query.limit, 10, 20);
    const leaderboard = await getGlobalLeaderboard(limit);
    res.json({ leaderboard });
  })
);

app.get(
  "/api/me/best-score",
  asyncHandler(async (req, res) => {
    if (!requireAuthenticatedUser(req, res)) {
      return;
    }

    const [stats, bestRank] = await Promise.all([
      getUserScoreStats(req.currentUser.id),
      getUserBestRank(req.currentUser.id)
    ]);

    res.json({
      bestRank,
      bestScore: stats.bestScore,
      totalGames: stats.totalGames
    });
  })
);

app.post(
  "/api/game/session",
  asyncHandler(async (req, res) => {
    if (!requireAuthenticatedUser(req, res)) {
      return;
    }

    const playToken = issuePlaySession(req);
    res.json({ playToken });
  })
);

app.post(
  "/api/scores",
  asyncHandler(async (req, res) => {
    if (!requireAuthenticatedUser(req, res)) {
      return;
    }

    const score = Number.parseInt(req.body?.score, 10);
    const playToken = typeof req.body?.playToken === "string" ? req.body.playToken : "";
    const currentGame = req.session.currentGame;

    if (!Number.isInteger(score) || score <= 0 || score > 9999) {
      res.status(400).json({ error: "Score must be a whole number between 1 and 9999." });
      return;
    }

    if (!currentGame || !currentGame.token || playToken !== currentGame.token) {
      res.status(400).json({ error: "The current run is no longer valid. Start a new game and try again." });
      return;
    }

    const elapsedMs = Date.now() - Number(currentGame.startedAt || 0);
    const minimumRunMs = Math.max(2500, score * 400);

    if (!Number.isFinite(elapsedMs) || elapsedMs < minimumRunMs) {
      res.status(400).json({
        error: "That score was submitted too quickly to be accepted. Please finish another run."
      });
      return;
    }

    delete req.session.currentGame;

    const savedScore = await createScore(req.currentUser.id, score);
    const [personalBest, stats, leaderboard] = await Promise.all([
      getUserBestScore(req.currentUser.id),
      getUserScoreStats(req.currentUser.id),
      getGlobalLeaderboard(10)
    ]);

    res.status(201).json({
      leaderboard,
      message: "Score saved successfully.",
      personalBest,
      savedScore,
      totalGames: stats.totalGames
    });
  })
);

app.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/");
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    next(error);
    return;
  }

  res.status(500).send(renderErrorPage(error.message || "Unexpected server error."));
});

if (require.main === module) {
  startupPromise
    .then(() => {
      app.listen(config.port, () => {
        console.log(`Server running on http://localhost:${config.port}`);
      });
    })
    .catch((error) => {
      console.error("Failed to start the app:", error);
      process.exit(1);
    });
}

module.exports = app;
