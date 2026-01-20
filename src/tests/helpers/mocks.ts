import { okAsync, type ResultAsync } from "neverthrow";
import type { CustomError } from "@/lib/error";
import type { Project, StorageClient } from "@/lib/types";
import { make_project } from "./fixtures";

export type MockStorageClient = {
  [K in keyof StorageClient]: StorageClient[K] extends (...args: infer A) => infer R
    ? ReturnType<typeof vi.fn<(...args: A) => R>>
    : StorageClient[K];
};

export function create_mock_storage_client(overrides: Partial<MockStorageClient> = {}): MockStorageClient {
  const default_project = make_project();

  return {
    source: "mock",
    get_project: vi.fn(() => okAsync(default_project) as ResultAsync<Project, CustomError>),
    set_project: vi.fn((project: Project) => okAsync(project) as ResultAsync<Project, CustomError>),
    create_project: vi.fn(() => okAsync(default_project) as ResultAsync<Project, CustomError>),
    get_client_env_keys: vi.fn(() => []),
    ...overrides,
  };
}

export type MockOnePasswordClient = {
  vaults: {
    list: ReturnType<typeof vi.fn>;
  };
  items: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
  };
};

export function create_mock_op_sdk(): MockOnePasswordClient {
  return {
    vaults: {
      list: vi.fn().mockResolvedValue([]),
    },
    items: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      put: vi.fn().mockResolvedValue({}),
    },
  };
}

export type MockBitwardenClient = {
  loginAccessToken: ReturnType<typeof vi.fn>;
  projects: ReturnType<typeof vi.fn>;
  secrets: ReturnType<typeof vi.fn>;
};

export function create_mock_bw_sdk(): MockBitwardenClient {
  return {
    loginAccessToken: vi.fn().mockResolvedValue(undefined),
    projects: vi.fn().mockReturnValue({
      list: vi.fn().mockResolvedValue({ data: [] }),
      create: vi.fn().mockResolvedValue({ id: "new-project-id", name: "new-project" }),
    }),
    secrets: vi.fn().mockReturnValue({
      list: vi.fn().mockResolvedValue({ data: [] }),
      get: vi.fn().mockResolvedValue({ id: "secret-id", key: "KEY", value: "value" }),
      create: vi.fn().mockResolvedValue({ id: "new-secret-id" }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue(undefined),
    }),
  };
}
