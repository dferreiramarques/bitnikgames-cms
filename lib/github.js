const { Octokit } = require("@octokit/rest");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function client() {
  return new Octokit({ auth: requireEnv("GITHUB_TOKEN") });
}

function target() {
  return {
    owner: requireEnv("GITHUB_OWNER"),
    repo: requireEnv("GITHUB_REPO"),
    branch: process.env.GITHUB_BRANCH || "main",
  };
}

// Lists files directly inside a directory (non-recursive). Returns [] if the
// directory doesn't exist yet instead of throwing, so a brand new collection
// folder isn't a hard error.
async function listDir(path) {
  const octo = client();
  const { owner, repo, branch } = target();
  try {
    const { data } = await octo.repos.getContent({ owner, repo, path, ref: branch });
    if (!Array.isArray(data)) return [];
    return data.filter((entry) => entry.type === "file");
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}

// Returns { content, sha } or null if the file doesn't exist.
async function getFile(path) {
  const octo = client();
  const { owner, repo, branch } = target();
  try {
    const { data } = await octo.repos.getContent({ owner, repo, path, ref: branch });
    if (Array.isArray(data) || data.type !== "file") return null;
    return { content: Buffer.from(data.content, "base64").toString("utf8"), sha: data.sha };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// Creates or updates a file. Pass `sha` (from getFile) when updating an
// existing file — GitHub rejects the write otherwise, which is the API's
// own built-in protection against clobbering a concurrent edit.
async function putFile(path, content, message, sha) {
  const octo = client();
  const { owner, repo, branch } = target();
  await octo.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    branch,
    content: Buffer.from(content, "utf8").toString("base64"),
    sha,
  });
}

async function deleteFile(path, message, sha) {
  const octo = client();
  const { owner, repo, branch } = target();
  await octo.repos.deleteFile({ owner, repo, path, message, branch, sha });
}

module.exports = { listDir, getFile, putFile, deleteFile, target };
