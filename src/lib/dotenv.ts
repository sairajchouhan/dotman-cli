import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "dotenv";
import dotenv_stringify from "dotenv-stringify";
import { errAsync, Result, ResultAsync } from "neverthrow";
import { CustomError } from "./error";
import type { EnvMap } from "./types";

interface FileSystemError extends Error {
  code?: string;
  errno?: number;
  path?: string;
  syscall?: string;
}

export function write_env(items: Record<string, string>, env_file_name: string): ResultAsync<void, CustomError> {
  const safe_dotenv_stringify = Result.fromThrowable(dotenv_stringify);
  // TODO: check if things works in windows since the lib joins strings by `\n`
  // https://github.com/compwright/dotenv-stringify/blob/master/src/index.js#L34
  const final_str_res = safe_dotenv_stringify(items);

  if (final_str_res.isErr()) {
    return errAsync(new CustomError("Could not process to a string"));
  }
  const final_str = final_str_res.value;

  const cwd = process.cwd();
  const final_path = path.resolve(cwd, env_file_name);
  const canonical_cwd = path.resolve(cwd);

  if (!final_path.startsWith(canonical_cwd + path.sep) && final_path !== canonical_cwd) {
    return errAsync(new CustomError("Cannot write files outside of current working directory"));
  }

  // Check for symlinks (security: prevent symlink attacks)
  return ResultAsync.fromPromise(
    fs.lstat(final_path).catch(() => null),
    () => new CustomError("Could not check file status"),
  ).andThen((stats) => {
    if (stats?.isSymbolicLink()) {
      return errAsync(
        new CustomError(`Symlinks are not permitted for security reasons: "${env_file_name}"`, {
          suggestion: "Use a regular file instead of a symlink",
        }),
      );
    }
    return ResultAsync.fromPromise(
      fs.writeFile(final_path, final_str, { mode: 0o600 }),
      () => new CustomError(`Could not update "${env_file_name}" file`),
    );
  });
}

export function read_env(env_file_name: string): ResultAsync<EnvMap, CustomError> {
  const cwd = process.cwd();
  const final_path = path.resolve(cwd, env_file_name);
  const canonical_cwd = path.resolve(cwd);

  if (!final_path.startsWith(canonical_cwd + path.sep) && final_path !== canonical_cwd) {
    return errAsync(new CustomError("Cannot read files outside of current working directory"));
  }

  const fs_read_file = ResultAsync.fromThrowable(fs.readFile, (err) => err as FileSystemError);
  const safe_parse = Result.fromThrowable(parse, (err) => err as Error);

  // Check for symlinks (security: prevent symlink attacks)
  return ResultAsync.fromPromise(
    fs.lstat(final_path).catch((err) => {
      // If file doesn't exist, we'll let readFile handle the error
      if ((err as FileSystemError).code === "ENOENT") {
        return null;
      }
      throw err;
    }),
    (err) => err as FileSystemError,
  )
    .andThen((stats) => {
      if (stats?.isSymbolicLink()) {
        return errAsync(
          new CustomError(`Symlinks are not permitted for security reasons: "${env_file_name}"`, {
            suggestion: "Use a regular file instead of a symlink",
          }),
        );
      }
      return fs_read_file(final_path, "utf8");
    })
    .mapErr((err) => {
      if (err.code === "ENOENT") {
        return new CustomError(`Environment file "${env_file_name}" not found`, {
          suggestion: `Create the file "${env_file_name}" in your current directory (${process.cwd()}) or specify a different environment with --env`,
          cause: err,
        });
      }
      return new CustomError(`Failed to read "${env_file_name}": ${err.message}`, {
        suggestion: "Check that the file exists and is accessible",
        cause: err,
      });
    })
    .andThen((content) => {
      const content_str = content.toString();
      if (content_str.trim() === "") {
        return ResultAsync.fromSafePromise(Promise.resolve({}));
      }

      const parsed_content = safe_parse(content_str);
      return parsed_content.match(
        (env_map) => ResultAsync.fromSafePromise(Promise.resolve(env_map)),
        () =>
          errAsync(
            new CustomError(`Failed to parse environment file "${env_file_name}"`, {
              suggestion: "Check that your .env file contains valid KEY=VALUE pairs and fix any syntax errors",
            }),
          ),
      );
    });
}

export interface ReadEnvFilesResult {
  env_map: EnvMap;
  environment_env_map: EnvMap;
  env_file_name: string;
}

export function read_env_files(environment?: string): ResultAsync<ReadEnvFilesResult, CustomError> {
  const env_file_name = environment && environment !== "master" ? `.env.${environment}` : ".env";

  if (!environment) {
    return read_env(".env").map((env_map) => ({
      env_map,
      environment_env_map: env_map,
      env_file_name,
    }));
  }

  return read_env(".env").andThen((env_map) =>
    read_env(env_file_name).map((environment_env_map) => ({
      env_map,
      environment_env_map,
      env_file_name,
    })),
  );
}
