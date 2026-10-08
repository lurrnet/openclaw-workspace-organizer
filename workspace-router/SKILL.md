---
name: workspace-router
description: Resolve and follow Discord-to-workspace routing for persistent channel-specific work. Use when an OpenClaw agent is handling a Discord guild channel or thread and must decide where files, notes, reports, scripts, or other persistent artifacts belong. The companion discord-workspace-router plugin normally injects the resolved route automatically; this skill defines how the agent should obey that route and how to behave when routing is unresolved.
---

# Workspace Router

Use the Discord workspace route injected by the `discord-workspace-router` plugin as the authoritative logical working directory for channel-specific persistent work.

## Rules

1. If the prompt contains a `Discord Workspace Context` block, use its `Persistent workspace directory` as the default project directory.
2. Read `<route>/README.md` when it exists and the task depends on project context.
3. Keep channel-specific files under the resolved route. Do not place them in the workspace root.
4. Discord threads inherit the parent channel route unless the user explicitly requests a different subdirectory.
5. Keep agent-level files at workspace root: `AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, `memory/`, `_system/`, and `skills/`.
6. If a `Discord Workspace Routing Warning` says routing is unresolved, do not guess a persistent path. Avoid creating channel-specific persistent files until the route is resolved.
7. Treat `_system/discord-channel-map.yaml` as the canonical persistent mapping. Do not silently remap an existing channel to another path.
8. Discord display-name changes do not imply filesystem renames. Preserve the existing mapped path unless the user explicitly requests a migration.

See `references/schema.md` for the mapping schema and `references/plugin-behavior.md` for plugin behavior.
