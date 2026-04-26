// Netlify serverless function — receives data from the admin panel,
// commits it to GitHub as data.json. The GitHub token lives in Netlify's
// environment variables (set in Site Configuration → Environment Variables),
// so it is never exposed to browsers.

const GITHUB_OWNER  = "HanifZZ";
const GITHUB_REPO   = "KCBY-Coppell-Test-Website";
const GITHUB_BRANCH = "main";
const GITHUB_FILE   = "data.json";

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { statusCode: 500, body: "GITHUB_TOKEN env variable not set in Netlify" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON body" };
  }
  if (!payload.data) {
    return { statusCode: 400, body: "Missing data field" };
  }

  const apiBase = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`;
  const headers = {
    "Authorization": "Bearer " + token,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "kcby-site"
  };

  try {
    // 1. Get current file SHA (required to update existing files)
    let sha = null;
    const getRes = await fetch(`${apiBase}?ref=${GITHUB_BRANCH}`, { headers });
    if (getRes.ok) {
      const info = await getRes.json();
      sha = info.sha;
    }

    // 2. Encode JSON as base64 (UTF-8 safe)
    const json = JSON.stringify(payload.data, null, 2);
    const b64 = Buffer.from(json, "utf-8").toString("base64");

    // 3. Commit
    const body = {
      message: `Update site content via admin (${new Date().toISOString().slice(0, 16).replace("T", " ")})`,
      content: b64,
      branch: GITHUB_BRANCH
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(apiBase, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!putRes.ok) {
      const errBody = await putRes.text();
      return { statusCode: putRes.status, body: "GitHub API error: " + errBody };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: "Server error: " + err.message };
  }
};
