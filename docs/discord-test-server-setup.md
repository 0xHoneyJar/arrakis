# Discord Test Server Setup Guide

This guide walks you through creating a Discord server for testing with `gaib` sandboxes. A properly configured test server allows full control over bot behavior without affecting production communities.

## Prerequisites

- Discord account
- `gaib` CLI installed and configured
- Bot application created in Discord Developer Portal (or access to existing one)

## Step 1: Create a Test Server

1. Open Discord
2. Click the **+** button in the server list (left sidebar)
3. Select **Create My Own**
4. Choose **For me and my friends** (or any option)
5. Name it something identifiable (e.g., `Arrakis Test - [YourName]`)
6. Click **Create**

### Enable Developer Mode

To copy IDs (required for gaib commands):

1. Go to **User Settings** (gear icon)
2. Navigate to **App Settings** → **Advanced**
3. Enable **Developer Mode**

Now you can right-click servers, channels, and users to copy their IDs.

## Step 2: Get Your Server (Guild) ID

1. Right-click your new test server in the sidebar
2. Click **Copy Server ID**
3. Save this ID - you'll need it for `gaib sandbox register-guild`

## Step 3: Invite the Bot

### Required Bot Permissions

The Arrakis bot needs these permissions to fully function in your test server:

#### Essential Permissions

| Permission | Why Needed |
|------------|------------|
| **View Channels** | See channels and read messages |
| **Send Messages** | Respond to commands and events |
| **Embed Links** | Send rich embeds for responses |
| **Read Message History** | Access context for commands |
| **Use External Emojis** | Display status indicators |
| **Add Reactions** | React to messages for feedback |

#### Role Management (Required for Token Gating)

| Permission | Why Needed |
|------------|------------|
| **Manage Roles** | Assign/remove roles based on token holdings |

#### Channel Management (Optional but Recommended)

| Permission | Why Needed |
|------------|------------|
| **Manage Channels** | Create token-gated channels |
| **Manage Webhooks** | Set up event notifications |

#### Administrative (For Full Testing)

| Permission | Why Needed |
|------------|------------|
| **Administrator** | Full access for comprehensive testing |

### Generate Invite Link

#### Option A: Administrator (Recommended for Test Servers)

For test servers, Administrator permission simplifies testing:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

#### Option B: Minimal Permissions

For restricted testing:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=275415247936&scope=bot%20applications.commands
```

This includes:
- View Channels
- Send Messages
- Embed Links
- Read Message History
- Manage Roles
- Use External Emojis
- Add Reactions

### Invite Steps

1. Replace `YOUR_BOT_CLIENT_ID` with your bot's client ID
2. Open the link in your browser
3. Select your test server from the dropdown
4. Review permissions and click **Authorize**
5. Complete the CAPTCHA if prompted

## Step 4: Configure Bot Role Position

**Critical**: The bot's role must be higher than roles it manages.

1. Go to **Server Settings** → **Roles**
2. Find the bot's role (usually named after the bot)
3. Drag it **above** any roles the bot needs to assign
4. Click **Save Changes**

```
Role Hierarchy (top = highest):
┌─────────────────────────┐
│ Server Owner            │ (cannot be managed)
├─────────────────────────┤
│ Admin Roles             │
├─────────────────────────┤
│ 🤖 Arrakis Bot         │ ← Bot role must be HERE
├─────────────────────────┤
│ Token-Gated Roles       │ ← Bot can manage these
│ - NFT Holder            │
│ - Whale                 │
│ - Verified              │
├─────────────────────────┤
│ @everyone               │
└─────────────────────────┘
```

## Step 5: Create Test Channels

Create channels to test different bot features:

### Recommended Channel Structure

```
📁 INFORMATION
  └── #welcome
  └── #rules
  └── #announcements

📁 TOKEN-GATED (for testing gating)
  └── #holders-only      (restricted)
  └── #whale-chat        (restricted)

📁 BOT TESTING
  └── #bot-commands      (public)
  └── #bot-logs          (admin only)

📁 GENERAL
  └── #general
  └── #off-topic
```

### Setting Up Token-Gated Channels

1. Create a channel (e.g., `#holders-only`)
2. Click the gear icon → **Permissions**
3. Click **@everyone** → Deny **View Channel**
4. Click **+** → Add the token-gated role
5. Allow **View Channel** for that role

## Step 6: Register with gaib Sandbox

Now connect your test server to a sandbox:

```bash
# Create a sandbox
gaib sandbox create my-test --ttl 48h

# Register your Discord test server
gaib sandbox register-guild my-test YOUR_GUILD_ID

# Verify registration
gaib sandbox status my-test
```

### Verify Bot Connection

In your `#bot-commands` channel, try a bot command to verify the connection is working through the sandbox.

## Step 7: Testing Checklist

Use this checklist to verify full functionality:

### Basic Operations
- [ ] Bot appears online in server
- [ ] Bot responds to commands
- [ ] Bot can send embeds
- [ ] Bot can add reactions

### Role Management
- [ ] Bot can assign roles
- [ ] Bot can remove roles
- [ ] Role changes reflect in token-gated channels

### Event Routing
- [ ] Events appear in sandbox logs
- [ ] Member join events captured
- [ ] Message events captured
- [ ] Reaction events captured

### Channel Management (if applicable)
- [ ] Bot can create channels
- [ ] Bot can modify channel permissions
- [ ] Bot can delete test channels

## Troubleshooting

### Bot Doesn't Respond

1. Check bot is online (green dot)
2. Verify sandbox registration:
   ```bash
   gaib sandbox status my-test
   ```
3. Check bot has permission in the channel
4. Review sandbox logs for errors

### Can't Manage Roles

1. Verify bot role is higher than target roles
2. Check "Manage Roles" permission is granted
3. Ensure roles aren't managed by integrations

### Events Not Routing

1. Verify guild is registered:
   ```bash
   gaib sandbox status my-test
   ```
2. Check NATS connection in sandbox health
3. Ensure bot has View Channel permission

### Permission Denied Errors

1. Re-check role hierarchy
2. Verify bot permissions in Server Settings
3. Check channel-specific permission overrides

## Security Best Practices

### For Test Servers

- [ ] Use a dedicated bot application for testing (not production bot)
- [ ] Don't invite real community members to test servers
- [ ] Regularly clean up test data
- [ ] Destroy sandboxes when testing is complete

### Credential Management

- [ ] Never share bot tokens in chat
- [ ] Use environment variables for sensitive data
- [ ] Rotate test credentials periodically

## Quick Reference

```bash
# Full workflow
gaib sandbox create my-test --ttl 48h
gaib sandbox register-guild my-test 123456789012345678
eval $(gaib sandbox connect my-test)

# Monitor events
gaib sandbox status my-test --watch

# Cleanup when done
gaib sandbox unregister-guild my-test 123456789012345678
gaib sandbox destroy my-test
```

## Permission Calculator

Use the [Discord Permissions Calculator](https://discordapi.com/permissions.html) to generate custom invite links with specific permissions.

### Common Permission Integers

| Permissions | Integer | Use Case |
|-------------|---------|----------|
| Administrator | `8` | Full test server control |
| Basic Bot | `275415247936` | Standard bot operations |
| Read-Only | `66560` | Monitoring only |

## See Also

- [gaib CLI Reference](./cli.md) - Full CLI documentation
- [Sandbox Operations Runbook](./sandbox-runbook.md) - Operational procedures
- [Discord Developer Portal](https://discord.com/developers/applications) - Bot management
