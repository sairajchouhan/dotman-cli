import { errAsync, type ResultAsync } from "neverthrow";
import { CustomError } from "@/lib/error";
import type { EnvMap, StorageClient } from "@/lib/types";
import { PROVIDER_REGISTRY } from "./providers";

/**
 * @description this function is responsible to create the storage client, the method `create` of every provider initializes the
 * storage client, validates the required env vars and returns a `StorageClient`
 * **/
export function create_storage_client(env_map: EnvMap): ResultAsync<StorageClient, CustomError> {
  const available_providers = Object.values(PROVIDER_REGISTRY).filter((provider) => provider.is_available(env_map));
  if (available_providers.length > 1) {
    return errAsync(
      new CustomError(
        "More than one source environment variables are available, filter environment variables to only include one client",
      ),
    );
  }

  if (available_providers.length <= 0) {
    return errAsync(new CustomError("No environment variables found that match any provider"));
  }

  const selected = available_providers[0];
  if (!selected) {
    return errAsync(
      new CustomError("Storage provider initialization failed", {
        suggestion: "This is an internal error. Please try again or raise an issue on the github repo",
      }),
    );
  }

  return selected.create(env_map);
}
