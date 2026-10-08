# Discord Workspace Router

This OpenClaw native plugin automatically resolves Discord hierarchy and mirrors it into an agent workspace.

## Behavior

- On a Discord message, resolve the current Discord channel through Discord REST API v10.
- If the incoming target is a thread, resolve its parent channel and route the thread to that parent channel's workspace directory.
- Read the parent channel's `parent_id` to identify the Discord category.
- Fetch the category name and guild name from Discord.
- Register a new mapping in `_system/discord-channel-map.yaml` on first use.
- Create the category/channel directory and `README.md` on first use.
- Inject the resolved workspace path into `before_prompt_build` for the same/current turn.
- On Discord rename, update display names in YAML but keep filesystem paths stable.
- If a channel moves to another category, keep the existing path and log a warning; do not move files automatically.

## Required config

Example:

```json
{
  "plugins": {
    "entries": {
      "discord-workspace-router": {
        "enabled": true,
        "hooks": {
          "allowConversationAccess": true
        },
        "config": {
          "agentId": "main",
          "workspaceDir": "/path/to/your/.openclaw/workspace",
          "tokenEnv": "DISCORD_BOT_TOKEN",
          "autoRegister": true,
          "updateNames": true,
          "createReadme": true,
          "injectContext": true
        }
      }
    }
  }
}
```

Set the environment variable in the Gateway environment to the bot token already used by the Discord account that can see the relevant channels:

```bash
export DISCORD_BOT_TOKEN='...'
```

The plugin also makes a best-effort attempt to reuse a plain Discord token already present in OpenClaw's runtime config, but the explicit environment variable is the reliable setup.

## Install

From the Gateway host:

```bash
npm install --prefix workspace-router-plugin
openclaw plugins install --link ./workspace-router-plugin --force
openclaw plugins enable discord-workspace-router
openclaw gateway restart
openclaw plugins inspect discord-workspace-router --runtime --json
```

## Initial YAML

The plugin can create `_system/discord-channel-map.yaml` itself. If absent, the first successful Discord message creates:

```yaml
version: 1
guilds: {}
```

and then inserts the discovered guild/category/channel hierarchy.
