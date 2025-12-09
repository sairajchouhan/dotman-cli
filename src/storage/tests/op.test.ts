import { type ItemCategory, ItemFieldType } from "@1password/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock_vaults_list = vi.fn();
const mock_items_list = vi.fn();
const mock_items_get = vi.fn();
const mock_items_create = vi.fn();
const mock_items_put = vi.fn();
const mock_create_client = vi.fn();

vi.mock("@1password/sdk", () => ({
  default: {
    createClient: (config: unknown) => mock_create_client(config),
    ItemCategory: { SecureNote: "SECURE_NOTE" as ItemCategory },
  },
  ItemFieldType: { Concealed: "CONCEALED" as unknown as ItemFieldType },
}));

import { OnePasswordStorageClient } from "@/storage/clients/op";

function create_mock_op_client() {
  return {
    vaults: { list: mock_vaults_list },
    items: {
      list: mock_items_list,
      get: mock_items_get,
      create: mock_items_create,
      put: mock_items_put,
    },
  };
}

function make_valid_env_map() {
  return {
    OP_SERVICE_ACCOUNT_TOKEN: "test-token",
    OP_VAULT_NAME: "test-vault",
    DOTMAN_PROJECT_NAME: "test-project",
  };
}

describe("OnePasswordStorageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("init", () => {
    it("initializes SDK with valid token", async () => {
      const mock_client = create_mock_op_client();
      mock_create_client.mockResolvedValue(mock_client);

      const env_map = make_valid_env_map();
      const result = await OnePasswordStorageClient.init(env_map);

      expect(result.isOk()).toBe(true);
      expect(mock_create_client).toHaveBeenCalledWith({
        auth: "test-token",
        integrationName: "dotman",
        integrationVersion: "v0.0.1",
      });
    });

    it("returns error when SDK initialization fails", async () => {
      mock_create_client.mockRejectedValue(new Error("Invalid token"));

      const env_map = make_valid_env_map();
      const result = await OnePasswordStorageClient.init(env_map);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe("Could not initialize 1Password sdk");
      }
    });
  });

  describe("get_project", () => {
    it("fetches project from vault", async () => {
      const mock_client = create_mock_op_client();
      const env_map = make_valid_env_map();
      const storage_client = new OnePasswordStorageClient(mock_client as never, env_map);

      mock_vaults_list.mockResolvedValue([{ id: "vault-1", title: "test-vault" }]);
      mock_items_list.mockResolvedValue([{ id: "item-1", title: "test-project", vaultId: "vault-1" }]);
      mock_items_get.mockResolvedValue({
        id: "item-1",
        title: "test-project",
        fields: [{ id: "field-1", title: "API_KEY", value: "secret-value" }],
      });

      const result = await storage_client.get_project(undefined);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe("item-1");
        expect(result.value.title).toBe("test-project");
        expect(result.value.secrets).toHaveLength(1);
        expect(result.value.secrets[0]).toEqual({
          id: "field-1",
          title: "API_KEY",
          value: "secret-value",
        });
      }
    });

    it("fetches project with environment suffix", async () => {
      const mock_client = create_mock_op_client();
      const env_map = make_valid_env_map();
      const storage_client = new OnePasswordStorageClient(mock_client as never, env_map);

      mock_vaults_list.mockResolvedValue([{ id: "vault-1", title: "test-vault" }]);
      mock_items_list.mockResolvedValue([{ id: "item-1", title: "test-project__staging", vaultId: "vault-1" }]);
      mock_items_get.mockResolvedValue({
        id: "item-1",
        title: "test-project__staging",
        fields: [],
      });

      const result = await storage_client.get_project("staging");

      expect(result.isOk()).toBe(true);
      expect(mock_items_list).toHaveBeenCalledWith("vault-1");
    });

    it("creates project if not found", async () => {
      const mock_client = create_mock_op_client();
      const env_map = make_valid_env_map();
      const storage_client = new OnePasswordStorageClient(mock_client as never, env_map);

      mock_vaults_list.mockResolvedValue([{ id: "vault-1", title: "test-vault" }]);
      mock_items_list.mockResolvedValue([]);
      mock_items_create.mockResolvedValue({
        id: "new-item",
        title: "test-project",
        fields: [],
      });

      const result = await storage_client.get_project(undefined);

      expect(result.isOk()).toBe(true);
      expect(mock_items_create).toHaveBeenCalled();
    });

    it("returns error when vault not found", async () => {
      const mock_client = create_mock_op_client();
      const env_map = make_valid_env_map();
      const storage_client = new OnePasswordStorageClient(mock_client as never, env_map);

      mock_vaults_list.mockResolvedValue([{ id: "vault-1", title: "other-vault" }]);

      const result = await storage_client.get_project(undefined);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Vault "test-vault" not found');
      }
    });
  });

  describe("set_project", () => {
    it("updates existing secrets", async () => {
      const mock_client = create_mock_op_client();
      const env_map = make_valid_env_map();
      const storage_client = new OnePasswordStorageClient(mock_client as never, env_map);

      mock_vaults_list.mockResolvedValue([{ id: "vault-1", title: "test-vault" }]);
      mock_items_list.mockResolvedValue([{ id: "item-1", title: "test-project", vaultId: "vault-1" }]);
      mock_items_get.mockResolvedValue({
        id: "item-1",
        title: "test-project",
        fields: [{ id: "field-1", title: "API_KEY", value: "old-value", fieldType: "CONCEALED" }],
      });
      mock_items_put.mockResolvedValue({
        id: "item-1",
        title: "test-project",
        fields: [{ id: "field-1", title: "API_KEY", value: "new-value" }],
      });

      const project = {
        id: "item-1",
        title: "test-project",
        secrets: [{ id: "field-1", title: "API_KEY", value: "new-value" }],
      };

      const result = await storage_client.set_project(project, undefined);

      expect(result.isOk()).toBe(true);
      expect(mock_items_put).toHaveBeenCalled();
    });

    it("creates new secrets", async () => {
      const mock_client = create_mock_op_client();
      const env_map = make_valid_env_map();
      const storage_client = new OnePasswordStorageClient(mock_client as never, env_map);

      mock_vaults_list.mockResolvedValue([{ id: "vault-1", title: "test-vault" }]);
      mock_items_list.mockResolvedValue([{ id: "item-1", title: "test-project", vaultId: "vault-1" }]);
      mock_items_get.mockResolvedValue({
        id: "item-1",
        title: "test-project",
        fields: [],
      });
      mock_items_put.mockResolvedValue({
        id: "item-1",
        title: "test-project",
        fields: [{ id: "new-field", title: "NEW_KEY", value: "new-value" }],
      });

      const project = {
        id: "item-1",
        title: "test-project",
        secrets: [{ id: "new-field", title: "NEW_KEY", value: "new-value" }],
      };

      const result = await storage_client.set_project(project, undefined);

      expect(result.isOk()).toBe(true);
    });
  });

  describe("create_project", () => {
    it("creates new project in vault", async () => {
      const mock_client = create_mock_op_client();
      const env_map = make_valid_env_map();
      const storage_client = new OnePasswordStorageClient(mock_client as never, env_map);

      mock_vaults_list.mockResolvedValue([{ id: "vault-1", title: "test-vault" }]);
      mock_items_list.mockResolvedValue([]);
      mock_items_create.mockResolvedValue({
        id: "new-item",
        title: "test-project__dev",
      });

      const result = await storage_client.create_project("dev");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.title).toBe("test-project__dev");
        expect(result.value.secrets).toEqual([]);
      }
    });

    it("returns error when project already exists", async () => {
      const mock_client = create_mock_op_client();
      const env_map = make_valid_env_map();
      const storage_client = new OnePasswordStorageClient(mock_client as never, env_map);

      mock_vaults_list.mockResolvedValue([{ id: "vault-1", title: "test-vault" }]);
      mock_items_list.mockResolvedValue([{ id: "item-1", title: "test-project__dev", vaultId: "vault-1" }]);

      const result = await storage_client.create_project("dev");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("already exists");
      }
    });

    it("returns error when vault not found", async () => {
      const mock_client = create_mock_op_client();
      const env_map = make_valid_env_map();
      const storage_client = new OnePasswordStorageClient(mock_client as never, env_map);

      mock_vaults_list.mockResolvedValue([]);

      const result = await storage_client.create_project("dev");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("not found");
      }
    });
  });

  describe("get_client_env_keys", () => {
    it("returns expected environment variable keys", () => {
      const mock_client = create_mock_op_client();
      const env_map = make_valid_env_map();
      const storage_client = new OnePasswordStorageClient(mock_client as never, env_map);

      const keys = storage_client.get_client_env_keys();

      expect(keys).toContain("OP_SERVICE_ACCOUNT_TOKEN");
      expect(keys).toContain("OP_VAULT_NAME");
      expect(keys).toContain("DOTMAN_PROJECT_NAME");
    });
  });
});
