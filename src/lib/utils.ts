import { errAsync, ResultAsync } from "neverthrow";
import { project_environment_separator } from "@/constants";
import { CustomError } from "@/lib/error";
import { messages } from "@/messages";
import { env_paths } from "./env-paths";
import { safe_fs_mkdir, safe_path_join } from "./safe";

export function get_project_name(base_project_name: string, environment?: string): string {
  // For master environment, use just the project name without suffix
  if (!environment || environment === "master") {
    return base_project_name;
  }
  return `${base_project_name}${project_environment_separator}${environment}`;
}

export function get_state_file_path(): ResultAsync<string, CustomError> {
  const file_name = "current-environment.json";
  const project_name = "dotman";

  const state_dir = env_paths(project_name).mapErr(
    (err) => new CustomError(messages.utils.state_path_error, { cause: err }),
  );

  const state_dir_created = state_dir.asyncAndThen((paths) =>
    safe_fs_mkdir(paths.state, { recursive: true }).map(() => paths.state),
  );

  const state_file_path = state_dir_created.andThen((state_path) => {
    const path_result = safe_path_join(state_path, file_name);
    if (path_result.isErr()) {
      return errAsync(path_result.error);
    }
    return ResultAsync.fromSafePromise(Promise.resolve(path_result.value));
  });

  return state_file_path;
}

export function mask_secret_value(value: string): string {
  if (!value) return "";
  return "*".repeat(value.length);
}

export function get_value_change_indicator(old_value: string, new_value: string): string {
  if (old_value === new_value) {
    return messages.utils.no_change;
  }

  if (old_value.length !== new_value.length) {
    return messages.utils.length_change(old_value.length, new_value.length);
  }

  return messages.utils.modified;
}
