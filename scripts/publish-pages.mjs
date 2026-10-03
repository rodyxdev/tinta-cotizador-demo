import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

// Publish only the build, keeping the source checkout and its index untouched.
const root = process.cwd();
const output = resolve(root, "dist");
const git = (args, env = process.env) =>
  execFileSync("git", args, {
    cwd: root,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
if (!existsSync(join(output, "index.html")))
  throw new Error("Run npm run build before publishing.");
if (git(["status", "--porcelain"]))
  throw new Error("Commit source changes before publishing.");
const source = git(["rev-parse", "HEAD"]);
const remote = git(["remote", "get-url", "origin"]);
if (
  !/^(https:\/\/github\.com\/|git@github\.com:)[\w.-]+\/[\w.-]+(?:\.git)?$/.test(
    remote,
  )
)
  throw new Error("An explicit GitHub origin is required.");
writeFileSync(join(output, ".nojekyll"), "");
const index = join(tmpdir(), `tinta-pages-${randomUUID()}.index`);
const env = { ...process.env, GIT_INDEX_FILE: index };
try {
  const existing = git(["ls-remote", "--heads", "origin", "gh-pages"]);
  let parent;
  if (existing) {
    git(["fetch", "--no-tags", "origin", "gh-pages"]);
    parent = git(["rev-parse", "FETCH_HEAD"]);
  }
  git([`--work-tree=${output}`, "add", "--all", "--force"], env);
  const tree = git(["write-tree"], env);
  const files = git(["ls-tree", "-r", "--name-only", tree]).split("\n");
  if (
    files.some(
      (file) =>
        !/^(?:index\.html|favicon\.svg|\.nojekyll|assets\/[^\r\n]+|designs\/[^\r\n]+)$/.test(
          file,
        ),
    )
  )
    throw new Error("The publication tree must contain only compiled assets.");
  const commit = git([
    "commit-tree",
    tree,
    ...(parent ? ["-p", parent] : []),
    "-m",
    `Publica la demo compilada desde ${source}`,
  ]);
  git(["update-ref", "refs/heads/gh-pages", commit]);
  git(["push", "origin", "gh-pages"]);
  console.log(
    JSON.stringify({ sourceCommit: source, pagesCommit: commit, remote }),
  );
} finally {
  if (existsSync(index)) unlinkSync(index);
}
