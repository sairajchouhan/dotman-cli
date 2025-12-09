import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  safe_fs_mkdir,
  safe_fs_read_dir,
  safe_fs_read_file,
  safe_fs_write_file,
  safe_json_parse,
  safe_json_stringify,
  safe_os_homedir,
  safe_path_join,
} from "@/lib/safe";

describe("safe_path_join", () => {
  it("joins paths successfully", () => {
    const result = safe_path_join("foo", "bar", "baz");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(path.join("foo", "bar", "baz"));
    }
  });

  it("handles absolute paths", () => {
    const result = safe_path_join("/root", "sub", "file.txt");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe("/root/sub/file.txt");
    }
  });
});

describe("safe_os_homedir", () => {
  it("returns home directory", () => {
    const result = safe_os_homedir();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(os.homedir());
    }
  });
});

describe("safe_json_parse", () => {
  it("parses valid JSON object", () => {
    const result = safe_json_parse('{"key": "value"}');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ key: "value" });
    }
  });

  it("parses valid JSON array", () => {
    const result = safe_json_parse("[1, 2, 3]");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([1, 2, 3]);
    }
  });

  it("parses valid JSON primitive", () => {
    const result = safe_json_parse('"string"');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe("string");
    }
  });

  it("returns error for invalid JSON", () => {
    const result = safe_json_parse("not valid json");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("Failed to parse JSON");
      expect(result.error.cause).toBeDefined();
    }
  });

  it("returns error for empty string", () => {
    const result = safe_json_parse("");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("Failed to parse JSON");
    }
  });
});

describe("safe_json_stringify", () => {
  it("stringifies object", () => {
    const result = safe_json_stringify({ key: "value" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('{"key":"value"}');
    }
  });

  it("stringifies array", () => {
    const result = safe_json_stringify([1, 2, 3]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe("[1,2,3]");
    }
  });

  it("stringifies primitive", () => {
    const result = safe_json_stringify("test");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('"test"');
    }
  });

  it("stringifies null", () => {
    const result = safe_json_stringify(null);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe("null");
    }
  });

  it("returns error for circular reference", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    const result = safe_json_stringify(circular);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("Failed to stringify JSON");
    }
  });

  it("returns error for BigInt", () => {
    const result = safe_json_stringify(BigInt(123));

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("Failed to stringify JSON");
    }
  });
});

describe("file system operations", () => {
  let temp_dir: string;

  beforeEach(async () => {
    temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "dotman-safe-test-"));
  });

  afterEach(async () => {
    await fs.rm(temp_dir, { recursive: true, force: true });
  });

  describe("safe_fs_mkdir", () => {
    it("creates directory successfully", async () => {
      const new_dir = path.join(temp_dir, "new-dir");

      const result = await safe_fs_mkdir(new_dir);

      expect(result.isOk()).toBe(true);
      const stats = await fs.stat(new_dir);
      expect(stats.isDirectory()).toBe(true);
    });

    it("creates nested directories with recursive option", async () => {
      const nested_dir = path.join(temp_dir, "a", "b", "c");

      const result = await safe_fs_mkdir(nested_dir, { recursive: true });

      expect(result.isOk()).toBe(true);
      const stats = await fs.stat(nested_dir);
      expect(stats.isDirectory()).toBe(true);
    });

    it("returns error for invalid path", async () => {
      const result = await safe_fs_mkdir("/nonexistent/deep/path/without/recursive");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe("Failed to create directory");
      }
    });
  });

  describe("safe_fs_write_file", () => {
    it("writes file successfully", async () => {
      const file_path = path.join(temp_dir, "test.txt");

      const result = await safe_fs_write_file(file_path, "hello world");

      expect(result.isOk()).toBe(true);
      const content = await fs.readFile(file_path, "utf-8");
      expect(content).toBe("hello world");
    });

    it("overwrites existing file", async () => {
      const file_path = path.join(temp_dir, "test.txt");
      await fs.writeFile(file_path, "original");

      const result = await safe_fs_write_file(file_path, "updated");

      expect(result.isOk()).toBe(true);
      const content = await fs.readFile(file_path, "utf-8");
      expect(content).toBe("updated");
    });

    it("returns error when directory does not exist", async () => {
      const file_path = path.join(temp_dir, "nonexistent", "test.txt");

      const result = await safe_fs_write_file(file_path, "content");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe("Failed to write file");
      }
    });
  });

  describe("safe_fs_read_file", () => {
    it("reads file successfully", async () => {
      const file_path = path.join(temp_dir, "test.txt");
      await fs.writeFile(file_path, "hello world");

      const result = await safe_fs_read_file(file_path, "utf-8");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("hello world");
      }
    });

    it("returns error for non-existent file", async () => {
      const file_path = path.join(temp_dir, "nonexistent.txt");

      const result = await safe_fs_read_file(file_path, "utf-8");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe("Failed to read file");
      }
    });
  });

  describe("safe_fs_read_dir", () => {
    it("reads directory successfully", async () => {
      await fs.writeFile(path.join(temp_dir, "file1.txt"), "");
      await fs.writeFile(path.join(temp_dir, "file2.txt"), "");

      const result = await safe_fs_read_dir(temp_dir);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const names = result.value.map((entry) => entry.name);
        expect(names).toContain("file1.txt");
        expect(names).toContain("file2.txt");
      }
    });

    it("returns error for non-existent directory", async () => {
      const result = await safe_fs_read_dir(path.join(temp_dir, "nonexistent"));

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe("Failed to read directory");
      }
    });
  });
});
