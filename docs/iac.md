# Discord Infrastructure-as-Code

> **"Terraform for Discord"** - Declarative server configuration management

## Overview

The `gaib server` commands provide Infrastructure-as-Code (IaC) for Discord servers. Define your server structure in YAML, track changes with version control, and apply configurations consistently across environments.

### Why Infrastructure-as-Code?

| Challenge | IaC Solution |
|-----------|--------------|
| Manual role/channel setup across servers | Define once in YAML, apply anywhere |
| Configuration drift between environments | `gaib server diff` detects drift |
| No audit trail of changes | Version control your config files |
| Time-consuming server setup | `gaib server init` from config in seconds |
| Inconsistent permissions | Declarative permission definitions |

## Getting Started

### Prerequisites

1. **Node.js** 18+ installed
2. **Discord Bot Token** with the following permissions:
   - `MANAGE_GUILD`
   - `MANAGE_ROLES`
   - `MANAGE_CHANNELS`
   - `VIEW_CHANNEL`
3. **Guild ID** of the target Discord server

### Quick Start

```bash
# 1. Export current server state to a config file
export DISCORD_BOT_TOKEN="your-bot-token"
gaib server export --guild 123456789012345678 -o discord-server.yaml

# 2. Edit the config file to make changes
vim discord-server.yaml

# 3. Preview what changes would be applied
gaib server plan

# 4. Review detailed diff
gaib server diff

# 5. Apply changes (coming in Sprint 94)
# gaib server apply
```

### Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     IaC Workflow                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  export  │ -> │   edit   │ -> │   plan   │ -> │  apply   │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │              │               │               │          │
│       v              v               v               v          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  YAML    │    │  YAML    │    │  Diff    │    │  Discord │  │
│  │  Config  │    │  Config  │    │  Output  │    │  Server  │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Commands

### gaib server

Parent command group for all server IaC operations.

```bash
gaib server <command> [options]
```

#### Global Options

| Option | Description |
|--------|-------------|
| `--no-color` | Disable colored output |
| `-q, --quiet` | Suppress non-essential output |

---

### gaib server init

Initialize a new server configuration file.

```bash
gaib server init [options]
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-g, --guild <id>` | Discord guild ID (fetches server name) | - |
| `-f, --file <path>` | Output file path | `discord-server.yaml` |
| `--force` | Overwrite existing file | `false` |
| `--json` | Output result as JSON | - |

#### Examples

```bash
# Create default config template
gaib server init

# Create config for a specific guild (fetches server name)
gaib server init --guild 123456789012345678

# Create config at custom path
gaib server init -f configs/production.yaml

# Overwrite existing config
gaib server init --force
```

#### Output

```
ℹ Fetching server info for guild 123456789012345678...
ℹ Found server: My Discord Server
✓ Created configuration file: /path/to/discord-server.yaml

Next steps:
  1. Edit the configuration file to define your server structure
  2. Run "gaib server plan" to preview changes
  3. Run "gaib server apply" to apply changes to Discord
```

---

### gaib server plan

Preview what changes would be applied without making them. Similar to `terraform plan`.

```bash
gaib server plan [options]
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --file <path>` | Configuration file path | `discord-server.yaml` |
| `-g, --guild <id>` | Override guild ID from config | - |
| `--json` | Output as JSON | - |
| `--managed-only` | Only show IaC-managed resources | `true` |

#### Examples

```bash
# Preview changes using default config
gaib server plan

# Preview changes for specific config file
gaib server plan -f production.yaml

# Preview changes for a specific guild
gaib server plan --guild 123456789012345678

# JSON output for automation
gaib server plan --json | jq '.summary'
```

#### Output

