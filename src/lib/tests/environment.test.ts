import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { project_environment_separator } from "@/constants";
import {
  get_all_environments,
  get_current_environment,
  save_current_env,
  validate_environment_name,
} from "@/lib/environment";
import { get_state_file_path } from "@/lib/utils";

const original_cwd = process.cwd();
const original_xdg_state_home = process.env.XDG_STATE_HOME;
let temp_dir: string;
let state_home_dir: string;

beforeEach(async () => {
  temp_dir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "dotman-environment-test-"));
  state_home_dir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "dotman-state-test-"));
  process.env.XDG_STATE_HOME = state_home_dir;
  process.chdir(temp_dir);
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (temp_dir) {
    await fsPromises.rm(temp_dir, { recursive: true, force: true });
  }
  if (state_home_dir) {
    await fsPromises.rm(state_home_dir, { recursive: true, force: true });
  }
  if (original_xdg_state_home) {
    process.env.XDG_STATE_HOME = original_xdg_state_home;
  } else {
    delete process.env.XDG_STATE_HOME;
  }
  process.chdir(original_cwd);
});

async function create_state_file(content: Record<string, string>): Promise<string> {
  const state_file_path_result = await get_state_file_path();
  if (state_file_path_result.isErr()) {
    throw new Error(`Failed to get state file path: ${state_file_path_result.error.message}`);
  }
  const state_file_path = state_file_path_result.value;
  await fsPromises.writeFile(state_file_path, JSON.stringify(content), "utf8");
  return state_file_path;
}

async function read_state_file(): Promise<Record<string, string>> {
  const state_file_path_result = await get_state_file_path();
  if (state_file_path_result.isErr()) {
    throw new Error(`Failed to get state file path: ${state_file_path_result.error.message}`);
  }
  const state_file_path = state_file_path_result.value;
  const content = await fsPromises.readFile(state_file_path, "utf8");
  return JSON.parse(content);
}

async function create_env_file(name: string, content = ""): Promise<void> {
  await fsPromises.writeFile(path.join(temp_dir, name), content, "utf8");
}

describe("validate_environment_name", () => {
  it("accepts trimmed valid names", () => {
    const result = validate_environment_name("  staging  ");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe("staging");
    }
  });

  it("rejects empty names", () => {
    const result = validate_environment_name("   ");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("Environment name cannot be empty");
    }
  });

  it("rejects names containing the separator", () => {
    const result = validate_environment_name(`dev${project_environment_separator}us`);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("separator");
    }
  });

  it("rejects names with invalid characters", () => {
    const result = validate_environment_name("qa?test");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("invalid characters");
    }
  });

  it("rejects path traversal sequences", () => {
    const result = validate_environment_name("..prod");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("..");
    }
  });

  it("rejects reserved name 'master'", () => {
    const result = validate_environment_name("master");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("reserved");
      expect(result.error.message).toContain("master");
    }
  });

  it("rejects 'master' with whitespace", () => {
    const result = validate_environment_name("  master  ");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("reserved");
    }
  });
});

