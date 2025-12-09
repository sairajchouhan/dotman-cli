import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as dotenv_module from "dotenv";
import * as dotenv_stringify_module from "dotenv-stringify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { read_env, read_env_files, write_env } from "@/lib/dotenv";

const original_cwd = process.cwd();
let temp_dir: string;

beforeEach(async () => {
  temp_dir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "dotman-dotenv-test-"));
  process.chdir(temp_dir);
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (temp_dir) {
    await fsPromises.rm(temp_dir, { recursive: true, force: true });
  }
  process.chdir(original_cwd);
});

describe("write_env", () => {
  it("writes environment variables to the current working directory", async () => {
    const result = await write_env({ FOO: "bar", BAZ: "qux" }, ".env.test");
    expect(result.isOk()).toBe(true);

    const contents = await fsPromises.readFile(path.join(temp_dir, ".env.test"), "utf8");
    expect(contents.trim().split("\n")).toContain("FOO=bar");
    expect(contents.trim().split("\n")).toContain("BAZ=qux");
  });

  it("prevents writing files outside the working directory", async () => {
    const result = await write_env({ FOO: "bar" }, "../outside.env");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("Cannot write files outside of current working directory");
    }
  });

  // Skip: Cannot spy on ESM module exports in vitest
  // See: https://vitest.dev/guide/browser/#limitations
  it.skip("propagates stringify failures", async () => {
    const stringify_spy = vi.spyOn(dotenv_stringify_module, "default").mockImplementation(() => {
      throw new Error("boom");
    });

    const result = await write_env({ FOO: "bar" }, ".env");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("Could not process to a string");
    }

    stringify_spy.mockRestore();
  });

  it("propagates filesystem write failures", async () => {
    const write_spy = vi.spyOn(fsPromises, "writeFile").mockRejectedValue(new Error("disk full"));

    const result = await write_env({ FOO: "bar" }, ".env.fail");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Could not update ".env.fail" file');
    }

    write_spy.mockRestore();
  });
});

describe("read_env", () => {
  it("reads environment variables from file", async () => {
    // biome-ignore lint/nursery/noSecrets: test data
    await fsPromises.writeFile(path.join(temp_dir, ".env.sample"), "FOO=bar\nBAZ=qux\n");

    const result = await read_env(".env.sample");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ FOO: "bar", BAZ: "qux" });
    }
  });

  it("returns empty map for blank files", async () => {
    await fsPromises.writeFile(path.join(temp_dir, ".env.empty"), "   \n\n");

    const result = await read_env(".env.empty");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({});
    }
  });

  it("errors when file does not exist", async () => {
    const result = await read_env(".env.missing");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Environment file ".env.missing" not found');
    }
  });

  it("errors when attempting to read outside working directory", async () => {
    const result = await read_env("../.env");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("Cannot read files outside of current working directory");
    }
  });

  // Skip: Cannot spy on ESM module exports in vitest
  // See: https://vitest.dev/guide/browser/#limitations
  it.skip("propagates parsing failures", async () => {
    await fsPromises.writeFile(path.join(temp_dir, ".env.bad"), "FOO=bar\n");

    const parse_spy = vi.spyOn(dotenv_module, "parse").mockImplementation(() => {
      throw new Error("invalid dotenv");
    });

    const result = await read_env(".env.bad");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Failed to parse environment file ".env.bad"');
    }

    parse_spy.mockRestore();
  });

  it("maps filesystem errors with suggestions", async () => {
    const error = Object.assign(new Error("EACCES: permission denied"), { message: "EACCES: permission denied" });
    const read_spy = vi.spyOn(fsPromises, "readFile").mockRejectedValue(error);

    const result = await read_env(".env.secure");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain('Failed to read ".env.secure"');
    }

    read_spy.mockRestore();
  });
});

describe("read_env_files", () => {
  it("returns base environment when no environment specified", async () => {
    await fsPromises.writeFile(path.join(temp_dir, ".env"), "FOO=bar\n");

    const result = await read_env_files();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({
        env_map: { FOO: "bar" },
        environment_env_map: { FOO: "bar" },
        env_file_name: ".env",
      });
    }
  });

  it("merges base and environment-specific files", async () => {
    // biome-ignore lint/nursery/noSecrets: test data
    await fsPromises.writeFile(path.join(temp_dir, ".env"), "ROOT=value\n");
    await fsPromises.writeFile(path.join(temp_dir, ".env.dev"), "FOO=bar\n");

    const result = await read_env_files("dev");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({
        env_map: { ROOT: "value" },
        environment_env_map: { FOO: "bar" },
        env_file_name: ".env.dev",
      });
    }
  });

  it("errors when environment-specific file is missing", async () => {
    // biome-ignore lint/nursery/noSecrets: test data
    await fsPromises.writeFile(path.join(temp_dir, ".env"), "ROOT=value\n");

    const result = await read_env_files("qa");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Environment file ".env.qa" not found');
    }
  });
});
