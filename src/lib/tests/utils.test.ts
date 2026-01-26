import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { project_environment_separator } from "@/constants";
import { get_project_name, get_state_file_path, get_value_change_indicator, mask_secret_value } from "@/lib/utils";

const original_xdg_state_home = process.env.XDG_STATE_HOME;
let state_home_dir: string;

beforeEach(async () => {
  state_home_dir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "dotman-state-test-"));
  process.env.XDG_STATE_HOME = state_home_dir;
});

afterEach(async () => {
  if (state_home_dir) {
    await fsPromises.rm(state_home_dir, { recursive: true, force: true });
  }
  if (original_xdg_state_home) {
    process.env.XDG_STATE_HOME = original_xdg_state_home;
  } else {
    delete process.env.XDG_STATE_HOME;
  }
});

describe("get_project_name", () => {
  it("returns base name when environment is undefined", () => {
    expect(get_project_name("app")).toBe("app");
  });

  it("returns base name when environment is master (no suffix)", () => {
    expect(get_project_name("app", "master")).toBe("app");
  });

  it("appends separator and environment for non-master environments", () => {
    expect(get_project_name("app", "prod")).toBe(`app${project_environment_separator}prod`);
    expect(get_project_name("app", "staging")).toBe(`app${project_environment_separator}staging`);
    expect(get_project_name("app", "dev")).toBe(`app${project_environment_separator}dev`);
  });
});

describe("mask_secret_value", () => {
  it("returns empty string when value is empty", () => {
    expect(mask_secret_value("")).toBe("");
  });

  it("fully masks short secrets", () => {
    expect(mask_secret_value("abcd")).toBe("****");
  });

  it("fully masks longer secrets", () => {
    expect(mask_secret_value("secretValue")).toBe("***********");
  });
});

describe("get_value_change_indicator", () => {
  it("returns no change when values match", () => {
    expect(get_value_change_indicator("abc", "abc")).toBe("(no change)");
  });

  it("includes length change when lengths differ", () => {
    expect(get_value_change_indicator("abc", "abcd")).toBe("(length: 3 → 4)");
  });

  it("marks modification when values differ with same length", () => {
    expect(get_value_change_indicator("abcd", "abce")).toBe("(modified)");
  });
});

describe("get_state_file_path", () => {
  it("returns valid path ending with current-environment.json", async () => {
    const result = await get_state_file_path();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("current-environment.json");
      expect(path.isAbsolute(result.value)).toBe(true);
    }
  });

  it("creates state directory if it doesn't exist", async () => {
    const result = await get_state_file_path();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const dir = path.dirname(result.value);
      const stats = await fsPromises.stat(dir);
      expect(stats.isDirectory()).toBe(true);
    }
  });

  it("succeeds when state directory already exists", async () => {
    const first_result = await get_state_file_path();
    expect(first_result.isOk()).toBe(true);

    const second_result = await get_state_file_path();
    expect(second_result.isOk()).toBe(true);

    if (first_result.isOk() && second_result.isOk()) {
      expect(first_result.value).toBe(second_result.value);
    }
  });

  it("creates nested directory structure", async () => {
    const result = await get_state_file_path();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const dir = path.dirname(result.value);
      const parent_dir = path.dirname(dir);
      const parent_stats = await fsPromises.stat(parent_dir);
      expect(parent_stats.isDirectory()).toBe(true);
    }
  });
});
