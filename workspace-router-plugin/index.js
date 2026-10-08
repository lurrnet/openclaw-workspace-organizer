import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const THREAD_TYPES = new Set([10, 11, 12]);
const CATEGORY_TYPE = 4;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function agentFromSessionKey(sessionKey) {
  if (typeof sessionKey !== "string") return undefined;
  const match = /^agent:([^:]+):/.exec(sessionKey);
  return match?.[1];
}

function normalizeId(value) {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s || undefined;
}

function safeSegment(name, fallback) {
  let value = String(name || fallback || "unnamed").trim();
  value = value.replace(/[\\/\0]/g, "-").replace(/\.{2,}/g, "-");
  value = value.replace(/^\.+$/, "unnamed").trim();
  return value || String(fallback || "unnamed");
}

function isInside(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function findChannel(map, guildId, channelId) {
  const guild = map?.guilds?.[guildId];
  if (!guild) return undefined;
  for (const [categoryId, category] of Object.entries(asObject(guild.categories))) {
    const channel = asObject(category.channels)[channelId];
    if (channel) return { guild, categoryId, category, channel };
  }
  return undefined;
}

function uniquePath(basePath, usedPaths, suffix) {
  if (!usedPaths.has(basePath)) return basePath;
  let candidate = `${basePath}--${suffix}`;
  let n = 2;
  while (usedPaths.has(candidate)) candidate = `${basePath}--${suffix}-${n++}`;
  return candidate;
}

function collectPaths(map, guildId) {
  const used = new Set();
  const guild = map?.guilds?.[guildId];
  if (!guild) return used;
  for (const category of Object.values(asObject(guild.categories))) {
    if (category?.path) used.add(String(category.path));
    for (const channel of Object.values(asObject(category?.channels))) {
      if (channel?.path) used.add(String(channel.path));
    }
  }
  return used;
}

async function readMap(mapFile) {
  try {
    const text = await fs.readFile(mapFile, "utf8");
    const parsed = YAML.parse(text) || {};
    if (!parsed.version) parsed.version = 1;
    if (!parsed.guilds || typeof parsed.guilds !== "object") parsed.guilds = {};
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return { version: 1, guilds: {} };
    throw error;
  }
}

async function writeMapAtomic(mapFile, map) {
  await fs.mkdir(path.dirname(mapFile), { recursive: true });
  const temp = `${mapFile}.tmp-${process.pid}-${Date.now()}`;
  const text = YAML.stringify(map, { lineWidth: 0 });
  await fs.writeFile(temp, text, { encoding: "utf8", mode: 0o600 });
  await fs.rename(temp, mapFile);
}

function tokenFromEnvName(name) {
  if (!name || typeof name !== "string") return undefined;
  const token = process.env[name];
  return token && token.trim() ? token.trim() : undefined;
}

function tokenFromRuntimeConfig(runtimeConfig, accountId) {
  const discord = runtimeConfig?.channels?.discord;
  if (!discord || typeof discord !== "object") return undefined;

  const inspect = (entry) => {
    if (!entry || typeof entry !== "object") return undefined;
    for (const key of ["token", "botToken"]) {
      const value = entry[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    for (const key of ["tokenEnv", "botTokenEnv"]) {
      const value = entry[key];
      if (typeof value === "string") {
        const fromEnv = tokenFromEnvName(value);
        if (fromEnv) return fromEnv;
      }
    }
    return undefined;
  };

  if (accountId) {
    const accounts = discord.accounts;
    if (accounts && typeof accounts === "object") {
      const account = accounts[accountId];
      const token = inspect(account);
      if (token) return token;
    }
  }
  return inspect(discord);
}

function resolveToken(config, api, { agentId, accountId }) {
  const byAccount = asObject(config.tokenEnvByAccount);
  const byAgent = asObject(config.tokenEnvByAgent);
  return (
    tokenFromEnvName(accountId && byAccount[accountId]) ||
    tokenFromEnvName(agentId && byAgent[agentId]) ||
    tokenFromEnvName(config.tokenEnv) ||
    tokenFromRuntimeConfig(api.config, accountId)
  );
}

async function discordGet(token, endpoint) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
      headers: { Authorization: `Bot ${token}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Discord API ${response.status} for ${endpoint}: ${body.slice(0, 180)}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveDiscordHierarchy(token, incomingChannelId) {
  const incoming = await discordGet(token, `/channels/${incomingChannelId}`);
  let channel = incoming;
  let thread;

  if (THREAD_TYPES.has(Number(incoming.type))) {
    thread = incoming;
    if (!incoming.parent_id) throw new Error(`Discord thread ${incomingChannelId} has no parent_id`);
    channel = await discordGet(token, `/channels/${incoming.parent_id}`);
  }

  const guildId = normalizeId(channel.guild_id || incoming.guild_id);
  if (!guildId) throw new Error(`Discord channel ${channel.id} has no guild_id`);

  const categoryId = normalizeId(channel.parent_id);
  let category;
  if (categoryId) {
    category = await discordGet(token, `/channels/${categoryId}`);
    if (Number(category.type) !== CATEGORY_TYPE) {
      throw new Error(`Discord parent ${categoryId} is type ${category.type}, not a category`);
    }
  }

  let guildName = guildId;
  try {
    const guild = await discordGet(token, `/guilds/${guildId}`);
    if (guild?.name) guildName = guild.name;
  } catch {
    // Guild name is cosmetic; routing does not depend on it.
  }

  return {
    guildId,
    guildName,
    categoryId,
    categoryName: category?.name,
    channelId: normalizeId(channel.id),
    channelName: channel.name,
    threadId: thread ? normalizeId(thread.id) : undefined,
    threadName: thread?.name,
  };
}

function buildReadme(route) {
  return `# ${route.channelName}\n\n` +
    `## Discord\n\n` +
    `- Guild: \`${route.guildName}\`\n` +
    `- Category: \`${route.categoryName}\`\n` +
    `- Channel: \`#${route.channelName}\`\n` +
    `- Channel ID: \`${route.channelId}\`\n\n` +
    `## Workspace routing\n\n` +
    `This directory is the persistent working directory for this Discord channel.\n` +
    `Discord threads inherit this directory by default.\n`;
}

async function ensureDirectory(workspaceDir, relativePath, route, createReadme) {
  const absolute = path.resolve(workspaceDir, relativePath);
  if (!isInside(path.resolve(workspaceDir), absolute)) {
    throw new Error(`Refusing workspace path outside root: ${relativePath}`);
  }
  await fs.mkdir(absolute, { recursive: true });
  if (createReadme) {
    const readme = path.join(absolute, "README.md");
    try {
      await fs.access(readme);
    } catch {
      await fs.writeFile(readme, buildReadme(route), "utf8");
    }
  }
  return absolute;
}

function routeFromExisting(found, hierarchy) {
  return {
    status: "mapped",
    guildId: hierarchy.guildId,
    guildName: found.guild.name || hierarchy.guildName,
    categoryId: found.categoryId,
    categoryName: found.category.name || hierarchy.categoryName,
    channelId: hierarchy.channelId,
    channelName: found.channel.name || hierarchy.channelName,
    path: found.channel.path,
    threadId: hierarchy.threadId,
    threadName: hierarchy.threadName,
  };
}

async function upsertRoute({ mapFile, workspaceDir, hierarchy, config, logger }) {
  const map = await readMap(mapFile);
  const existing = findChannel(map, hierarchy.guildId, hierarchy.channelId);

  if (existing) {
    const moved = hierarchy.categoryId && hierarchy.categoryId !== existing.categoryId;
    if (moved) {
      logger.warn?.(
        `Discord channel ${hierarchy.channelId} moved categories (${existing.categoryId} -> ${hierarchy.categoryId}); preserving existing workspace path ${existing.channel.path}`,
      );
    }

    let dirty = false;
    if (config.updateNames !== false) {
      if (hierarchy.guildName && existing.guild.name !== hierarchy.guildName) {
        existing.guild.name = hierarchy.guildName;
        dirty = true;
      }
      if (!moved && hierarchy.categoryName && existing.category.name !== hierarchy.categoryName) {
        existing.category.name = hierarchy.categoryName;
        dirty = true;
      }
      if (hierarchy.channelName && existing.channel.name !== hierarchy.channelName) {
        existing.channel.name = hierarchy.channelName;
        dirty = true;
      }
    }
    if (dirty) await writeMapAtomic(mapFile, map);

    const route = routeFromExisting(existing, hierarchy);
    route.absolutePath = await ensureDirectory(workspaceDir, route.path, route, config.createReadme !== false);
    return route;
  }

  if (config.autoRegister === false) {
    return { status: "unmapped", ...hierarchy };
  }

  if (!hierarchy.categoryId || !hierarchy.categoryName) {
    if (config.allowUncategorized !== true) {
      return { status: "unmapped", reason: "uncategorized-channel", ...hierarchy };
    }
  }

  const guilds = map.guilds || (map.guilds = {});
  const guild = guilds[hierarchy.guildId] || (guilds[hierarchy.guildId] = {
    name: hierarchy.guildName || hierarchy.guildId,
    categories: {},
  });
  if (!guild.categories || typeof guild.categories !== "object") guild.categories = {};
  if (config.updateNames !== false && hierarchy.guildName) guild.name = hierarchy.guildName;

  const usedPaths = collectPaths(map, hierarchy.guildId);
  const categoryKey = hierarchy.categoryId || "__uncategorized__";
  let category = guild.categories[categoryKey];
  if (!category) {
    const categoryName = hierarchy.categoryName || "Uncategorized";
    const requested = safeSegment(categoryName, `category-${categoryKey.slice(-6)}`);
    const categoryPath = uniquePath(requested, usedPaths, categoryKey.slice(-6));
    category = guild.categories[categoryKey] = {
      name: categoryName,
      path: categoryPath,
      channels: {},
    };
    usedPaths.add(categoryPath);
  } else {
    if (!category.channels || typeof category.channels !== "object") category.channels = {};
    if (config.updateNames !== false && hierarchy.categoryName) category.name = hierarchy.categoryName;
  }

  const channelBase = path.posix.join(
    String(category.path),
    safeSegment(hierarchy.channelName, `channel-${hierarchy.channelId.slice(-6)}`),
  );
  const channelPath = uniquePath(channelBase, usedPaths, hierarchy.channelId.slice(-6));
  category.channels[hierarchy.channelId] = {
    name: hierarchy.channelName || hierarchy.channelId,
    path: channelPath,
    enabled: true,
  };

  await writeMapAtomic(mapFile, map);

  const route = {
    status: "registered",
    guildId: hierarchy.guildId,
    guildName: guild.name,
    categoryId: categoryKey,
    categoryName: category.name,
    channelId: hierarchy.channelId,
    channelName: hierarchy.channelName || hierarchy.channelId,
    path: channelPath,
    threadId: hierarchy.threadId,
    threadName: hierarchy.threadName,
  };
  route.absolutePath = await ensureDirectory(workspaceDir, route.path, route, config.createReadme !== false);
  return route;
}

function injectedContext(route) {
  if (!route?.path) return undefined;
  const threadLine = route.threadId
    ? `\nDiscord thread: ${route.threadName || route.threadId} (inherits parent channel directory)`
    : "";
  return `## Discord Workspace Context\n\n` +
    `Guild: ${route.guildName}\n` +
    `Category: ${route.categoryName}\n` +
    `Channel: #${route.channelName}${threadLine}\n\n` +
    `Persistent workspace directory: \`${route.path}\`\n\n` +
    `Treat this directory as the logical working directory for channel-specific persistent files. ` +
    `Read its README.md when relevant. Do not place channel-specific persistent files in the workspace root. ` +
    `Discord threads inherit the parent channel directory unless explicitly configured otherwise.`;
}

export default definePluginEntry({
  id: "discord-workspace-router",
  name: "Discord Workspace Router",
  description: "Mirror Discord category/channel structure into an OpenClaw workspace.",
  register(api) {
    const config = asObject(api.pluginConfig);
    const routeCache = new Map();
    const inFlight = new Map();

    const configuredAgentId = normalizeId(config.agentId);
    const workspaceDir = path.resolve(
      config.workspaceDir || process.cwd(),
    );
    const mapFile = path.resolve(workspaceDir, config.mapPath || "_system/discord-channel-map.yaml");
    if (!isInside(workspaceDir, mapFile)) {
      throw new Error(`discord-workspace-router mapPath escapes workspace: ${mapFile}`);
    }

    const matchesAgent = (ctx) => {
      if (!configuredAgentId) return true;
      const current = normalizeId(ctx?.agentId) || agentFromSessionKey(ctx?.sessionKey);
      return !current || current === configuredAgentId;
    };

    const routeKey = (agentId, channelId) => `${agentId || "*"}:${channelId}`;

    async function resolveFor({ agentId, accountId, channelId }) {
      const key = routeKey(agentId, channelId);
      if (routeCache.has(key)) return routeCache.get(key);
      if (inFlight.has(key)) return inFlight.get(key);

      const promise = (async () => {
        const token = resolveToken(config, api, { agentId, accountId });
        if (!token) {
          throw new Error(
            `No Discord bot token available for agent=${agentId || "?"} account=${accountId || "?"}. ` +
            `Configure tokenEnv/tokenEnvByAgent/tokenEnvByAccount or expose the token in the OpenClaw Discord runtime config.`,
          );
        }
        const hierarchy = await resolveDiscordHierarchy(token, channelId);
        const route = await upsertRoute({ mapFile, workspaceDir, hierarchy, config, logger: api.logger });
        if (route?.path) routeCache.set(key, route);
        return route;
      })().finally(() => inFlight.delete(key));

      inFlight.set(key, promise);
      return promise;
    }

    api.on("message_received", async (event, ctx) => {
      const provider = event?.metadata?.provider || event?.metadata?.surface || ctx?.channel || ctx?.messageProvider;
      if (provider !== "discord" || !matchesAgent(ctx)) return;

      const agentId = normalizeId(ctx?.agentId) || agentFromSessionKey(ctx?.sessionKey) || configuredAgentId;
      const accountId = normalizeId(event?.accountId || event?.metadata?.accountId);
      const channelId = normalizeId(event?.channelId || ctx?.channelId || event?.conversationId);
      if (!channelId) return;

      try {
        await resolveFor({ agentId, accountId, channelId });
      } catch (error) {
        api.logger.warn?.(`Discord workspace auto-register failed for channel ${channelId}: ${error?.message || error}`);
      }
    });

    api.on(
      "before_prompt_build",
      async (_event, ctx) => {
        if (config.injectContext === false) return;
        const provider = ctx?.channel || ctx?.messageProvider;
        if (provider !== "discord" || !matchesAgent(ctx)) return;

        const agentId = normalizeId(ctx?.agentId) || agentFromSessionKey(ctx?.sessionKey) || configuredAgentId;
        const channelId = normalizeId(ctx?.channelId || ctx?.chatId);
        if (!channelId) return;

        try {
          const route = await resolveFor({ agentId, channelId });
          const context = injectedContext(route);
          if (context) return { prependContext: context };
        } catch (error) {
          api.logger.warn?.(`Discord workspace routing failed for channel ${channelId}: ${error?.message || error}`);
          return {
            prependContext:
              `## Discord Workspace Routing Warning\n\n` +
              `This turn came from Discord channel ID \`${channelId}\`, but the workspace route could not be resolved automatically. ` +
              `Do not guess a persistent destination path; avoid creating channel-specific files until routing is resolved.`,
          };
        }
      },
    );
  },
});
