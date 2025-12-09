import z from "zod";

const base_env_map_schema = z.looseObject({
  DOTMAN_PROJECT_NAME: z.string().min(1, "Project name is required"),
});

export const env_map_op_schema = base_env_map_schema.extend({
  OP_VAULT_NAME: z.string().min(1, "Vault name is required"),
  OP_SERVICE_ACCOUNT_TOKEN: z.string().min(1, "Service account token is required"),
});