describe("save_current_env", () => {
  beforeEach(async () => {
    await create_env_file(".env");
  });

  describe("input validation", () => {
    it("rejects empty string", async () => {
      const result = await save_current_env("");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe("Environment name cannot be empty");
      }
    });

    it("rejects whitespace-only string", async () => {
      const result = await save_current_env("   ");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe("Environment name cannot be empty");
      }
    });

    it("rejects invalid environment names with separator", async () => {
      const result = await save_current_env(`dev${project_environment_separator}prod`);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("separator");
      }
    });

    it("rejects environment with invalid characters", async () => {
      const result = await save_current_env("dev/prod");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("invalid characters");
      }
    });

    it("trims and accepts valid environment name", async () => {
      const result = await save_current_env("  staging  ");
      expect(result.isOk()).toBe(true);

      const state = await read_state_file();
      expect(state[process.cwd()]).toBe("staging");
    });
  });

  describe("file creation", () => {
    it("creates state file when it doesn't exist", async () => {
      const result = await save_current_env("dev");
      expect(result.isOk()).toBe(true);

      const state_file_path_result = await get_state_file_path();
      expect(state_file_path_result.isOk()).toBe(true);
      if (state_file_path_result.isOk()) {
        const exists = await fsPromises
          .access(state_file_path_result.value)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    });

    it("creates valid JSON with cwd entry", async () => {
      const result = await save_current_env("dev");
      expect(result.isOk()).toBe(true);

      const state = await read_state_file();
      const current_cwd = process.cwd();
      expect(state[current_cwd]).toBe("dev");
    });

    it("creates state directory if missing", async () => {
      const state_file_path_result = await get_state_file_path();
      expect(state_file_path_result.isOk()).toBe(true);

      if (state_file_path_result.isOk()) {
        const dir = path.dirname(state_file_path_result.value);
        await fsPromises.rm(dir, { recursive: true, force: true });

        const result = await save_current_env("prod");
        expect(result.isOk()).toBe(true);

        const state = await read_state_file();
        expect(state[process.cwd()]).toBe("prod");
      }
    });
  });

  describe("file updates", () => {
    it("saves environment for current directory", async () => {
      await create_state_file({});

      const result = await save_current_env("prod");
      expect(result.isOk()).toBe(true);

      const state = await read_state_file();
      expect(state[process.cwd()]).toBe("prod");
    });

    it("updates existing environment for current directory", async () => {
      const current_cwd = process.cwd();
      await create_state_file({ [current_cwd]: "dev" });

      const result = await save_current_env("staging");
      expect(result.isOk()).toBe(true);

      const state = await read_state_file();
      expect(state[current_cwd]).toBe("staging");
    });

    it("preserves other directory entries", async () => {
      const current_cwd = process.cwd();
      const other_dir = "/other/path";
      await create_state_file({ [other_dir]: "prod", [current_cwd]: "dev" });

      const result = await save_current_env("staging");
      expect(result.isOk()).toBe(true);

      const state = await read_state_file();
      expect(state[other_dir]).toBe("prod");
      expect(state[current_cwd]).toBe("staging");
    });
  });

  describe("multi-directory scenarios", () => {
    it("handles multiple directories saving sequentially", async () => {
      const dir1 = "/path/to/dir1";
      const dir2 = "/path/to/dir2";

      await create_state_file({ [dir1]: "dev" });

      const cwd_spy = vi.spyOn(process, "cwd").mockReturnValue(dir2);
      const access_spy = vi.spyOn(fsPromises, "access").mockResolvedValue(undefined);
      const result = await save_current_env("prod");
      expect(result.isOk()).toBe(true);
      cwd_spy.mockRestore();
      access_spy.mockRestore();

      const state = await read_state_file();
      expect(state[dir1]).toBe("dev");
      expect(state[dir2]).toBe("prod");
    });

    it("handles switching between directories", async () => {
      const dir1 = process.cwd();
      const dir2 = "/path/to/dir2";

      await save_current_env("dev");

      const cwd_spy = vi.spyOn(process, "cwd").mockReturnValue(dir2);
      const access_spy = vi.spyOn(fsPromises, "access").mockResolvedValue(undefined);
      await save_current_env("prod");
      cwd_spy.mockRestore();
      access_spy.mockRestore();

      const state = await read_state_file();
      expect(state[dir1]).toBe("dev");
      expect(state[dir2]).toBe("prod");
    });
  });

  describe("error handling", () => {
    it("handles corrupted JSON in state file", async () => {
      const state_file_path_result = await get_state_file_path();
      expect(state_file_path_result.isOk()).toBe(true);

      if (state_file_path_result.isOk()) {
        await fsPromises.writeFile(state_file_path_result.value, "{invalid json}", "utf8");

        const result = await save_current_env("dev");
        expect(result.isOk()).toBe(true);

        const state = await read_state_file();
        expect(state[process.cwd()]).toBe("dev");
      }
    });
  });

  describe("edge cases", () => {
    it("handles very long directory paths", async () => {
      const long_path = `${"/very/long/path/".repeat(20)}project`;
      const cwd_spy = vi.spyOn(process, "cwd").mockReturnValue(long_path);
      const access_spy = vi.spyOn(fsPromises, "access").mockResolvedValue(undefined);

      const result = await save_current_env("dev");
      expect(result.isOk()).toBe(true);

      const state = await read_state_file();
      expect(state[long_path]).toBe("dev");

      cwd_spy.mockRestore();
      access_spy.mockRestore();
    });

    it("handles special characters in directory path", async () => {
      const special_path = "/path/with spaces/and-dashes/under_scores";
      const cwd_spy = vi.spyOn(process, "cwd").mockReturnValue(special_path);
      const access_spy = vi.spyOn(fsPromises, "access").mockResolvedValue(undefined);

      const result = await save_current_env("dev");
      expect(result.isOk()).toBe(true);

      const state = await read_state_file();
      expect(state[special_path]).toBe("dev");

      cwd_spy.mockRestore();
      access_spy.mockRestore();
    });
  });
});

