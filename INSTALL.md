# OpenClaw Discord Workspace Router

This bundle contains:

- `workspace-router-plugin/` - native OpenClaw plugin that discovers Discord guild/category/channel metadata, auto-registers routes, creates directories, and injects routing context.
- `workspace-router/` - workspace skill that tells the agent how to follow the injected route.
- `config-snippets/` - example OpenClaw config, AGENTS.md policy, and empty mapping file.

Runtime-tested with **OpenClaw 2026.8.35**.

## 1. Install the workspace skill

```bash
mkdir -p ~/.openclaw/workspace/skills
cp -R workspace-router ~/.openclaw/workspace/skills/
```

## 2. Install plugin dependencies

```bash
npm install --prefix workspace-router-plugin
```

## 3. Link and enable the plugin

```bash
openclaw plugins install --link ./workspace-router-plugin --force
openclaw plugins enable discord-workspace-router
```

Merge `config-snippets/openclaw-plugin-entry.json` into your existing OpenClaw config. Replace `<agent-id>` and `/path/to/openclaw/workspace` with values for your installation. Do not replace your whole config with the snippet.

## 4. Supply the Discord bot token

Put the Discord bot token in the Gateway environment:

```bash
export DISCORD_BOT_TOKEN='YOUR_EXISTING_DISCORD_BOT_TOKEN'
```

Persist it wherever you currently define the Gateway environment. The plugin does not write or log the token.

Do not put the real token in this repository, an issue, a log excerpt, or a committed `.env` file.

## 5. AGENTS.md

Merge `config-snippets/AGENTS-routing.md` into the workspace root `AGENTS.md`.

## 6. Mapping file

You do not need to populate IDs manually. The plugin creates `_system/discord-channel-map.yaml` on first successful use. You may optionally pre-create it from the included empty template.

The generated mapping contains real Discord guild/category/channel IDs and names. If your OpenClaw workspace is tracked with Git, ignore it:

```gitignore
_system/discord-channel-map.yaml
```

## 7. Restart and inspect

```bash
openclaw gateway restart
openclaw plugins inspect discord-workspace-router --runtime --json
```

## 8. Test

Send a message in Discord under `Projects / #example-project`, for example:

`Create a test.md for this channel with the text workspace routing test.`

Then check:

```bash
cat ~/.openclaw/workspace/_system/discord-channel-map.yaml
find ~/.openclaw/workspace/Projects/example-project -maxdepth 2 -type f -print
```

Expected: the YAML contains the real guild/category/channel IDs and the test file lands under the channel directory.
