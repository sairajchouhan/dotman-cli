import type { Secret } from "./types";

export interface DiffChange {
  type: "added" | "modified" | "deleted";
  key: string;
  new_value?: string;
  old_value?: string;
}

export interface DiffResult {
  changes: DiffChange[];
  added_count: number;
  modified_count: number;
  deleted_count: number;
  total_count: number;
}

export function calculate_push_diff(
  filtered_env_map: Record<string, string>,
  secrets_map: Map<string, Secret>,
): DiffResult {
  const changes: DiffChange[] = [];
  let added_count = 0;
  let modified_count = 0;
  let deleted_count = 0;

  for (const [env_key, env_value] of Object.entries(filtered_env_map)) {
    const existing_secret = secrets_map.get(env_key);
    if (existing_secret) {
      if (existing_secret.value !== env_value) {
        changes.push({
          type: "modified",
          key: env_key,
          new_value: env_value,
          old_value: existing_secret.value,
        });
        modified_count++;
      }
    } else {
      changes.push({
        type: "added",
        key: env_key,
        new_value: env_value,
      });
      added_count++;
    }
  }

  for (const [secret_key, secret_value] of secrets_map) {
    if (secret_value && !filtered_env_map[secret_key]) {
      changes.push({
        type: "deleted",
        key: secret_key,
        old_value: secret_value.value,
      });
      deleted_count++;
    }
  }

  return {
    changes,
    added_count,
    modified_count,
    deleted_count,
    total_count: added_count + modified_count + deleted_count,
  };
}

export function calculate_pull_diff(
  local_env_map: Record<string, string>,
  remote_secrets_map: Record<string, string>,
  client_env_keys: string[],
): DiffResult {
  const changes: DiffChange[] = [];
  let added_count = 0;
  let modified_count = 0;
  let deleted_count = 0;

  for (const [remote_key, remote_value] of Object.entries(remote_secrets_map)) {
    const local_value = local_env_map[remote_key];
    if (!local_value) {
      changes.push({
        type: "added",
        key: remote_key,
        new_value: remote_value,
      });
      added_count++;
    } else if (local_value !== remote_value) {
      changes.push({
        type: "modified",
        key: remote_key,
        old_value: local_value,
        new_value: remote_value,
      });
      modified_count++;
    }
  }

  for (const [local_key, local_value] of Object.entries(local_env_map)) {
    if (!remote_secrets_map[local_key] && !client_env_keys.includes(local_key)) {
      changes.push({
        type: "deleted",
        key: local_key,
        old_value: local_value,
      });
      deleted_count++;
    }
  }

  return {
    changes,
    added_count,
    modified_count,
    deleted_count,
    total_count: added_count + modified_count + deleted_count,
  };
}
