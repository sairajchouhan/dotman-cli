import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "dotenv";
import dotenv_stringify from "dotenv-stringify";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { messages } from "@/messages";
import { CustomError } from "./error";
import type { EnvMap } from "./types";

interface FileSystemError extends Error {
  code?: string;
  errno?: number;
  path?: string;
  syscall?: string;
}

// ============================================================================
// Security Validation Helpers
// ============================================================================

/**
 * Validates that a file path doesn't escape the current working directory.
 * This prevents path traversal attacks (e.g., "../../../etc/passwd").
 */
function validate_path_security(env_file_name: string, operation: "read" | "write"): ResultAsync<string, CustomError> {
  const cwd = process.cwd();
  const final_path = path.resolve(cwd, env_file_name);
  const canonical_cwd = path.resolve(cwd);

  // Ensure the resolved path is within the current working directory
  const is_within_cwd = final_path.startsWith(canonical_cwd + path.sep) || final_path === canonical_cwd;

  if (!is_within_cwd) {
    return errAsync(new CustomError(messages.dotenv.path_outside_cwd(operation)));
  }

  return okAsync(final_path);
}

/**
 * Checks if a file is a symlink and rejects it for security reasons.
 * Symlink attacks can redirect file operations to unintended locations.
 *
 * Returns null if the file doesn't exist (which is handled separately).
 */
function check_symlink_security(final_path: string, env_file_name: string): ResultAsync<void, CustomError> {
  return ResultAsync.fromPromise(
    fs.lstat(final_path).catch((err: FileSystemError) => {
      // If file doesn't exist, return null (we'll handle this in the caller)
      if (err.code === "ENOENT") {
        return null;
      }
      throw err;
    }),
    (err) =>
      new CustomError(messages.dotenv.check_file_status_failed, {
        cause: err as Error,
      }),
  ).andThen((stats) => {
    if (stats?.isSymbolicLink()) {
      return errAsync(
        new CustomError(messages.dotenv.symlink_not_permitted(env_file_name), {
          suggestion: messages.dotenv.symlink_suggestion,
        }),
      );
    }
    return okAsync(undefined);
  });
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Writes environment variables to a file in the current working directory.
 * Security: Prevents path traversal and symlink attacks.
 */
export function write_env(items: Record<string, string>, env_file_name: string): ResultAsync<void, CustomError> {
  // Step 1: Validate the path is safe
  return validate_path_security(env_file_name, "write")
    .andThen((final_path) =>
      // Step 2: Convert env object to dotenv string format
      ResultAsync.fromPromise(
        Promise.resolve(dotenv_stringify(items)),
        () => new CustomError(messages.dotenv.stringify_failed),
      ).map((final_str) => ({ final_path, final_str })),
    )
    .andThen(({ final_path, final_str }) =>
      // Step 3: Check for symlinks before writing
      check_symlink_security(final_path, env_file_name).map(() => ({ final_path, final_str })),
    )
    .andThen(({ final_path, final_str }) =>
      // Step 4: Write the file with restricted permissions (0o600 = owner read/write only)
      ResultAsync.fromPromise(
        fs.writeFile(final_path, final_str, { mode: 0o600 }),
        () => new CustomError(messages.dotenv.write_failed(env_file_name)),
      ),
    );
}

/**
 * Reads and parses environment variables from a file in the current working directory.
 * Security: Prevents path traversal and symlink attacks.
 */
export function read_env(env_file_name: string): ResultAsync<EnvMap, CustomError> {
  // Step 1: Validate the path is safe
  return validate_path_security(env_file_name, "read")
    .andThen((final_path) =>
      // Step 2: Check for symlinks before reading
      check_symlink_security(final_path, env_file_name).map(() => final_path),
    )
    .andThen((final_path) =>
      // Step 3: Read the file contents
      ResultAsync.fromPromise(fs.readFile(final_path, "utf8"), (err) => err as FileSystemError).mapErr((err) => {
        if (err.code === "ENOENT") {
          return new CustomError(messages.dotenv.file_not_found(env_file_name), {
            suggestion: messages.dotenv.file_not_found_suggestion(env_file_name),
            cause: err,
          });
        }
        return new CustomError(messages.dotenv.read_failed(env_file_name, err.message), {
          suggestion: messages.dotenv.read_failed_suggestion,
          cause: err,
        });
      }),
    )
    .andThen((content) => {
      // Step 4: Handle empty files
      if (content.trim() === "") {
        return okAsync({});
      }

      // Step 5: Parse the dotenv content
      return ResultAsync.fromPromise(
        Promise.resolve(parse(content)),
        () =>
          new CustomError(messages.dotenv.parse_failed(env_file_name), {
            suggestion: messages.dotenv.parse_failed_suggestion,
          }),
      );
    });
}

interface ReadEnvFilesResult {
  env_map: EnvMap;
  environment_env_map: EnvMap;
  env_file_name: string;
}

/**
 * Reads environment files based on the specified environment.
 * - No environment: reads only .env
 * - With environment: reads both .env and .env.{environment}
 */
export function read_env_files(environment?: string): ResultAsync<ReadEnvFilesResult, CustomError> {
  const env_file_name = environment && environment !== "master" ? `.env.${environment}` : ".env";

  // If no environment specified, just read the base .env file
  if (!environment) {
    return read_env(".env").map((env_map) => ({
      env_map,
      environment_env_map: env_map,
      env_file_name,
    }));
  }

  // Read base .env first, then the environment-specific file
  return read_env(".env").andThen((env_map) =>
    read_env(env_file_name).map((environment_env_map) => ({
      env_map,
      environment_env_map,
      env_file_name,
    })),
  );
}
