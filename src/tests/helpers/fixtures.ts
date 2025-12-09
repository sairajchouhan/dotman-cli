import type { DiffChange, DiffResult } from "@/lib/diff";
import type { EnvMap, Project, Secret } from "@/lib/types";

export function make_secret(overrides: Partial<Secret> = {}): Secret {
  return {
    id: "test-secret-id",
    title: "TEST_KEY",
    value: "test-value",
    ...overrides,
  };
}

export function make_project(overrides: Partial<Project> = {}): Project {
  return {
    id: "test-project-id",
    title: "test-project",
    secrets: [],
    ...overrides,
  };
}

export function make_diff_change(overrides: Partial<DiffChange> = {}): DiffChange {
  return {
    type: "added",
    key: "TEST_KEY",
    new_value: "test-value",
    ...overrides,
  };
}

export function make_diff_result(overrides: Partial<DiffResult> = {}): DiffResult {
  return {
    changes: [],
    added_count: 0,
    modified_count: 0,
    deleted_count: 0,
    total_count: 0,
    ...overrides,
  };
}

export function make_env_map(entries: Record<string, string> = {}): EnvMap {
  return { ...entries };
}

export function make_secrets_map(secrets: Secret[]): Map<string, Secret> {
  const map = new Map<string, Secret>();
  for (const secret of secrets) {
    map.set(secret.title, secret);
  }
  return map;
}
