import fs from "node:fs/promises";
import path from "node:path";
import { err, errAsync, ok, type Result, ResultAsync } from "neverthrow";
import { project_environment_separator } from "@/constants";
import { CustomError } from "@/lib/error";
import { messages } from "@/messages";
import { safe_fs_read_dir, safe_fs_read_file, safe_fs_write_file, safe_json_parse, safe_json_stringify } from "./safe";
import { get_state_file_path } from "./utils";

function validate_project_directory(cwd: string): ResultAsync<void, CustomError> {
  const env_file_path = path.resolve(cwd, ".env");
  return ResultAsync.fromPromise(
    fs.access(env_file_path),
    () =>
      // TODO:  we definitely can improve this check of validating project directory
      new CustomError(messages.environment.not_valid_project, {
        suggestion: messages.environment.not_valid_project_suggestion,
      }),
  ).map(() => undefined);
}

export function validate_environment_name(environment: string): Result<string, CustomError> {
  const trimmed = environment.trim();

  if (trimmed.length === 0) {
    return err(
      new CustomError(messages.environment.name_empty, {
        suggestion: messages.environment.name_empty_suggestion,
      }),
    );
  }

  if (trimmed.includes(project_environment_separator)) {
    return err(
      new CustomError(messages.environment.name_contains_separator, {
        suggestion: messages.environment.name_contains_separator_suggestion,
      }),
    );
  }

  const invalid_chars = ["/", "\\", "?", "*", ":", "|", "<", ">", '"'];
  const found_invalid_chars = invalid_chars.filter((char) => trimmed.includes(char));

  if (found_invalid_chars.length > 0) {
    return err(
      new CustomError(messages.environment.name_invalid_chars(found_invalid_chars.join(", ")), {
        suggestion: messages.environment.name_invalid_chars_suggestion,
      }),
    );
  }

  if (trimmed.includes("..")) {
    return err(
      new CustomError(messages.environment.name_path_traversal, {
        suggestion: messages.environment.name_path_traversal_suggestion,
      }),
    );
  }

  return ok(trimmed);
}

export function save_current_env(_environment: string): ResultAsync<void, CustomError> {
  const validated_environment = validate_environment_name(_environment);

  if (validated_environment.isErr()) {
    return errAsync(validated_environment.error);
  }

  const environment = validated_environment.value;
  const cwd = process.cwd();
  const state_file_path_res = get_state_file_path();

  return validate_project_directory(cwd).andThen(() => {
    const parsed_json = state_file_path_res.andThen((file_path) =>
      safe_fs_read_file(file_path, { encoding: "utf8" })
        .orElse((err) => {
          if (err.cause && (err.cause as NodeJS.ErrnoException).code === "ENOENT") {
            return safe_fs_write_file(file_path, "{}").map(() => "{}");
          }
          return errAsync(err);
        })
        .andThen((content) => {
          const parse_result = safe_json_parse(String(content));
          if (parse_result.isErr()) {
            return safe_fs_write_file(file_path, "{}").map(() => ({}));
          }
          return ResultAsync.fromSafePromise(Promise.resolve(parse_result.value));
        }),
    );

    const updated_json = parsed_json.map((json) => {
      const updated = { ...json, [cwd]: environment };
      return updated;
    });

    return updated_json
      .andThen((json) => safe_json_stringify(json))
      .andThen((json_string) =>
        state_file_path_res.andThen((file_path) => safe_fs_write_file(file_path, json_string, { encoding: "utf8" })),
      )
      .map(() => undefined);
  });
}

export function get_all_environments(): ResultAsync<string[], CustomError> {
  return safe_fs_read_dir(process.cwd())
    .map((files) => {
      return files
        .filter((file) => file.isFile() && (file.name === ".env" || file.name.startsWith(".env.")))
        .map((file) => {
          if (file.name === ".env") {
            return ok("master"); // Skip validation for base .env file
          }

          const env_name = file.name.slice(5);
          if (env_name.length === 0) {
            return err(new CustomError(messages.environment.name_empty));
          }

          // Filter out .env.master since "master" is reserved for the base .env file
          if (env_name === "master") {
            return err(new CustomError(messages.environment.name_master_reserved));
          }

          return validate_environment_name(env_name);
        })
        .filter((res) => res.isOk())
        .map((res) => res.value)
        .sort((a, b) => {
          if (a === "master") {
            return -1;
          }
          if (b === "master") {
            return 1;
          }
          return a.localeCompare(b);
        });
    })
    .mapErr((err) => new CustomError(messages.environment.failed_to_get_all, { cause: err }));
}

export function get_current_environment(): ResultAsync<string, CustomError> {
  return get_state_file_path().andThen((state_file_path) =>
    safe_fs_read_file(state_file_path, { encoding: "utf8" })
      .orElse((err) => {
        if (err.cause && (err.cause as NodeJS.ErrnoException).code === "ENOENT") {
          return ResultAsync.fromSafePromise(Promise.resolve("master"));
        }
        return errAsync(new CustomError(messages.environment.failed_to_read_state, { cause: err }));
      })
      .andThen((file_content) => {
        const parse_result = safe_json_parse(String(file_content));
        if (parse_result.isErr()) {
          return ResultAsync.fromSafePromise(Promise.resolve("master"));
        }

        const cwd = process.cwd();
        const parsed_value = parse_result.value;

        if (!Object.hasOwn(parsed_value, cwd)) {
          return ResultAsync.fromSafePromise(Promise.resolve("master"));
        }

        return ResultAsync.fromSafePromise(Promise.resolve(parsed_value[cwd]));
      }),
  );
}