```
ℹ Planning changes for guild 123456789012345678...
ℹ Server: My Discord Server

🔍 Execution Plan

The following changes would be applied to bring Discord in sync with your config:

📋 Diff Summary

  3 creates, 1 updates, 0 deletes

Roles:
  + role: Moderator [managed-by:arrakis-iac]
  + role: VIP [managed-by:arrakis-iac]
  ~ role: Member [managed-by:arrakis-iac]
      color: #000000 → #3498db

Categories:
  + category: 📋 Information [managed-by:arrakis-iac]

  To apply these changes, run: gaib server apply
```

---

### gaib server diff

Show detailed differences between configuration and current Discord state.

```bash
gaib server diff [options]
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --file <path>` | Configuration file path | `discord-server.yaml` |
| `-g, --guild <id>` | Override guild ID from config | - |
| `--json` | Output as JSON | - |
| `--no-permissions` | Exclude permission changes | `false` |
| `--managed-only` | Only show IaC-managed resources | `true` |

#### Examples

```bash
# Show diff using default config
gaib server diff

# Show diff without permission changes
gaib server diff --no-permissions

# JSON output for piping
gaib server diff --json | jq '.diff.roles'

# Compare specific config to Discord
gaib server diff -f staging.yaml
```

#### Output

```
ℹ Calculating diff for guild 123456789012345678...
ℹ Server: My Discord Server

📋 Diff Summary

  2 creates, 1 updates, 1 deletes

Roles:
  + role: Moderator [managed-by:arrakis-iac]
  ~ role: Member [managed-by:arrakis-iac]
      color: #000000 → #3498db
      hoist: false → true
  - role: Old Role [managed-by:arrakis-iac]

Channels:
  + channel: welcome
```

---

### gaib server export

Export current Discord server state to YAML configuration format.

```bash
gaib server export [options]
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-g, --guild <id>` | Discord guild ID (required) | - |
| `-o, --output <path>` | Output file path | stdout |
| `--json` | Output as JSON instead of YAML | - |
| `--include-unmanaged` | Include non-IaC-managed resources | `false` |

#### Examples

```bash
# Export to stdout
gaib server export --guild 123456789012345678

# Export to file
gaib server export -g 123456789012345678 -o current-state.yaml

# Export as JSON
gaib server export --guild 123456789012345678 --json

# Include all resources (not just IaC-managed)
gaib server export --guild 123456789012345678 --include-unmanaged
```

#### Output

```yaml
# Discord Server Configuration
# Exported from: My Discord Server
# Guild ID: 123456789012345678
# Exported at: 2026-01-18T12:00:00.000Z

version: "1.0"

server:
  name: "My Discord Server"
  id: "123456789012345678"

roles:
  - name: "Moderator [managed-by:arrakis-iac]"
    color: "#3498db"
    permissions:
      - KICK_MEMBERS
      - BAN_MEMBERS
      - MANAGE_MESSAGES
    hoist: true

categories:
  - name: "📋 Information [managed-by:arrakis-iac]"
    position: 0

channels:
  - name: "welcome"
    type: "text"
    topic: "Welcome to our server! [managed-by:arrakis-iac]"
    category: "📋 Information [managed-by:arrakis-iac]"
```

## Configuration Schema

### Structure Overview

```yaml
version: "1.0"

server:
  name: "Server Name"
  id: "123456789012345678"  # Guild ID

roles:
  - name: "Role Name [managed-by:arrakis-iac]"
    color: "#hex-color"
    permissions: [...]
    hoist: true/false
    mentionable: true/false

categories:
  - name: "Category Name [managed-by:arrakis-iac]"
    position: 0

channels:
  - name: "channel-name"
    type: "text" | "voice"
    topic: "Channel topic [managed-by:arrakis-iac]"
    category: "Parent Category Name"
    nsfw: true/false
    slowmode: 0-21600  # seconds
```

### Server Section

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Server display name (2-100 chars) |
| `id` | string | No | Discord guild ID (snowflake) |

### Roles Section

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Role name (must be unique) |
| `color` | string | No | Hex color code (e.g., `#3498db`) |
| `permissions` | string[] | No | Array of permission flags |
| `hoist` | boolean | No | Display separately in member list |
| `mentionable` | boolean | No | Allow anyone to @mention this role |

