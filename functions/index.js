const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

const DISCORD_CLIENT_SECRET = defineSecret("DISCORD_CLIENT_SECRET");
const DISCORD_CLIENT_ID = "1537015896814522419";
const REDIRECT_URI = "https://awehhab.github.io/vampir-koylu/vampir_koylu.html";

exports.discordLogin = onCall(
  { secrets: [DISCORD_CLIENT_SECRET], region: "europe-west1" },
  async (request) => {
    const code = request.data && request.data.code;
    if (!code) {
      throw new HttpsError("invalid-argument", "code eksik");
    }

    // 1) authorization code -> access_token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET.value(),
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) {
      throw new HttpsError("internal", "Discord token alinamadi");
    }
    const tokenData = await tokenRes.json();

    // 2) access_token -> discord profili
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
      throw new HttpsError("internal", "Discord profili alinamadi");
    }
    const user = await userRes.json();

    const uid = `discord:${user.id}`;
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number(user.discriminator || "0") % 5}.png`;
    const displayName = user.global_name || user.username;

    // 3) Firebase Auth kullanicisini olustur/guncelle
    try {
      await admin.auth().updateUser(uid, { displayName, photoURL: avatarUrl });
    } catch (e) {
      await admin.auth().createUser({ uid, displayName, photoURL: avatarUrl });
    }

    // 4) custom token uret, frontend bununla signInWithCustomToken yapacak
    const customToken = await admin.auth().createCustomToken(uid, {
      discordId: user.id,
      username: user.username,
    });

    return {
      token: customToken,
      profile: { displayName, avatarUrl, discordId: user.id },
    };
  }
);
