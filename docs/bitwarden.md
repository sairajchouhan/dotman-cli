# Bitwarden Secrets Manager Setup Guide

This guide walks you through setting up Bitwarden Secrets Manager to use with dotman. By the end, you'll have all the credentials needed to securely manage your environment variables.

> [!IMPORTANT]
> dotman requires **Bitwarden Secrets Manager**, which is different from the regular Bitwarden password manager. Secrets Manager is a separate product designed for managing application secrets and environment variables.

## Prerequisites

- A Bitwarden account (create one at [bitwarden.com](https://bitwarden.com))
- Access to a web browser

## What You'll Set Up

| Credential            | Description                                  |
| --------------------- | -------------------------------------------- |
| `BWS_ACCESS_TOKEN`    | Authentication token for programmatic access |
| `BWS_ORGANIZATION_ID` | Your organization's unique identifier        |
| `DOTMAN_PROJECT_NAME` | Name for your dotman project                 |

## Step 1: Create a Bitwarden Organization

If you already have an organization, skip to [Step 2](#step-2-enable-secrets-manager).

1. Log in to the [Bitwarden Web Vault](https://vault.bitwarden.com)
2. In the left sidebar, click on **Vaults**
3. Under "All vaults", click **New organization**
4. Choose the **Free** plan
5. Enter your organization name and billing email
6. Scroll to the bottom of the page to the **More from Bitwarden** section
7. Check the checkbox **Subscribe to Secrets Manager**
8. Complete the setup

## Step 2: Enable Secrets Manager

1. Open the [Bitwarden Admin Console](https://vault.bitwarden.com) for your organization
2. Navigate to **Billing → Subscription**
3. In the **More from Bitwarden** section, check **Subscribe to Secrets Manager**
4. Click **Submit** (Free plan) or **Save** (paid plans)

After enabling, you should see "Secrets Manager" in the product switcher at the top of the page.

## Step 3: Access Secrets Manager

1. Click the **product switcher** in the top navigation (it may say "Password Manager")
2. Select **Secrets Manager**
3. You'll see your empty Secrets Manager vault

## Step 4: Create a Machine Account

Machine accounts provide programmatic access to your secrets. dotman uses a machine account to read and write your environment variables.

1. In Secrets Manager, click **New → Machine account**
2. Enter a name (e.g., "dotman-cli")
3. Click **Save**
4. Open the newly created machine account
5. Go to the **Projects** tab
6. You'll assign project access later when dotman creates projects for you

> [!NOTE]
> For dotman to work properly, the machine account needs **Can read, write** permission on projects. When you run `dotman init`, it will create a project, and you'll need to grant your machine account access to it.

## Step 5: Generate an Access Token

1. In Secrets Manager, go to **Machine accounts**
2. Click on your machine account (e.g., "dotman-cli")
3. Go to the **Access tokens** tab
4. Click **Create access token**
5. Enter a name (e.g., "dotman-token")
6. Set expiration (recommend: Never, or a long duration)
7. Click **Create access token**
8. **⚠️ Copy the token immediately** – it won't be shown again!

Save this token securely. This will be your `BWS_ACCESS_TOKEN`.

## Step 6: Find Your Organization ID

Your Organization ID is visible in the Secrets Manager URL:

```
https://vault.bitwarden.com/#/sm/{YOUR_ORGANIZATION_ID}/projects
                               ^^^^^^^^^^^^^^^^^^^^^^^^^^
```

Copy this ID – it will be your `BWS_ORGANIZATION_ID`.

**Alternative method:**

1. Go to Admin Console → **Settings → Organization info**
2. The Organization ID is displayed there

## Step 7: Configure dotman

Now you have everything you need! Run the dotman initialization:

```bash
dotman init
```

When prompted, select **Bitwarden** as your provider and enter:

- **Project name**: Your project name (e.g., "my-app")
- **Access token**: The token you copied in Step 5
- **Organization ID**: The ID from Step 6

dotman will create a `.env` file with your configuration.

## Step 8: Grant Machine Account Access

After running `dotman init`, dotman creates a project in Secrets Manager. You need to grant your machine account access to it:

1. In Secrets Manager, find the project dotman created (named like "my-app-dev")
2. Click on the project
3. Go to the **Machine Accounts** tab
4. Add your machine account with **Can read, write** permission

Now you're ready to use dotman with Bitwarden!

## Quick Reference

After setup, your `.env` file should contain:

```bash
DOTMAN_PROJECT_NAME=your-project-name
BWS_ACCESS_TOKEN=0.xxxxxx.xxxxxxxx:xxxxxxxxx==
BWS_ORGANIZATION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> [!NOTE]
> **Credential Security**: The configuration variables (`BWS_ACCESS_TOKEN`, `BWS_ORGANIZATION_ID`, `DOTMAN_PROJECT_NAME`) stored in your `.env` file are **never** pushed to your secret vault. They remain local to your machine only. These credentials are automatically filtered out during `dotman push` operations.

## Troubleshooting

### "Could not initialize Bitwarden sdk"

- Verify your `BWS_ACCESS_TOKEN` is correct and not expired
- Check that the token has not been revoked

### "Could not list projects" or "Could not access secrets"

- Ensure your machine account has access to the project
- Verify the machine account has **Can read, write** permission

### "Could not create project"

- Check that your organization hasn't exceeded the project limit (3 for Free tier)
- Verify your machine account exists and the access token is valid

## Next Steps

- [Push your first environment variables](../README.md#2-push-environment-variables)
- [Learn about environment management](../README.md#environment-files)
- [Explore the CLI commands](../README.md#commands)

## Helpful Links

- [Bitwarden Secrets Manager Documentation](https://bitwarden.com/help/secrets-manager-overview/)
- [Access Tokens Guide](https://bitwarden.com/help/access-tokens/)
- [Machine Accounts Guide](https://bitwarden.com/help/machine-accounts/)