#### Available Permissions

```yaml
permissions:
  # Moderation
  - KICK_MEMBERS
  - BAN_MEMBERS
  - MODERATE_MEMBERS
  - MANAGE_MESSAGES
  - MANAGE_THREADS

  # Server Management
  - MANAGE_GUILD
  - MANAGE_ROLES
  - MANAGE_CHANNELS
  - MANAGE_WEBHOOKS
  - MANAGE_EMOJIS_AND_STICKERS

  # Channel Permissions
  - VIEW_CHANNEL
  - SEND_MESSAGES
  - EMBED_LINKS
  - ATTACH_FILES
  - ADD_REACTIONS
  - USE_EXTERNAL_EMOJIS
  - MENTION_EVERYONE
  - READ_MESSAGE_HISTORY

  # Voice Permissions
  - CONNECT
  - SPEAK
  - MUTE_MEMBERS
  - DEAFEN_MEMBERS
  - MOVE_MEMBERS
  - USE_VAD
  - PRIORITY_SPEAKER
```

### Categories Section

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Category name |
| `position` | number | No | Sort order (0 = top) |

### Channels Section

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Channel name |
| `type` | string | Yes | `text` or `voice` |
| `topic` | string | No | Channel description/topic |
| `category` | string | No | Parent category name |
| `nsfw` | boolean | No | Age-restricted channel |
| `slowmode` | number | No | Slowmode in seconds (0-21600) |
| `bitrate` | number | No | Voice channel bitrate |
| `userLimit` | number | No | Voice channel user limit |

### Managed Resource Marker

Add `[managed-by:arrakis-iac]` to resource names/topics to mark them as IaC-managed:

```yaml
roles:
  - name: "Moderator [managed-by:arrakis-iac]"  # Managed

categories:
  - name: "📋 Information [managed-by:arrakis-iac]"  # Managed

channels:
  - name: "welcome"
    topic: "Welcome! [managed-by:arrakis-iac]"  # Managed via topic
```

**Why markers?** This allows IaC to coexist with manually-created resources. Only marked resources are tracked and modified by IaC commands.

## Common Use Cases

### Token-Gated Community Setup

Create a consistent structure for token-gated Discord servers:

```yaml
version: "1.0"

server:
  name: "My NFT Community"
  id: "123456789012345678"

roles:
  - name: "Holder [managed-by:arrakis-iac]"
    color: "#FFD700"
    hoist: true
  - name: "OG Holder [managed-by:arrakis-iac]"
    color: "#9400D3"
    hoist: true
  - name: "Whale [managed-by:arrakis-iac]"
    color: "#00CED1"
    hoist: true

categories:
  - name: "🔒 Holder Only [managed-by:arrakis-iac]"
    position: 1
  - name: "🐋 Whale Lounge [managed-by:arrakis-iac]"
    position: 2

channels:
  - name: "holder-chat"
    type: text
    topic: "Chat for verified holders [managed-by:arrakis-iac]"
    category: "🔒 Holder Only [managed-by:arrakis-iac]"
  - name: "whale-exclusive"
    type: text
    topic: "For 10+ NFT holders only [managed-by:arrakis-iac]"
    category: "🐋 Whale Lounge [managed-by:arrakis-iac]"
```

### Dev/Staging Environment Management

Maintain consistent configuration across development, staging, and production:

```bash
# Directory structure
configs/
├── base.yaml           # Shared configuration
├── development.yaml    # Dev-specific overrides
├── staging.yaml        # Staging-specific overrides
└── production.yaml     # Production guild ID

# Check staging drift
gaib server diff -f configs/staging.yaml

# Preview production changes
gaib server plan -f configs/production.yaml
```

### Drift Detection Workflow

Detect and remediate configuration drift:

