# Security Policy

## Sensitive data

This plugin needs access to a Discord bot token in order to resolve guild, category, and channel metadata.

Never commit or publish:

- Discord bot tokens
- `.env` files containing credentials
- copied OpenClaw runtime configuration containing credentials
- `_system/discord-channel-map.yaml` from a real deployment unless you intentionally want to publish its Discord guild/category/channel IDs and names

The repository's `.gitignore` excludes common environment files and the generated mapping path, but users should also add the mapping path to the Git repository that tracks their actual OpenClaw workspace.

## If a Discord token is exposed

1. Revoke or regenerate the bot token in the Discord Developer Portal immediately.
2. Update the Gateway environment with the new token.
3. Restart the OpenClaw Gateway.
4. Remove the exposed secret from any reachable Git history, logs, issues, or artifacts.

Deleting only the latest Git commit is not sufficient if the token remains in repository history.

## Reporting a vulnerability

If GitHub Private Vulnerability Reporting is enabled for this repository, use it for security issues.

Otherwise, open a GitHub issue with a **non-sensitive summary only**. Do not include bot tokens, private server IDs, private URLs, credentials, or exploit details that would expose another user's environment.

## Supported version

The current code has been runtime-tested with **OpenClaw 2026.8.35**.

The manifest declares compatibility with OpenClaw `>=2026.8.0`, but plugin APIs and CLI behavior may change between releases. Include your OpenClaw version when reporting compatibility problems.