describe("get_all_environments", () => {
  describe("basic discovery", () => {
    it("finds .env file and returns as master", async () => {
      await create_env_file(".env", "FOO=bar");

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toContain("master");
      }
    });

    it("finds .env.<name> files and extracts names", async () => {
      await create_env_file(".env.dev");
      await create_env_file(".env.staging");
      await create_env_file(".env.prod");

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toContain("dev");
        expect(result.value).toContain("staging");
        expect(result.value).toContain("prod");
      }
    });

    it("handles only .env file with no environment-specific files", async () => {
      await create_env_file(".env");

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(["master"]);
      }
    });

    it("handles only .env.<name> files with no master .env", async () => {
      await create_env_file(".env.dev");
      await create_env_file(".env.prod");

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(["dev", "prod"]);
        expect(result.value).not.toContain("master");
      }
    });
  });

  describe("sorting", () => {
    it("sorts with master first then alphabetically", async () => {
      await create_env_file(".env");
      await create_env_file(".env.zebra");
      await create_env_file(".env.alpha");
      await create_env_file(".env.beta");

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(["master", "alpha", "beta", "zebra"]);
      }
    });

    it("sorts alphabetically when no master", async () => {
      await create_env_file(".env.prod");
      await create_env_file(".env.dev");
      await create_env_file(".env.staging");

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(["dev", "prod", "staging"]);
      }
    });
  });

  describe("filtering", () => {
    it("ignores files that don't match pattern", async () => {
      await create_env_file(".env");
      await create_env_file(".env.dev");
      await create_env_file(".env.example");
      await create_env_file("env.local");
      await create_env_file(".env.bak");
      await create_env_file("README.md");

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(["master", "bak", "dev", "example"]);
      }
    });

    it("ignores directories named like env files", async () => {
      await create_env_file(".env");
      await fsPromises.mkdir(path.join(temp_dir, ".env.dev"));

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(["master"]);
      }
    });

    it("ignores .env. files with empty names", async () => {
      await create_env_file(".env");
      await create_env_file(".env.");

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(["master"]);
      }
    });
  });

  describe("validation", () => {
    it("skips files with invalid environment names", async () => {
      await create_env_file(`.env.dev${project_environment_separator}prod`);
      await create_env_file(".env.valid");

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toContain("valid");
        expect(result.value).not.toContain(`dev${project_environment_separator}prod`);
      }
    });

    it("skips .env.. path traversal attempt", async () => {
      await create_env_file(".env..");

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).not.toContain("..");
      }
    });
  });

  describe(".env.master reserved name handling", () => {
    it("filters out .env.master file (reserved name)", async () => {
      await create_env_file(".env", "BASE=value");
      // biome-ignore lint/nursery/noSecrets: test fixture
      await create_env_file(".env.master", "MASTER=value");

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Should have exactly one "master" from .env, not from .env.master
        expect(result.value.filter((e) => e === "master").length).toBe(1);
        expect(result.value).toEqual(["master"]);
      }
    });

    it("ignores .env.master when .env is absent", async () => {
      // biome-ignore lint/nursery/noSecrets: test fixture
      await create_env_file(".env.master", "MASTER=value");

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // .env.master should be filtered out, no "master" environment
        expect(result.value).not.toContain("master");
        expect(result.value).toEqual([]);
      }
    });

    it(".env maps to master while .env.master is filtered", async () => {
      await create_env_file(".env", "BASE=value");
      // biome-ignore lint/nursery/noSecrets: test fixture
      await create_env_file(".env.master", "CONFLICT=value");
      await create_env_file(".env.dev", "DEV=value");

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // .env → master, .env.master → filtered out, .env.dev → dev
        expect(result.value).toEqual(["master", "dev"]);
      }
    });
  });

  describe("edge cases", () => {
    it("handles empty directory with no .env files", async () => {
      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual([]);
      }
    });

    it("handles environment names with hyphens and underscores", async () => {
      await create_env_file(".env.dev-us");
      await create_env_file(".env.prod_eu");
      await create_env_file(".env.staging-2");

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toContain("dev-us");
        expect(result.value).toContain("prod_eu");
        expect(result.value).toContain("staging-2");
      }
    });

    it("handles directory with many environment files", async () => {
      await create_env_file(".env");
      for (let i = 1; i <= 50; i++) {
        await create_env_file(`.env.env${i}`);
      }

      const result = await get_all_environments();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.length).toBe(51);
        expect(result.value[0]).toBe("master");
      }
    });
  });
});