```bash
# 1. Check for drift
gaib server diff -f production.yaml

# 2. If drift detected, either:
#    a) Update config to match Discord (if Discord is correct)
gaib server export -g 123456789012345678 -o production.yaml

#    b) Apply config to fix drift (if config is correct)
gaib server plan -f production.yaml
# gaib server apply -f production.yaml  # Coming soon
```

## Troubleshooting

### Common Errors

#### Missing Bot Token

```
Error: DISCORD_BOT_TOKEN environment variable is not set.
Please set it to your Discord bot token with appropriate permissions.
```

**Solution**: Set the environment variable:
```bash
export DISCORD_BOT_TOKEN="your-bot-token-here"
```

#### Missing Guild ID

```
Error: Guild ID is required. Either:
  - Add "id" to the server section in your config file
  - Pass --guild <id> option
  - Set DISCORD_GUILD_ID environment variable
```

**Solution**: Provide the guild ID via one of the three methods listed.

#### Configuration File Not Found

```
Error: Configuration file not found: discord-server.yaml
Run "gaib server init" to create one, or specify a path with -f/--file.
```

**Solution**: Create a config file or specify the correct path:
```bash
gaib server init
# or
gaib server plan -f /path/to/config.yaml
```

#### Invalid YAML

```
Error: Failed to parse configuration file
  at line 15, column 3: unexpected token
```

**Solution**: Check YAML syntax at the indicated line. Common issues:
- Missing quotes around strings with special characters
- Incorrect indentation (use 2 spaces, not tabs)
- Missing colons after keys

#### Insufficient Bot Permissions

```
Error: Missing Access
Code: 50001
```

**Solution**: Ensure your bot has the required permissions:
1. Go to Discord Developer Portal
2. Select your application → Bot
3. Enable required permissions under "Privileged Gateway Intents"
4. Re-invite the bot with proper permissions

### Bot Permission Requirements

Minimum required permissions for full IaC functionality:

| Permission | Required For |
|------------|--------------|
| `MANAGE_GUILD` | Reading server info |
| `MANAGE_ROLES` | Creating/modifying roles |
| `MANAGE_CHANNELS` | Creating/modifying channels |
| `VIEW_CHANNEL` | Reading channel state |

**Permission Integer**: `268438544`

**OAuth2 URL Template**:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=268438544&scope=bot
```

## Security Best Practices

### Bot Token Handling

1. **Never commit tokens to version control**
   ```bash
   # Add to .gitignore
   .env
   *.env
   ```

2. **Use environment variables**
   ```bash
   export DISCORD_BOT_TOKEN="your-token"
   ```

3. **Use secrets management in CI/CD**
   ```yaml
   # GitHub Actions example
   env:
     DISCORD_BOT_TOKEN: ${{ secrets.DISCORD_BOT_TOKEN }}
   ```

4. **Rotate tokens periodically**
   - Discord Developer Portal → Bot → Reset Token

### Minimum Privilege Principle

- Create a dedicated bot for IaC operations
- Grant only the permissions needed (see requirements above)
- Use separate bots for production vs development

### Configuration File Security

- Store production configs with restricted access
- Review changes before applying (use `gaib server plan`)
- Use branch protection for config file changes
- Consider encrypting sensitive configurations

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Discord bot authentication token (required) |
| `DISCORD_GUILD_ID` | Default guild ID for commands |
| `NO_COLOR` | Disable colored output (standard) |
| `FORCE_COLOR` | Force colored output |

## Exit Codes

| Code | Name | Description |
|------|------|-------------|
| `0` | SUCCESS | Operation completed successfully |
| `1` | VALIDATION_ERROR | Invalid configuration or arguments |
| `2` | PARTIAL_FAILURE | Some operations succeeded, some failed |
| `3` | API_ERROR | Discord API error |
| `4` | CONFIG_ERROR | Configuration file error |

## See Also

- [CLI Reference](./cli.md) - Full CLI documentation
- [Discord Test Server Setup](./discord-test-server-setup.md) - Create a test server
- [Sandbox Operations Runbook](./sandbox-runbook.md) - Testing with sandboxes
