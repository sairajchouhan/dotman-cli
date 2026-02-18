# Contentstack Launch Setup Guide

This guide walks you through setting up Contentstack Launch to use with dotman. By the end, you'll have all the credentials needed to securely manage your environment variables.

> [!IMPORTANT]
> dotman currently uses **Launch API auth token headers** (`authtoken` + `organization_uid`) for Contentstack Launch API calls.

## Prerequisites

- A Contentstack account with access to Launch
- A Launch project already created (dotman does not create Launch projects)
- Access to the Contentstack API docs ("Run in Swagger" is helpful for generating auth tokens)

## What You'll Set Up

| Credential                      | Description                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| `CS_LAUNCH_AUTH_TOKEN`          | User auth token for Launch API requests                        |
| `CS_LAUNCH_ORGANIZATION_UID`    | Your Contentstack organization UID                             |
| `CS_LAUNCH_PROJECT_UID`         | Launch project UID                                             |
| `CS_LAUNCH_API_URL`             | Launch API base URL (optional, defaults to NA region)          |
| `DOTMAN_PROJECT_NAME`           | Name for your dotman project                                   |

## Step 1: Get Your Organization UID

Get the Organization UID from Organization Information in the new navigation:

1. Log in to your Contentstack account.
2. Click your **Profile** menu in the top-right and switch to the organization you use for Launch.
3. Click the **9-dot App Switcher** in the top-right and open **Administration**.
4. Open **Organization Information** (or the **Info** tab, depending on your account UI).
5. Copy the **Organization ID** value shown there.

Use this value as `CS_LAUNCH_ORGANIZATION_UID`.

> [!NOTE]
> You need Owner/Admin access to view Organization Info and Organization ID.
> If you do not have this access, ask your Organization Owner/Admin to share the Organization ID.

## Step 2: Get Your Launch Project UID

Get the Launch Project UID from Launch project settings:

1. Click the **9-dot App Switcher** in the top-right and open **Launch**.
2. Select the Launch project you want dotman to manage.
3. Click the project **Settings** icon.
4. Open **General** and go to **Project Details**.
5. Copy the **Project UID** value.

Save this as `CS_LAUNCH_PROJECT_UID`.

## Step 3: Generate an Auth Token

Generate your auth token by following this exact guide:

https://www.contentstack.com/docs/developers/apis/launch-api#how-to-get-authtoken

Complete the steps in that section and copy the `authtoken` value from the response.

Save this as `CS_LAUNCH_AUTH_TOKEN`.

> [!WARNING]
> Contentstack mentions a limit of 20 valid user auth tokens at a time. Creating a new one can expire the oldest token.

## Step 4: Confirm Your Launch API Base URL (Optional)

dotman defaults to:

```bash
https://launch-api.contentstack.com
```

If your Launch project is in another region, set `CS_LAUNCH_API_URL` to that region-specific Launch API URL (for example `https://eu-launch-api.contentstack.com`).

Known Launch API base URLs from Contentstack docs:

| Region     | Base URL                                      |
| ---------- | --------------------------------------------- |
| NA         | `https://launch-api.contentstack.com`         |
| EU         | `https://eu-launch-api.contentstack.com`      |
| Azure NA   | `https://azure-na-launch-api.contentstack.com` |
| Azure EU   | `https://azure-eu-launch-api.contentstack.com` |

> [!NOTE]
> dotman validates that `CS_LAUNCH_API_URL` uses HTTPS.

## Step 5: Understand Environment Mapping

dotman uses this environment mapping with Contentstack Launch:

- `master` (the `.env` file) maps to Launch environment **`Default`**
- For non-`master` environments, dotman maps by the same name. Example: `.env.stag` syncs with Launch environment `stag`.
- Launch environments must be created by you in Contentstack; dotman does not create Launch environments

When you run `dotman env new <name>`, dotman first checks whether Launch environment `<name>` exists in your configured project (`CS_LAUNCH_PROJECT_UID`). It creates local `.env.<name>` only after that validation passes.

Example: if your Launch project already has environment `stag`, then `dotman env new stag` creates local `.env.stag`, and `dotman push -e stag --apply` syncs variables with Launch environment `stag`.

## Step 6: Configure dotman

Run:

```bash
dotman init
```

When prompted, select **Contentstack Launch** and enter:

- **Project name**: your dotman project name (for example `my-app`)
- **Auth token**: `CS_LAUNCH_AUTH_TOKEN`
- **Organization UID**: `CS_LAUNCH_ORGANIZATION_UID`
- **Launch project UID**: `CS_LAUNCH_PROJECT_UID`
- **Launch API URL**: optional (`CS_LAUNCH_API_URL`)

dotman will create/update your `.env` file and validate your Launch project connectivity.

## Launch-Specific Notes

- Empty values are not allowed in Launch environment variables. `dotman push --apply` will fail if any variable value is empty.
- During initialization, dotman validates connectivity by calling `GET /projects/{project_uid}`.
- dotman requires an existing Launch project and existing Launch environments; it validates them but does not create them for you.

## Quick Reference

After setup, your `.env` file should contain:

```bash
DOTMAN_PROJECT_NAME=your-project-name
CS_LAUNCH_AUTH_TOKEN=your_authtoken
CS_LAUNCH_ORGANIZATION_UID=your_org_uid
CS_LAUNCH_PROJECT_UID=your_project_uid
CS_LAUNCH_API_URL=https://launch-api.contentstack.com
```

> [!NOTE]
> **Credential Security**: The configuration variables (`CS_LAUNCH_AUTH_TOKEN`, `CS_LAUNCH_ORGANIZATION_UID`, `CS_LAUNCH_PROJECT_UID`, `CS_LAUNCH_API_URL`, `DOTMAN_PROJECT_NAME`) in your `.env` file are never pushed to Launch as environment variables.

## Helpful Links

- [Launch API Documentation](https://www.contentstack.com/docs/developers/apis/launch-api)
- [How to Get `authtoken`](https://www.contentstack.com/docs/developers/apis/launch-api#how-to-get-authtoken)
- [Contentstack Home and Top Navigation (App Switcher + profile org switch)](https://www.contentstack.com/docs/navigating-contentstack)
- [Switch Between Organizations](https://www.contentstack.com/docs/developers/organization/switch-between-organizations)
- [Organization Settings Overview](https://www.contentstack.com/docs/developers/organization/organization-settings-overview)
- [Organization Information (where Organization ID is shown)](https://www.contentstack.com/docs/developers/organization/organization-information)
- [Launch Environments](https://www.contentstack.com/docs/developers/launch/environments)
- [Launch Environment Variables](https://www.contentstack.com/docs/developers/launch/environment-variables/)
- [Content Management API - User Session](https://www.contentstack.com/docs/developers/apis/content-management-api)
