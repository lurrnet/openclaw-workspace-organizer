# OpenClaw Workspace Organizer

Automatically organize an OpenClaw agent workspace to mirror your Discord **category / channel** structure.

This repository provides a Discord-aware workspace organizer for OpenClaw multi-agent setups:

- A native OpenClaw plugin that resolves Discord metadata through the Discord REST API.
- A workspace skill that tells the agent how to obey the resolved route.
- Example OpenClaw configuration and `AGENTS.md` routing policy.
- Lazy, first-use registration: you do **not** need to manually maintain channel IDs in YAML.

## How it works

```text
Discord message
    |
    v
message_received hook
    |
    +-- current channel ID
    |
    v
Discord REST API
    |
    +-- channel name
    +-- parent_id -> category ID/name
    +-- guild ID/name
    |
    v
_system/discord-channel-map.yaml
    |
    +-- auto-register on first use
    +-- create category/channel folder
    +-- create README.md
    |
    v
before_prompt_build hook
    |
    v
Inject persistent workspace directory into the agent turn
```

For example:

```text
Discord
Projects
└── #example-project

OpenClaw workspace
Projects/
└── example-project/
    └── README.md
```

Discord threads inherit the parent channel directory rather than creating a new folder.

## Safety behavior

- Discord renames update display names in the mapping, but do not rename filesystem paths automatically.
- Moving a channel to another Discord category does not silently move existing files.
- Workspace paths are validated to prevent traversal outside the configured workspace.
- Bot tokens are read from the Gateway environment and are not written to the mapping file or channel README.
- The plugin can be restricted to one agent, such as `main`.

## Repository layout

```text
.
├── INSTALL.md
├── config-snippets/
│   ├── AGENTS-routing.md
│   ├── discord-channel-map.yaml
│   └── openclaw-plugin-entry.json
├── workspace-router-plugin/
│   ├── index.js
│   ├── openclaw.plugin.json
│   ├── package.json
│   └── README.md
└── workspace-router/
    ├── SKILL.md
    ├── agents/openai.yaml
    └── references/
```

## Quick install

Install the workspace skill:

```bash
mkdir -p ~/.openclaw/workspace/skills
cp -R workspace-router ~/.openclaw/workspace/skills/
```

Install and enable the plugin:

```bash
npm install --prefix workspace-router-plugin
openclaw plugins install --link ./workspace-router-plugin --force
openclaw plugins enable discord-workspace-router
```

Merge `config-snippets/openclaw-plugin-entry.json` into your existing OpenClaw config, then make sure the Discord bot token environment variable is available to the **Gateway process**.

```bash
DISCORD_BOT_TOKEN=...
```

Restart and inspect:

```bash
openclaw gateway restart
openclaw plugins inspect discord-workspace-router --runtime --json
```

A healthy runtime should show the plugin as `loaded` / `activated` and list two typed hooks:

- `message_received`
- `before_prompt_build`

See [INSTALL.md](INSTALL.md) for the complete setup and test procedure.

## Mapping schema

The generated mapping keeps stable Discord IDs while preserving the category/channel hierarchy:

```yaml
version: 1

guilds:
  "123456789012345678":
    name: "My Discord Server"
    categories:
      "111111111111111111":
        name: "Projects"
        path: "Projects"
        channels:
          "222222222222222222":
            name: "example-project"
            path: "Projects/example-project"
            enabled: true
```

Normally you do not need to populate this manually; the plugin creates and updates it on first use.

## Uninstall / rollback

To test without permanently committing to the plugin:

```bash
openclaw plugins disable discord-workspace-router
openclaw gateway restart
```

To remove it completely, use the uninstall/remove command supported by your OpenClaw build and then remove the workspace skill if desired. Existing project folders and their contents should be reviewed before deleting them.
