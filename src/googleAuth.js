const { OAuth2Client } = require("google-auth-library");
const { getAppConfig } = require("./config");

const config = getAppConfig();
const oauthClient = new OAuth2Client(
  config.googleClientId,
  config.googleClientSecret,
  config.googleCallbackUrl
);

function buildGoogleAuthUrl(state) {
  return oauthClient.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account"
  });
}

async function exchangeCodeForProfile(code) {
  const { tokens } = await oauthClient.getToken(code);

  if (!tokens.id_token) {
    throw new Error("Google did not return an ID token.");
  }

  const ticket = await oauthClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: config.googleClientId
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.sub || !payload.email) {
    throw new Error("Google did not return the required profile fields.");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
    pictureUrl: payload.picture || null
  };
}

module.exports = {
  buildGoogleAuthUrl,
  exchangeCodeForProfile
};
