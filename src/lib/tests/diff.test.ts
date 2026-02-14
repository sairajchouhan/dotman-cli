import { describe, expect, it } from "vitest";
import { calculate_pull_diff, calculate_push_diff } from "@/lib/diff";
import type { Secret } from "@/lib/types";

function make_secret(id: string, key: string, value: string): Secret {
  return { id, title: key, value };
}

describe("calculate_push_diff", () => {
  it("detects added, modified, and deleted secrets", () => {
    const env_vars = { NEW_KEY: "new", EXISTING_KEY: "updated" };
    const secrets = new Map<string, Secret>([
      ["EXISTING_KEY", make_secret("1", "EXISTING_KEY", "old")],
      ["REMOVED_KEY", make_secret("2", "REMOVED_KEY", "gone")],
    ]);

    const diff = calculate_push_diff(env_vars, secrets);

    expect(diff.total_count).toBe(3);
    expect(diff.added_count).toBe(1);
    expect(diff.modified_count).toBe(1);
    expect(diff.deleted_count).toBe(1);

    expect(diff.changes).toHaveLength(3);
    expect(diff.changes).toEqual(
      expect.arrayContaining([
        {
          type: "modified",
          key: "EXISTING_KEY",
          new_value: "updated",
          old_value: "old",
        },
        {
          type: "added",
          key: "NEW_KEY",
          new_value: "new",
        },
        {
          type: "deleted",
          key: "REMOVED_KEY",
          old_value: "gone",
        },
      ]),
    );
  });

  it("returns no changes when env vars match secrets", () => {
    const env_vars = { KEY: "value" };
    const secrets = new Map<string, Secret>([["KEY", make_secret("1", "KEY", "value")]]);

    const diff = calculate_push_diff(env_vars, secrets);

    expect(diff.total_count).toBe(0);
    expect(diff.changes).toHaveLength(0);
  });
});

describe("calculate_pull_diff", () => {
  it("identifies added, modified, and deleted entries", () => {
    const local_env = { LOCAL_ONLY: "old", COMMON_KEY: "local" };
    const remote_env = { COMMON_KEY: "remote", NEW_REMOTE: "value" };
    const client_keys: string[] = [];

    const diff = calculate_pull_diff(local_env, remote_env, client_keys);

    expect(diff.total_count).toBe(3);
    expect(diff.added_count).toBe(1);
    expect(diff.modified_count).toBe(1);
    expect(diff.deleted_count).toBe(1);

    expect(diff.changes).toHaveLength(3);
    expect(diff.changes).toEqual(
      expect.arrayContaining([
        {
          type: "added",
          key: "NEW_REMOTE",
          new_value: "value",
        },
        {
          type: "modified",
          key: "COMMON_KEY",
          old_value: "local",
          new_value: "remote",
        },
        {
          type: "deleted",
          key: "LOCAL_ONLY",
          old_value: "old",
        },
      ]),
    );
  });

  it("ignores deletions for client env keys", () => {
    const local_env = { CLIENT_KEY: "keep" };
    const remote_env: Record<string, string> = {};
    const client_keys = ["CLIENT_KEY"];

    const diff = calculate_pull_diff(local_env, remote_env, client_keys);

    expect(diff.total_count).toBe(0);
    expect(diff.changes).toHaveLength(0);
  });

  it("returns no changes when environments are identical", () => {
    const local_env = { KEY: "value" };
    const remote_env = { KEY: "value" };

    const diff = calculate_pull_diff(local_env, remote_env, []);

    expect(diff.total_count).toBe(0);
    expect(diff.changes).toHaveLength(0);
  });
});
