# Contributing to Sietch

Thank you for your interest in contributing to Sietch! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Versioning](#versioning)
- [Release Process](#release-process)
- [Getting Help](#getting-help)

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Git
- A Discord bot token (for testing)
- Access to a Berachain RPC endpoint

### Development Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/YOUR-USERNAME/arrakis.git
   cd arrakis
   ```

2. **Install dependencies**
   ```bash
   cd themes/sietch
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Run tests**
   ```bash
   npm test
   ```

## Making Changes

### Branching Strategy

We use a modified GitFlow model. See [DEVELOPMENT.md](./DEVELOPMENT.md) for full details.

**Key branches:**
- `main` - Production code (protected, requires 2 reviewers)
- `staging` - Pre-production validation (protected, requires 1 reviewer)
- `feature/*` - New features (branch from staging)
- `fix/*` - Bug fixes (branch from staging)
- `hotfix/*` - Production emergencies (branch from main)

### Branch Naming

Use descriptive branch names with optional ticket reference:
- `feature/ARK-123-add-new-badge` - New features
- `fix/ARK-456-tier-calculation-bug` - Bug fixes
- `docs/update-readme` - Documentation
- `refactor/cleanup-services` - Code improvements
- `test/add-integration-tests` - Test additions
- `hotfix/ARK-789-critical-auth-fix` - Production emergencies

### Code Style

- TypeScript strict mode is enforced
- ESLint and Prettier are configured
- Run `npm run lint` before committing
- Run `npm run typecheck` to verify types

### Testing

- Write unit tests for new services
- Write integration tests for API endpoints
- Maintain test coverage for critical paths
- Run `npm test` to execute the test suite

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `chore` | Maintenance tasks |
| `ci` | CI/CD changes |
| `security` | Security improvements |

### Scopes

| Scope | Description |
|-------|-------------|
| `api` | REST API changes |
| `discord` | Discord bot changes |
| `db` | Database schema/queries |
| `services` | Service layer changes |
| `trigger` | Scheduled task changes |
| `deps` | Dependency updates |

### Examples

```
feat(discord): add /stats command for personal statistics

Add a new slash command that displays member's personal stats including
tier progress, BGT history, and badge count.

Closes #123
```

```
fix(services): correct ISO 8601 week calculation

The previous implementation incorrectly calculated week numbers for
dates near year boundaries. Now uses the Thursday rule per ISO 8601.
```

## Pull Request Process

### Standard Features (staging -> main flow)

1. **Create a feature branch** from `staging`
   ```bash
   git checkout staging && git pull
   git checkout -b feature/your-feature
   ```
2. **Make your changes** with appropriate tests
3. **Run the full test suite** - `npm run test:run`
4. **Run linting** - `npm run lint`
5. **Run type checking** - `npm run typecheck`
6. **Update documentation** if needed
7. **Create a pull request to staging** with:
   - Clear title following commit conventions
   - Description of changes
   - Link to related issues
   - Screenshots for UI changes

### PR Template

```markdown
## Summary
Brief description of changes

## Changes
- List of specific changes

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows project style
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] CHANGELOG.md updated (for features/fixes)
```

### Quality Gates

All PRs must pass these automated checks:
- **Build** - TypeScript compilation succeeds
- **Tests** - All unit tests pass with >= 80% coverage
- **Lint** - ESLint passes with no errors
- **Security** - npm audit finds no high/critical vulnerabilities
- **Docker** - Docker image builds successfully

### Hotfix Process

For critical production issues (use sparingly):

1. **Branch from main**
   ```bash
   git checkout main && git pull
   git checkout -b hotfix/critical-fix
   ```
2. **Fix, test, and create PR directly to main**
3. **After merge**, cherry-pick to staging immediately

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features, backward compatible
- **PATCH** (0.0.X): Bug fixes, backward compatible

### Version Bump Guidelines

| Change Type | Version Bump |
|-------------|--------------|
| Breaking API change | MAJOR |
| Breaking Discord command change | MAJOR |
| Database schema change (migration required) | MINOR |
| New feature | MINOR |
| New Discord command | MINOR |
| Bug fix | PATCH |
| Performance improvement | PATCH |
| Documentation | No bump |

## Release Process

1. **Update CHANGELOG.md**
   - Move items from `[Unreleased]` to new version section
   - Add release date
   - Update comparison links

2. **Update version**
   ```bash
   npm version <major|minor|patch>
   ```

3. **Create release PR**
   - Title: `chore(release): v3.1.0`
   - Include CHANGELOG excerpt

4. **After merge, create GitHub release**
   - Tag: `v3.1.0`
   - Title: Version number and codename
   - Body: CHANGELOG section for this version

### Changelog Format

Follow [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [3.1.0] - 2025-01-15

### Added
- New feature description

### Changed
- Change description

### Fixed
- Bug fix description

### Removed
- Removed feature description

### Security
- Security fix description
```

## Project Structure

```
arrakis/
├── sites/                  # Web properties
│   ├── docs/               # Documentation site (Nextra)
│   └── web/                # Marketing website (Next.js)
├── themes/                 # Theme-specific backend services
│   └── sietch/             # Arrakis/Dune theme
│       ├── src/
│       │   ├── api/        # REST API routes
│       │   ├── db/         # Database schema and queries
│       │   ├── discord/    # Discord bot commands and embeds
│       │   ├── services/   # Business logic services
│       │   ├── trigger/    # Scheduled tasks
│       │   └── types/      # TypeScript type definitions
│       └── tests/
│           ├── unit/       # Unit tests
│           └── integration/# Integration tests
├── packages/               # Shared libraries
│   └── core/               # Common types and utilities
├── infrastructure/         # Terraform configs
└── grimoires/              # Loa framework state
```

## Getting Help

- **Issues**: Open a GitHub issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Discord**: Join the Sietch Discord for community support

## Recognition

Contributors are recognized in:
- Git commit history
- GitHub contributors list
- Release notes (for significant contributions)

Thank you for contributing to Sietch!
