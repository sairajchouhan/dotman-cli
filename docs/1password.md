# 1Password Setup Guide

This guide walks you through setting up 1Password to use with dotman. By the end, you'll have all the credentials needed to securely manage your environment variables.

> [!IMPORTANT]
> dotman uses **1Password Service Accounts** to access your vaults programmatically. This is different from your personal login.

## Prerequisites

- A 1Password account (create one at [1password.com](https://1password.com))
- Access to 1Password.com in your browser (Service Accounts cannot be managed from the desktop app yet)
- **Permission to create Service Accounts** (see [Troubleshooting](#troubleshooting-cant-create-service-accounts) if you don't see the option)

## What You'll Set Up

| Credential                 | Description                                    |
| -------------------------- | ---------------------------------------------- |
| `OP_SERVICE_ACCOUNT_TOKEN` | Authentication token for the service account   |
| `OP_VAULT_NAME`            | The name of the vault to store secrets in      |
| `DOTMAN_PROJECT_NAME`      | Name for your dotman project                   |

## Step 1: Create a Dedicated Vault

We strongly recommend creating a new, dedicated vault for your dotman secrets (e.g., "Development Secrets" or "Dotman").

> [!WARNING]
> **Do not use your existing "Personal", "Private", or "Employee" vaults.**
> Service accounts cannot access these vaults. It is best practice to keep machine secrets separate from personal passwords.

1. Log in to [1Password.com](https://my.1password.com)
2. Click **+ New Vault** in the sidebar
3. Name it (e.g., "Development Secrets")
4. Click **Create Vault**

## Step 2: Create a Service Account & Get Token

Service accounts provide programmatic access to specific vaults.

1. In 1Password.com, click **Developer** in the sidebar.
2. Click **Service Accounts**.
3. Click **Create a Service Account** (or the **+** button).
4. Enter a name (e.g., "dotman-cli").
5. Choose the vault(s) you want dotman to access (e.g., the one from Step 1).
   - Ensure you grant **Read** and **Write** permissions
6. Click **Create Account**.
7. **⚠️ Important:** A **Service Account Token** will be displayed (starts with `op_...`).
   - **Copy this token immediately** and save it securely. It will **never** be shown again.
   - You can also click "Save in 1Password" to store it in your vault.

This token is your `OP_SERVICE_ACCOUNT_TOKEN`.

## Step 3: Configure dotman

Now you have everything you need! Run the dotman initialization:

```bash
dotman init
```

When prompted, select **1Password** as your provider and enter:

- **Project name**: Your project name (e.g., "my-app")
- **Vault name**: The name of the vault you authorized (e.g., "Development Secrets")
- **Service Account Token**: The token you copied in Step 2

dotman will create a `.env` file with your configuration. You're now ready to use dotman with 1Password!

## Troubleshooting: Can't Create Service Accounts?

If you don't see the **Service Accounts** option or cannot create one, check the following settings with your 1Password administrator.

### 1. Enable Service Account Creation
By default, only Owners and Administrators can create service accounts. To allow other team members:
1. Go to **Developer** → **Permissions** → **Service Account**.
2. Click **Manage groups** or **Manage people**.
3. Add the relevant groups or users.


## Quick Reference

After setup, your `.env` file should contain:

```bash
DOTMAN_PROJECT_NAME=your-project-name
OP_VAULT_NAME=Development Secrets
OP_SERVICE_ACCOUNT_TOKEN=op_Hv2...
```

## Helpful Links

- [1Password Service Accounts Overview](https://developer.1password.com/docs/service-accounts/)
- [1Password Developer Portal](https://developer.1password.com/)
