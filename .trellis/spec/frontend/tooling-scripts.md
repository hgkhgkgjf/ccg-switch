# Tooling Scripts

> Contracts for Node.js automation scripts under `scripts/`.

---

## Scenario: Windows-Safe Release Commands

### 1. Scope / Trigger

- Trigger: Node.js release tooling invokes Git, npm, Cargo, and other CLIs from
  JavaScript.
- Applies to: `scripts/release.js` and tests under `scripts/*.test.js`.

### 2. Signatures

```javascript
resolveSpawnCommand(command, args) -> { command: string, args: string[] }
createVersionCommit(version, runner = run) -> void
```

### 3. Contracts

- Git commands must be passed as argv arrays with `shell: false`.
- Commit messages containing spaces must not depend on shell quoting. Use a
  temporary message file and `git commit -F <message-file>`.
- On Windows, npm commands may be routed through:

```javascript
cmd.exe /d /s /c npm <args...>
```

  This is the targeted fallback for npm resolution; it is not permission to put
  every command behind a shell.
- Temporary commit/tag message files must be deleted in `finally`.

### 4. Validation & Error Matrix

- `git commit -m chore: bump version to 1.6.5` without preserved quoting ->
  Git parses `bump`, `version`, `to`, and `1.6.5` as pathspecs.
- `spawnSync("npm.cmd", args, { shell: false })` on Windows may fail with
  `EINVAL`.
- `spawnSync(command, args, { shell: true })` for all commands can reintroduce
  argument splitting and Node shell-args warnings.

### 5. Good / Base / Bad Cases

- Good: `git commit -F tempMessageFile`, with the file containing exactly one
  newline-terminated commit message.
- Base: `npm test` resolves through `cmd.exe` on Windows and unchanged `npm`
  elsewhere.
- Bad: passing a spaced commit message through global `shell: true`.

### 6. Tests Required

- Regression test `createVersionCommit()` to assert:
  - runner receives `git commit -F <message-file>`;
  - message file content matches the intended commit message;
  - message file is removed after the call.
- Regression test `resolveSpawnCommand()` to assert Windows npm fallback and
  non-Windows no-op behavior.

### 7. Wrong vs Correct

#### Wrong

```javascript
spawnSync("git", ["commit", "-m", "chore: bump version to 1.6.5"], {
  shell: process.platform === "win32",
});
```

#### Correct

```javascript
const tempPath = writeCommitMessage("chore: bump version to 1.6.5\n");
try {
  spawnSync("git", ["commit", "-F", tempPath], { shell: false });
} finally {
  fs.rmSync(tempPath, { force: true });
}
```
