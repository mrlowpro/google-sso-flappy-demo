const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getBaseConfig() {
  const nodeEnv = process.env.NODE_ENV || "development";

  return {
    port: Number(process.env.PORT || 3000),
    nodeEnv,
    isProduction: nodeEnv === "production",
    databaseUrl: requireEnv("DATABASE_URL"),
    projectRoot: path.resolve(__dirname, ".."),
    renderExternalUrl: process.env.RENDER_EXTERNAL_URL || "",
    vercelProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || ""
  };
}

function getGoogleCallbackUrl(base) {
  const explicitCallbackUrl = process.env.GOOGLE_CALLBACK_URL;

  if (explicitCallbackUrl) {
    return explicitCallbackUrl;
  }

  if (base.isProduction && base.renderExternalUrl) {
    return `${base.renderExternalUrl}/auth/google/callback`;
  }

  if (base.isProduction && base.vercelProductionUrl) {
    return `https://${base.vercelProductionUrl}/auth/google/callback`;
  }

  throw new Error(
    "Missing required environment variable: GOOGLE_CALLBACK_URL. In production, this can also be derived automatically from Render or Vercel system URLs."
  );
}

function getAppConfig() {
  const base = getBaseConfig();

  return {
    ...base,
    googleClientId: requireEnv("GOOGLE_CLIENT_ID"),
    googleClientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    googleCallbackUrl: getGoogleCallbackUrl(base),
    sessionSecret: requireEnv("SESSION_SECRET")
  };
}

module.exports = {
  getBaseConfig,
  getAppConfig
};
