import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, mock, vi } from "vitest";
import { CustomError } from "@/lib/error";
import type { EnvMap, Project, StorageClient } from "@/lib/types";

interface ProviderRegistryEntry {
  name: string;
  is_available: (env_map: EnvMap) => boolean;
  create: (env_map: Record<string, string>) => ResultAsync<StorageClient, CustomError>;
}

// Use bun's mock.module for proper isolation
const registry_entries: Record<string, ProviderRegistryEntry> = {};

mock.module("@/storage/providers", () => ({
  PROVIDER_REGISTRY: registry_entries,
}));

// Dynamic import after mock is set up
const { create_storage_client } = await import("@/storage/client");

describe("create_storage_client", () => {
  beforeEach(() => {
    for (const key in registry_entries) {
      delete registry_entries[key];
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the initialized storage client when exactly one provider matches", async () => {
    const dummy_project: Project = { id: "p", title: "p", secrets: [] };
    const client: StorageClient = {
      source: "mock",
      get_client_env_keys: () => [],
      get_project: vi.fn(() => okAsync(dummy_project)),
      set_project: vi.fn(() => okAsync(dummy_project)),
      create_project: vi.fn(() => okAsync(dummy_project)),
    };

    registry_entries.one = {
      name: "one",
      is_available: () => true,
      create: () => okAsync(client),
    };

    const result = await create_storage_client({ SOME: "env" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(client);
    }
  });

  it("returns error when no providers are available", async () => {
    registry_entries.one = {
      name: "one",
      is_available: () => false,
      create: vi.fn(),
    };

    const result = await create_storage_client({});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("No environment variables found that match any provider");
    }
  });

  it("returns error when multiple providers are available", async () => {
    registry_entries.one = {
      name: "one",
      is_available: () => true,
      create: vi.fn(),
    };
    registry_entries.two = {
      name: "two",
      is_available: () => true,
      create: vi.fn(),
    };

    const result = await create_storage_client({});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe(
        "More than one source environment variables are available, filter environment variables to only include one client",
      );
    }
  });

  it("propagates provider creation errors", async () => {
    const creation_error = new CustomError("provider failed");

    registry_entries.one = {
      name: "one",
      is_available: () => true,
      create: () => errAsync(creation_error),
    };

    const result = await create_storage_client({});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(creation_error);
    }
  });
});
