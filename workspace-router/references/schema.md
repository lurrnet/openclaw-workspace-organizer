# Discord channel map schema

Canonical file: `_system/discord-channel-map.yaml`

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

IDs are stable identity. Names are display metadata. `path` is the stable filesystem route and must not be automatically renamed when Discord display names change.
