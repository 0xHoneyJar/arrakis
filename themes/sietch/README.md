# Sietch Theme

A Dune-inspired Discord server theme with Fremen hierarchy and desert aesthetics.

## Overview

This theme creates a community structure modeled after a Fremen sietch from Frank Herbert's Dune universe. It includes:

- **Role hierarchy** reflecting Fremen social structure
- **Channel categories** themed around sietch life
- **Permission configurations** for proper access control

## Variables

Customize the theme by setting these variables in your `gaib.yaml`:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `community_name` | string | "Sietch" | Name of your community |
| `primary_color` | color | #D4A574 | Primary accent color for roles |
| `secondary_color` | color | #8B7355 | Secondary accent color |
| `warning_color` | color | #CC5500 | Warning/moderation color |
| `enable_voice` | boolean | true | Include voice channels |
| `enable_roleplay` | boolean | false | Include roleplay channels |

## Role Hierarchy

| Role | Purpose | Position |
|------|---------|----------|
| **Naib** | Tribal leader (admin) | 100 |
| **Shai-Hulud** | Bot role | 95 |
| **Sayyadina** | Spiritual guide (moderator) | 90 |
| **Fedaykin** | Elite warriors (trusted members) | 80 |
| **Fremen** | Full community members | 70 |
| **Pilgrim** | New arrivals | 60 |

## Channel Structure

### The Gathering
- `#welcome` - Welcome message (read-only)
- `#announcements` - Important news
- `#rules` - Community guidelines

### The Stillsuit
- `#roles` - Role selection
- `#resources` - Useful links
- `#faq` - Frequently asked questions

### The Spice Fields
- `#general` - General discussion
- `#introductions` - New member intros
- `#off-topic` - Casual chat
- `#media` - Images and videos
- `#bot-commands` - Bot interactions

### The Caves
- `Campfire` - Casual voice
- `Council Chamber` - Formal discussions
- `Meditation` - Quiet focus

### Leadership Chambers (Staff Only)
- `#staff-chat` - Private staff discussion
- `#mod-logs` - Moderation logs
- `Staff Voice` - Private voice

## Usage

\`\`\`yaml
# gaib.yaml
version: "1"
name: my-community

theme:
  name: sietch
  variables:
    community_name: "Desert Wanderers"
    primary_color: "#E8C99B"

# Override specific channels
channels:
  - name: trading-post
    type: text
    category: "The Spice Fields"
    topic: "Buy, sell, and trade"
\`\`\`

## License

MIT