describe("get_current_environment", () => {
  describe("master fallback", () => {
    it("returns master when state file doesn't exist", async () => {
      const result = await get_current_environment();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("master");
      }
    });

    it("returns master when state file exists but cwd has no entry", async () => {
      await create_state_file({ "/other/path": "prod" });

      const result = await get_current_environment();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("master");
      }
    });

    it("returns master when state file is empty JSON", async () => {
      await create_state_file({});

      const result = await get_current_environment();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("master");
      }
    });
  });

  describe("saved environment", () => {
    it("returns saved environment for current directory", async () => {
      const current_cwd = process.cwd();
      await create_state_file({ [current_cwd]: "staging" });

      const result = await get_current_environment();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("staging");
      }
    });

    it("returns correct environment when multiple directories exist", async () => {
      const current_path = "/path/two";
      await create_state_file({
        "/path/one": "dev",
        [current_path]: "prod",
        "/path/three": "staging",
      });

      const cwd_spy = vi.spyOn(process, "cwd").mockReturnValue(current_path);
      const result = await get_current_environment();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("prod");
      }
      cwd_spy.mockRestore();
    });

    it("returns master when saved as master", async () => {
      const current_cwd = process.cwd();
      await create_state_file({ [current_cwd]: "master" });

      const result = await get_current_environment();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("master");
      }
    });
  });

  describe("directory path handling", () => {
    it("handles paths with special characters", async () => {
      const special_path = "/path/with spaces/project";
      await create_state_file({ [special_path]: "prod" });

      const cwd_spy = vi.spyOn(process, "cwd").mockReturnValue(special_path);
      const result = await get_current_environment();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("prod");
      }
      cwd_spy.mockRestore();
    });

    it("handles very long directory paths", async () => {
      const long_path = `${"/very/long/path/".repeat(20)}project`;
      await create_state_file({ [long_path]: "dev" });

      const cwd_spy = vi.spyOn(process, "cwd").mockReturnValue(long_path);
      const result = await get_current_environment();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("dev");
      }
      cwd_spy.mockRestore();
    });

    it("returns master for different working directory", async () => {
      await create_state_file({ "/some/other/path": "staging" });

      const result = await get_current_environment();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("master");
      }
    });
  });

  describe("edge cases", () => {
    it("handles state file with large number of entries", async () => {
      const current_cwd = process.cwd();
      const entries: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        entries[`/path/to/dir${i}`] = `env${i}`;
      }
      entries[current_cwd] = "staging";
      await create_state_file(entries);

      const result = await get_current_environment();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("staging");
      }
    });
  });

  describe("race conditions", () => {
    it("handles state file being deleted between operations", async () => {
      const state_file_path_result = await get_state_file_path();
      expect(state_file_path_result.isOk()).toBe(true);

      if (state_file_path_result.isOk()) {
        await fsPromises.writeFile(state_file_path_result.value, "{}", "utf8");
        await fsPromises.rm(state_file_path_result.value);

        const result = await get_current_environment();
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toBe("master");
        }
      }
    });

    it("handles concurrent reads", async () => {
      const current_cwd = process.cwd();
      await create_state_file({ [current_cwd]: "dev" });

      const results = await Promise.all([
        get_current_environment(),
        get_current_environment(),
        get_current_environment(),
      ]);

      for (const result of results) {
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toBe("dev");
        }
      }
    });
  });
});
