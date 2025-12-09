import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Result, ResultAsync } from "neverthrow";
import { CustomError } from "./error";

export const safe_path_join = Result.fromThrowable(
  path.join,
  (error) => new CustomError("Path join failed", { cause: error as Error }),
);
export const safe_os_homedir = Result.fromThrowable(
  os.homedir,
  (error) => new CustomError("Failed to get home directory", { cause: error as Error }),
);

export const safe_fs_mkdir = ResultAsync.fromThrowable(
  fs.mkdir,
  (error) => new CustomError("Failed to create directory", { cause: error as Error }),
);

export const safe_fs_read_file = ResultAsync.fromThrowable(
  fs.readFile,
  (error) => new CustomError("Failed to read file", { cause: error as Error }),
);

export const safe_fs_read_dir = ResultAsync.fromThrowable(
  (path: string) => fs.readdir(path, { withFileTypes: true }),
  (error) => new CustomError("Failed to read directory", { cause: error as Error }),
);

export const safe_fs_write_file = ResultAsync.fromThrowable(
  fs.writeFile,
  (error) => new CustomError("Failed to write file", { cause: error as Error }),
);

export const safe_json_parse = Result.fromThrowable(
  JSON.parse,
  (error) => new CustomError("Failed to parse JSON", { cause: error as Error }),
);

export const safe_json_stringify = Result.fromThrowable(
  JSON.stringify,
  (error) => new CustomError("Failed to stringify JSON", { cause: error as Error }),
);
