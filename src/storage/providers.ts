import { errAsync, type ResultAsync } from "neverthrow";
import { toJSONSchema } from "zod";
import { constants } from "@/constants";
import { env_map_op_schema } from "@/lib/env_schema";
import { CustomError } from "@/lib/error";
import type { EnvMap, FieldMetadata, StorageClient } from "@/lib/types";
import { BitwardenStorageClient, env_map_bw_schema } from "./clients/bw";
import { ContentstackLaunchStorageClient, env_map_cs_launch_schema } from "./clients/cs-launch";
import { OnePasswordStorageClient } from "./clients/op";

export const PROVIDER_REGISTRY = {
  onepassword: {
    key: "onepassword" as const,
    label: "1Password" as const,
    env_map_schema: env_map_op_schema,
    is_available: (env_map: EnvMap) => Boolean(env_map[constants.op_service_account_token]),
    create: (env_map: Record<string, string>): ResultAsync<StorageClient, CustomError> => {
      const env_map_parse_res = env_map_op_schema.safeParse(env_map);
      if (!env_map_parse_res.success) {
        const err_msg = env_map_parse_res.error.issues
          .map((iss) => `"${iss.path.join("")}" environment variable is required`)
          .join("\n");
        return errAsync(new CustomError(`${err_msg}`));
      }
      const env_map_parsed = env_map_parse_res.data;

      return OnePasswordStorageClient.init(env_map_parsed).map((client) => {
        const storage_client = new OnePasswordStorageClient(client, env_map_parsed);
        return storage_client;
      });
    },
    get_env_map_keys: () => {
      const properties = toJSONSchema(env_map_op_schema).properties;
      if (!properties) {
        return [];
      }
      return Object.keys(properties);
    },
    get_field_metadata: (): Record<string, FieldMetadata> => ({
      DOTMAN_PROJECT_NAME: {
        description: "Enter your project name",
        hint: "e.g., 'my-app', 'api-service'",
      },
      OP_VAULT_NAME: {
        description: "Which 1Password vault should we use?",
        hint: "View your vaults at 1password.com",
      },
      OP_SERVICE_ACCOUNT_TOKEN: {
        description: "Enter your 1Password service account token",
        hint: "Generate at: 1Password Settings → Developer → Service Accounts",
        doc_url: "https://developer.1password.com/docs/service-accounts/",
        is_secret: true,
      },
    }),
  },
  bitwarden: {
    key: "bitwarden" as const,
    label: "BitWarden" as const,
    env_map_schema: env_map_bw_schema,
    is_available: (env_map: EnvMap) => Boolean(env_map.BWS_ACCESS_TOKEN),
    create: (env_map: Record<string, string>): ResultAsync<StorageClient, CustomError> => {
      const env_map_parse_res = env_map_bw_schema.safeParse(env_map);
      if (!env_map_parse_res.success) {
        const err_msg = env_map_parse_res.error.issues
          .map((iss) => `"${iss.path.join("")}" environment variable is required`)
          .join("\n");
        return errAsync(new CustomError(`${err_msg}`));
      }
      const env_map_parsed = env_map_parse_res.data;

      return BitwardenStorageClient.init(env_map_parsed).map((client) => {
        const storage_client = new BitwardenStorageClient(client, env_map_parsed);
        return storage_client;
      });
    },
    get_env_map_keys: () => {
      const properties = toJSONSchema(env_map_bw_schema).properties;
      if (!properties) {
        return [];
      }
      return Object.keys(properties);
    },
    get_field_metadata: (): Record<string, FieldMetadata> => ({
      DOTMAN_PROJECT_NAME: {
        description: "Enter your project name",
        hint: "e.g., 'my-app', 'api-service'",
      },
      BWS_ACCESS_TOKEN: {
        description: "Enter your Bitwarden access token",
        hint: "Generate at: Bitwarden → Organizations → Secrets Manager → Access Tokens",
        doc_url: "https://bitwarden.com/help/access-tokens/",
        is_secret: true,
      },
      BWS_ORGANIZATION_ID: {
        description: "Enter your organization ID",
        hint: "Find it in your Bitwarden organization settings or URL",
      },
      BWS_API_URL: {
        description: "API endpoint URL (optional)",
        is_optional: true,
        default_value: "https://api.bitwarden.com",
      },
      BWS_IDENTITY_URL: {
        description: "Identity endpoint URL (optional)",
        is_optional: true,
        default_value: "https://identity.bitwarden.com",
      },
    }),
  },
  cs_launch: {
    key: "cs_launch" as const,
    label: "Contentstack Launch" as const,
    env_map_schema: env_map_cs_launch_schema,
    is_available: (env_map: EnvMap) => Boolean(env_map[constants.cs_launch_auth_token]),
    create: (env_map: Record<string, string>): ResultAsync<StorageClient, CustomError> => {
      const env_map_parse_res = env_map_cs_launch_schema.safeParse(env_map);
      if (!env_map_parse_res.success) {
        const err_msg = env_map_parse_res.error.issues
          .map((iss) => `"${iss.path.join("")}" environment variable is required`)
          .join("\n");
        return errAsync(new CustomError(`${err_msg}`));
      }
      const env_map_parsed = env_map_parse_res.data;

      return ContentstackLaunchStorageClient.init(env_map_parsed).map((validated_env_map) => {
        return new ContentstackLaunchStorageClient(validated_env_map);
      });
    },
    get_env_map_keys: () => {
      const properties = toJSONSchema(env_map_cs_launch_schema).properties;
      if (!properties) {
        return [];
      }
      return Object.keys(properties);
    },
    get_field_metadata: (): Record<string, FieldMetadata> => ({
      DOTMAN_PROJECT_NAME: {
        description: "Enter your project name",
        hint: "e.g., 'my-app', 'api-service'",
      },
      CS_LAUNCH_AUTH_TOKEN: {
        description: "Enter your Contentstack Launch authtoken",
        hint: "Obtain by logging in via the Content Management API login endpoint",
        doc_url: "https://www.contentstack.com/docs/developers/apis/launch-api#how-to-get-authtoken",
        is_secret: true,
      },
      CS_LAUNCH_ORGANIZATION_UID: {
        description: "Enter your Contentstack organization UID",
        hint: "Find it in your Contentstack organization settings or URL",
      },
      CS_LAUNCH_PROJECT_UID: {
        description: "Enter your Launch project UID",
        hint: "Find it in your Launch project URL or settings",
      },
      CS_LAUNCH_API_URL: {
        description: "Launch API endpoint URL (optional)",
        is_optional: true,
        default_value: "https://launch-api.contentstack.com",
      },
    }),
  },
};
