# dotman

test

A command-line tool for managing environment variables securely with password managers. Store, sync, and share environment variables across your team using your preferred secrets provider.

## Features

- **Secure Storage** – Store environment variables in your password manager vault
- **Bi-directional Sync** – Push local changes to vault and pull updates from it
- **Multi-environment Support** – Manage dev, staging, production, and custom environments
- **Password Manager Integration** – Currently supports 1Password and Bitwarden, with an extensible provider system
- **Load & Run** – Load env vars and execute commands in one step

## Installation

```bash
npm install -g @sairajchouhan/dotman
```

Or with your preferred package manager:

```bash
# pnpm
pnpm add -g @sairajchouhan/dotman

# yarn
yarn global add @sairajchouhan/dotman

# bun
bun add -g @sairajchouhan/dotman
```

## Quick Start

### 1. Initialize a Project

Run the initialization wizard to set up your project with a password manager:

```bash
dotman init
```

This will:

- Prompt you to select a storage provider (1Password or Bitwarden)
- Guide you through entering required credentials
- Create or update your `.env` file with configuration
- Create a project in your vault to store environment variables

### 2. Push Environment Variables

Push your local environment variables to the vault:

```bash
# Preview changes first
dotman push

# Apply changes to vault
dotman push --apply
```

### 3. Pull Environment Variables

Sync environment variables from the vault to your local `.env` file:

```bash
# Preview changes first
dotman pull

# Apply changes locally
dotman pull --apply
```

### 4. Run Commands with Loaded Environment

Load environment variables and run a command:

```bash
dotman load -- npm run dev
dotman load -- node server.js
```

## Commands

### `dotman init`

Initialize a new project with a password manager integration.

```bash
dotman init
```

The wizard will guide you through:

- Selecting a storage provider
- Configuring vault/project settings
- Setting up authentication tokens

### `dotman push`

Push local environment variables to the vault.

```bash
# Preview what will be pushed
dotman push

# Push changes (for a specific environment)
dotman push -e dev --apply
```

**Options:**

- `-e, --env <ENV>` – Target environment (e.g., dev, stag, prod)
- `-a, --apply` – Apply the changes (without this flag, only shows a preview)

### `dotman pull`

Pull environment variables from the vault to local `.env` file.

```bash
# Preview what will be pulled
dotman pull

# Pull changes (for a specific environment)
dotman pull -e prod --apply
```

**Options:**

- `-e, --env <ENV>` – Target environment
- `-a, --apply` – Apply the changes locally

### `dotman load`

Load environment variables from `.env` files and run a command.

```bash
dotman load -- <command>

# Examples
dotman load -- npm run dev
dotman load -- python app.py
dotman load -e prod -- node server.js
```

**Options:**

- `-e, --env <ENV>` – Environment to load

### `dotman env`

Manage environments.

#### `dotman env list`

List all available environments:

```bash
dotman env list
```

Output:

```
Available Environments:
  ★ dev (current)
  • stag
  • prod (.env)

3 environments found
```

#### `dotman env new <name>`

Create a new environment:

```bash
dotman env new staging
```

This creates:

- A new `.env.staging` file with placeholders
- A corresponding project/section in your vault

#### `dotman env use <name>`

Switch to a different environment:

```bash
dotman env use production
```

## Provider Setup

### 1Password

To use 1Password as your storage provider, you'll need:

| Variable                   | Description                              |
| -------------------------- | ---------------------------------------- |
| `DOTMAN_PROJECT_NAME`      | Your project name                        |
| `OP_VAULT_NAME`            | The 1Password vault to use               |
| `OP_SERVICE_ACCOUNT_TOKEN` | Service account token for authentication |

**Getting a Service Account Token:**

1. Go to [1Password.com](https://1password.com) → Settings → Developer → Service Accounts
2. Create a new service account with access to your vault
3. Copy the token

📖 [1Password Service Accounts Documentation](https://developer.1password.com/docs/service-accounts/)

### Bitwarden

To use Bitwarden as your storage provider, you'll need:

| Variable              | Description                              |
| --------------------- | ---------------------------------------- |
| `DOTMAN_PROJECT_NAME` | Your project name                        |
| `BWS_ACCESS_TOKEN`    | Bitwarden Secrets Manager access token   |
| `BWS_ORGANIZATION_ID` | Your organization ID                     |
| `BWS_API_URL`         | API URL (optional, for self-hosted)      |
| `BWS_IDENTITY_URL`    | Identity URL (optional, for self-hosted) |

**Getting an Access Token:**

1. Go to Bitwarden → Organizations → Secrets Manager → Access Tokens
2. Create a new access token for your project

📖 [Bitwarden Access Tokens Documentation](https://bitwarden.com/help/access-tokens/)

## Environment Files

dotman uses a simple naming convention:

| File          | Description                             |
| ------------- | --------------------------------------- |
| `.env`        | Master file with provider configuration |
| `.env.<name>` | Any environment name you choose         |

The part after `.env.` becomes the environment name. For example:

- `.env.dev` → environment name is `dev`
- `.env.staging` → environment name is `staging`
- `.env.production` → environment name is `production`
- `.env.local-test` → environment name is `local-test`

### About the Master `.env` File

The master `.env` file primarily stores the configuration keys needed to connect to your secrets provider (like `OP_SERVICE_ACCOUNT_TOKEN` for 1Password or `BWS_ACCESS_TOKEN` for Bitwarden).

While you _can_ add application-specific variables to the master `.env` file and they will be loaded alongside your environment-specific variables, **it's recommended to create a separate environment** (e.g., `.env.dev`, `.env.local`) for your application variables. This keeps things cleaner and makes it easier to:

- Manage different configurations per environment
- Share environment-specific secrets with your team via the vault
- Avoid confusion between provider config and app variables

> **Note:** All `.env*` files should be added to `.gitignore` and never committed to version control.

## Workflow Example

Here's a typical team workflow:

```bash
# Initial setup (one-time)
dotman init

# During development
dotman env use dev
dotman pull --apply        # Get latest env vars
dotman load -- npm run dev # Run with loaded env

# Add new variables
echo "NEW_API_KEY=abc123" >> .env.dev
dotman push --apply        # Share with team

# Deploy to production
dotman env use prod
dotman pull --apply
dotman load -- npm start
```

## Security Notes

- **Never commit environment files** – Add `.env*` to your `.gitignore` to exclude all env files (`.env`, `.env.dev`, `.env.prod`, etc.)
- **Use service accounts** – Create dedicated tokens with minimal permissions
- **Rotate tokens regularly** – Update your service account tokens periodically
- The provider tokens (like `OP_SERVICE_ACCOUNT_TOKEN`) are stored locally in your `.env` file

## Development

```bash
# Install dependencies
pnpm install

# Run in development
pnpm dev

# Build
pnpm build

# Run tests
pnpm test

# Format code
pnpm format

# Lint and fix
pnpm check:write
```

## License

MIT
