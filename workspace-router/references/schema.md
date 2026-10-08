# Discord channel map schema

Canonical file: `_system/discord-channel-map.yaml`

```yaml
version: 1

guilds:
  "<guild-id>":
    name: "Example Server"
    categories:
      "<category-id>":
        name: "Projects"
        path: "Projects"
        channels:
          "<channel-id>":
            name: "example-project"
            path: "Projects/example-project"
            enabled: true
```

IDs are stable identity. Names are display metadata. `path` is the stable filesystem route and must not be automatically renamed when Discord display names change.

The generated mapping contains real Discord server metadata. Do not publish your runtime mapping unless you intentionally want to expose those guild/category/channel IDs and names.
