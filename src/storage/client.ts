import { errAsync, type ResultAsync } from "neverthrow";
import { CustomError } from "@/lib/error";
import type { EnvMap, StorageClient } from "@/lib/types";
import { messages } from "@/messages";
import { PROVIDER_REGISTRY } from "./providers";

/**
 * @description this function is responsible to create the storage client, the method `create` of every provider initializes the
 * storage client, validates the required env vars and returns a `StorageClient`
 * **/
export function create_storage_client(env_map: EnvMap): ResultAsync<StorageClient, CustomError> {
  const available_providers = Object.values(PROVIDER_REGISTRY).filter((provider) => provider.is_available(env_map));
  if (available_providers.length > 1) {
    return errAsync(new CustomError(messages.storage.multiple_providers));
  }

  if (available_providers.length <= 0) {
    return errAsync(new CustomError(messages.storage.no_provider));
  }

  const selected = available_providers[0];
  if (!selected) {
    return errAsync(
      new CustomError(messages.storage.init_failed, {
        suggestion: messages.storage.init_failed_suggestion,
      }),
    );
  }

  return selected.create(env_map);
}
