## Discord Workspace Routing

Discord-based persistent work is organized through the `discord-workspace-router` plugin and `workspace-router` skill.

- Use the plugin-injected Discord workspace route as the default location for channel-specific persistent files.
- Read the routed channel directory's `README.md` when relevant.
- Discord threads inherit their parent channel directory unless explicitly configured otherwise.
- Do not place channel-specific files in the workspace root when a route exists.
- Agent-level files (`AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, `memory/`, `_system/`, and `skills/`) remain at the workspace root.
- If routing is unresolved, do not guess a persistent destination path.
