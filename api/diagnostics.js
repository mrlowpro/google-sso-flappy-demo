const { Pool } = require("pg");

function getBooleanEnv(name) {
  return Boolean(process.env[name]);
}

function getDatabaseSummary() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return {
      configured: false,
      host: null
    };
  }

  try {
    const parsed = new URL(connectionString);

    return {
      configured: true,
      host: parsed.hostname || null
    };
  } catch (error) {
    return {
      configured: true,
      host: "invalid-url"
    };
  }
}

module.exports = async function diagnostics(req, res) {
  const databaseUrl = process.env.DATABASE_URL;
  const shouldUseSsl =
    process.env.NODE_ENV === "production" ||
    (databaseUrl && databaseUrl.includes("sslmode=require")) ||
    (databaseUrl && databaseUrl.includes("neon.tech")) ||
    (databaseUrl && databaseUrl.includes("neon.com"));

  const result = {
    env: {
      DATABASE_URL: getBooleanEnv("DATABASE_URL"),
      GOOGLE_CALLBACK_URL: getBooleanEnv("GOOGLE_CALLBACK_URL"),
      GOOGLE_CLIENT_ID: getBooleanEnv("GOOGLE_CLIENT_ID"),
      GOOGLE_CLIENT_SECRET: getBooleanEnv("GOOGLE_CLIENT_SECRET"),
      SESSION_SECRET: getBooleanEnv("SESSION_SECRET")
    },
    database: {
      ...getDatabaseSummary(),
      ok: false,
      error: null
    }
  };

  if (!databaseUrl) {
    res.status(200).json(result);
    return;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000
  });

  try {
    await pool.query("SELECT 1");
    result.database.ok = true;
  } catch (error) {
    result.database.error = error.message;
  } finally {
    await pool.end().catch(() => {});
  }

  res.status(result.database.ok ? 200 : 500).json(result);
};
