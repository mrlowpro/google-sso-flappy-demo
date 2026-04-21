const fs = require("fs/promises");
const path = require("path");
const { Pool } = require("pg");
const { getBaseConfig } = require("./config");

const config = getBaseConfig();
const databaseUrl = config.databaseUrl;
const shouldUseSsl =
  config.isProduction ||
  databaseUrl.includes("sslmode=require") ||
  databaseUrl.includes("neon.tech") ||
  databaseUrl.includes("neon.com");

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
  const sqlPath = path.join(config.projectRoot, "db", "init.sql");
  const schemaSql = await fs.readFile(sqlPath, "utf8");
  await pool.query(schemaSql);
}

async function findUserById(id) {
  const result = await pool.query(
    `SELECT id, google_id, email, name, picture_url, created_at, last_login_at
     FROM users
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

async function upsertGoogleUser({ googleId, email, name, pictureUrl }) {
  const result = await pool.query(
    `INSERT INTO users (google_id, email, name, picture_url, created_at, last_login_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (google_id)
     DO UPDATE
       SET email = EXCLUDED.email,
           name = EXCLUDED.name,
           picture_url = EXCLUDED.picture_url,
           last_login_at = NOW()
     RETURNING id, google_id, email, name, picture_url, created_at, last_login_at`,
    [googleId, email, name, pictureUrl]
  );

  return result.rows[0];
}

function normalizeScoreRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    score: Number(row.score),
    created_at: row.created_at,
    name: row.name,
    picture_url: row.picture_url
  };
}

async function createScore(userId, score) {
  const result = await pool.query(
    `INSERT INTO scores (user_id, score, created_at)
     VALUES ($1, $2, NOW())
     RETURNING id, user_id, score, created_at`,
    [userId, score]
  );

  return normalizeScoreRow(result.rows[0]);
}

async function getGlobalLeaderboard(limit = 10) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
  const result = await pool.query(
    `SELECT s.id, s.user_id, s.score, s.created_at, u.name, u.picture_url
     FROM scores s
     INNER JOIN users u ON u.id = s.user_id
     ORDER BY s.score DESC, s.created_at ASC
     LIMIT $1`,
    [safeLimit]
  );

  return result.rows.map(normalizeScoreRow);
}

async function getUserBestScore(userId) {
  const result = await pool.query(
    `SELECT MAX(score) AS best_score
     FROM scores
     WHERE user_id = $1`,
    [userId]
  );

  const bestScore = result.rows[0]?.best_score;
  return bestScore === null || bestScore === undefined ? null : Number(bestScore);
}

async function getUserScoreStats(userId) {
  const result = await pool.query(
    `SELECT MAX(score) AS best_score, COUNT(*)::int AS total_games
     FROM scores
     WHERE user_id = $1`,
    [userId]
  );

  const row = result.rows[0] || {};

  return {
    bestScore:
      row.best_score === null || row.best_score === undefined ? null : Number(row.best_score),
    totalGames: Number(row.total_games || 0)
  };
}

async function getUserRecentScores(userId, limit = 5) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 5, 20));
  const result = await pool.query(
    `SELECT s.id, s.user_id, s.score, s.created_at, u.name, u.picture_url
     FROM scores s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC
     LIMIT $2`,
    [userId, safeLimit]
  );

  return result.rows.map(normalizeScoreRow);
}

async function getUserBestRank(userId) {
  const result = await pool.query(
    `WITH best_scores AS (
       SELECT user_id, MAX(score) AS best_score
       FROM scores
       GROUP BY user_id
     ),
     ranked_scores AS (
       SELECT user_id,
              best_score,
              DENSE_RANK() OVER (ORDER BY best_score DESC) AS rank
       FROM best_scores
     )
     SELECT rank
     FROM ranked_scores
     WHERE user_id = $1`,
    [userId]
  );

  const rank = result.rows[0]?.rank;
  return rank === null || rank === undefined ? null : Number(rank);
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  createScore,
  initDatabase,
  getGlobalLeaderboard,
  getUserBestRank,
  getUserBestScore,
  getUserRecentScores,
  getUserScoreStats,
  findUserById,
  upsertGoogleUser,
  closeDatabase
};
