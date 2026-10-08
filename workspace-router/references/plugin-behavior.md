# Plugin behavior

The companion native plugin performs automatic first-use synchronization.

1. Receive a Discord message.
2. Resolve the current channel ID through Discord REST API v10.
3. If the target is a Discord thread, fetch its parent channel and route to the parent channel.
4. Use the parent channel object's `parent_id` as the category ID.
5. Fetch category and guild metadata.
6. If the channel already exists in `_system/discord-channel-map.yaml`, keep its existing filesystem path.
7. If it is new and has a category, create the guild/category/channel mapping, directory, and README.
8. Inject the resolved path into `before_prompt_build`.
9. Update names after Discord renames, but do not rename filesystem paths.
10. If an existing channel moves categories, preserve the old path and log a warning instead of moving files automatically.
