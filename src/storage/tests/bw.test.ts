import { beforeEach, describe, expect, it, vi } from "vitest";

const mock_login_access_token = vi.fn();
const mock_projects_list = vi.fn();
const mock_projects_create = vi.fn();
const mock_secrets_list = vi.fn();
const mock_secrets_get_by_ids = vi.fn();
const mock_secrets_create = vi.fn();
const mock_secrets_update = vi.fn();

const mock_bw_client = {
  auth: () => ({ loginAccessToken: mock_login_access_token }),
  projects: () => ({ list: mock_projects_list, create: mock_projects_create }),
  secrets: () => ({
    list: mock_secrets_list,
    getByIds: mock_secrets_get_by_ids,
    create: mock_secrets_create,
    update: mock_secrets_update,
  }),
};

vi.mock("@bitwarden/sdk-napi", () => ({
  default: {
    BitwardenClient: vi.fn(() => mock_bw_client),
  },
}));

import { BitwardenStorageClient } from "@/storage/clients/bw";

function make_valid_env_map() {
  return {
    DOTMAN_PROJECT_NAME: "test-project",
    BWS_ACCESS_TOKEN: "test-token",
    BWS_ORGANIZATION_ID: "org-123",
    BWS_API_URL: "https://api.bitwarden.com",
    BWS_IDENTITY_URL: "https://identity.bitwarden.com",
  };
}

// biome-ignore lint/nursery/noSecrets: test class name is not a secret
describe("BitwardenStorageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("init", () => {
    it("initializes SDK with default URLs", async () => {
      mock_login_access_token.mockResolvedValue(undefined);

      const env_map = make_valid_env_map();
      const result = await BitwardenStorageClient.init(env_map);

      expect(result.isOk()).toBe(true);
      expect(mock_login_access_token).toHaveBeenCalledWith("test-token");
    });

    it("initializes SDK with custom URLs", async () => {
      mock_login_access_token.mockResolvedValue(undefined);

      const env_map = {
        ...make_valid_env_map(),
        BWS_API_URL: "https://custom.api.com",
        BWS_IDENTITY_URL: "https://custom.identity.com",
      };

      const result = await BitwardenStorageClient.init(env_map);

      expect(result.isOk()).toBe(true);
    });

    it("returns error when SDK initialization fails", async () => {
      mock_login_access_token.mockRejectedValue(new Error("Invalid token"));

      const env_map = make_valid_env_map();
      const result = await BitwardenStorageClient.init(env_map);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe("Could not initialize Bitwarden sdk");
      }
    });
  });

  describe("get_project", () => {
    it("fetches project and secrets", async () => {
      const env_map = make_valid_env_map();
      const storage_client = new BitwardenStorageClient(mock_bw_client as never, env_map);

      mock_projects_list.mockResolvedValue({
        data: [{ id: "proj-1", name: "test-project" }],
      });
      mock_secrets_list.mockResolvedValue({
        data: [{ id: "sec-1" }],
      });
      mock_secrets_get_by_ids.mockResolvedValue({
        data: [{ id: "sec-1", key: "API_KEY", value: "secret-value", projectId: "proj-1" }],
      });

      const result = await storage_client.get_project(undefined);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe("proj-1");
        expect(result.value.title).toBe("test-project");
        expect(result.value.secrets).toHaveLength(1);
        expect(result.value.secrets[0]).toEqual({
          id: "sec-1",
          title: "API_KEY",
          value: "secret-value",
        });
      }
    });

    it("fetches project with environment suffix", async () => {
      const env_map = make_valid_env_map();
      const storage_client = new BitwardenStorageClient(mock_bw_client as never, env_map);

      mock_projects_list.mockResolvedValue({
        data: [{ id: "proj-1", name: "test-project__staging" }],
      });
      mock_secrets_list.mockResolvedValue({ data: [] });

      const result = await storage_client.get_project("staging");

      expect(result.isOk()).toBe(true);
    });

    it("creates project if not found", async () => {
      const env_map = make_valid_env_map();
      const storage_client = new BitwardenStorageClient(mock_bw_client as never, env_map);

      mock_projects_list.mockResolvedValue({ data: [] });
      mock_projects_create.mockResolvedValue({ id: "new-proj", name: "test-project" });
      mock_secrets_list.mockResolvedValue({ data: [] });

      const result = await storage_client.get_project(undefined);

      expect(result.isOk()).toBe(true);
      expect(mock_projects_create).toHaveBeenCalledWith("org-123", "test-project");
    });

    it("filters secrets by project ID", async () => {
      const env_map = make_valid_env_map();
      const storage_client = new BitwardenStorageClient(mock_bw_client as never, env_map);

      mock_projects_list.mockResolvedValue({
        data: [{ id: "proj-1", name: "test-project" }],
      });
      mock_secrets_list.mockResolvedValue({
        data: [{ id: "sec-1" }, { id: "sec-2" }],
      });
      mock_secrets_get_by_ids.mockResolvedValue({
        data: [
          { id: "sec-1", key: "KEY1", value: "val1", projectId: "proj-1" },
          { id: "sec-2", key: "KEY2", value: "val2", projectId: "other-proj" },
        ],
      });

      const result = await storage_client.get_project(undefined);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.secrets).toHaveLength(1);
        expect(result.value.secrets[0].title).toBe("KEY1");
      }
    });

    it("handles empty secrets list", async () => {
      const env_map = make_valid_env_map();
      const storage_client = new BitwardenStorageClient(mock_bw_client as never, env_map);

      mock_projects_list.mockResolvedValue({
        data: [{ id: "proj-1", name: "test-project" }],
      });
      mock_secrets_list.mockResolvedValue({ data: [] });

      const result = await storage_client.get_project(undefined);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.secrets).toEqual([]);
      }
      expect(mock_secrets_get_by_ids).not.toHaveBeenCalled();
    });
  });

  describe("set_project", () => {
    it("updates existing secrets", async () => {
      const env_map = make_valid_env_map();
      const storage_client = new BitwardenStorageClient(mock_bw_client as never, env_map);

      mock_projects_list.mockResolvedValue({
        data: [{ id: "proj-1", name: "test-project" }],
      });
      mock_secrets_list.mockResolvedValue({
        data: [{ id: "sec-1" }],
      });
      mock_secrets_get_by_ids.mockResolvedValue({
        data: [{ id: "sec-1", key: "API_KEY", value: "old-value", projectId: "proj-1" }],
      });
      mock_secrets_update.mockResolvedValue({ id: "sec-1", key: "API_KEY", value: "new-value" });

      const project = {
        id: "proj-1",
        title: "test-project",
        secrets: [{ id: "sec-1", title: "API_KEY", value: "new-value" }],
      };

      const result = await storage_client.set_project(project, undefined);

      expect(result.isOk()).toBe(true);
      expect(mock_secrets_update).toHaveBeenCalledWith("org-123", "sec-1", "API_KEY", "new-value", "", ["proj-1"]);
    });

    it("creates new secrets", async () => {
      const env_map = make_valid_env_map();
      const storage_client = new BitwardenStorageClient(mock_bw_client as never, env_map);

      mock_projects_list.mockResolvedValue({
        data: [{ id: "proj-1", name: "test-project" }],
      });
      mock_secrets_list.mockResolvedValue({ data: [] });
      mock_secrets_create.mockResolvedValue({ id: "new-sec", key: "NEW_KEY", value: "new-value" });

      const project = {
        id: "proj-1",
        title: "test-project",
        secrets: [{ id: "", title: "NEW_KEY", value: "new-value" }],
      };

      const result = await storage_client.set_project(project, undefined);

      expect(result.isOk()).toBe(true);
      expect(mock_secrets_create).toHaveBeenCalledWith("org-123", "NEW_KEY", "new-value", "", ["proj-1"]);
    });

    it("handles mixed create and update", async () => {
      const env_map = make_valid_env_map();
      const storage_client = new BitwardenStorageClient(mock_bw_client as never, env_map);

      mock_projects_list.mockResolvedValue({
        data: [{ id: "proj-1", name: "test-project" }],
      });
      mock_secrets_list.mockResolvedValue({
        data: [{ id: "sec-1" }],
      });
      mock_secrets_get_by_ids.mockResolvedValue({
        data: [{ id: "sec-1", key: "EXISTING_KEY", value: "old", projectId: "proj-1" }],
      });
      mock_secrets_update.mockResolvedValue({ id: "sec-1", key: "EXISTING_KEY", value: "updated" });
      mock_secrets_create.mockResolvedValue({ id: "sec-2", key: "NEW_KEY", value: "new" });

      const project = {
        id: "proj-1",
        title: "test-project",
        secrets: [
          { id: "sec-1", title: "EXISTING_KEY", value: "updated" },
          { id: "", title: "NEW_KEY", value: "new" },
        ],
      };

      const result = await storage_client.set_project(project, undefined);

      expect(result.isOk()).toBe(true);
      expect(mock_secrets_update).toHaveBeenCalled();
      expect(mock_secrets_create).toHaveBeenCalled();
    });
  });

  describe("create_project", () => {
    it("creates new project", async () => {
      const env_map = make_valid_env_map();
      const storage_client = new BitwardenStorageClient(mock_bw_client as never, env_map);

      mock_projects_list.mockResolvedValue({ data: [] });
      mock_projects_create.mockResolvedValue({ id: "new-proj", name: "test-project__dev" });

      const result = await storage_client.create_project("dev");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe("new-proj");
        expect(result.value.title).toBe("test-project__dev");
        expect(result.value.secrets).toEqual([]);
      }
      expect(mock_projects_create).toHaveBeenCalledWith("org-123", "test-project__dev");
    });

    it("creates project without environment", async () => {
      const env_map = make_valid_env_map();
      const storage_client = new BitwardenStorageClient(mock_bw_client as never, env_map);

      mock_projects_list.mockResolvedValue({ data: [] });
      mock_projects_create.mockResolvedValue({ id: "new-proj", name: "test-project" });

      const result = await storage_client.create_project(undefined);

      expect(result.isOk()).toBe(true);
      expect(mock_projects_create).toHaveBeenCalledWith("org-123", "test-project");
    });

    it("returns error on creation failure", async () => {
      const env_map = make_valid_env_map();
      const storage_client = new BitwardenStorageClient(mock_bw_client as never, env_map);

      mock_projects_list.mockResolvedValue({ data: [] });
      mock_projects_create.mockRejectedValue(new Error("Creation failed"));

      const result = await storage_client.create_project("dev");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Could not create project "test-project__dev"');
      }
    });
  });

  describe("get_client_env_keys", () => {
    it("returns expected environment variable keys", () => {
      const env_map = make_valid_env_map();
      const storage_client = new BitwardenStorageClient(mock_bw_client as never, env_map);

      const keys = storage_client.get_client_env_keys();

      expect(keys).toContain("BWS_ACCESS_TOKEN");
      expect(keys).toContain("BWS_ORGANIZATION_ID");
      expect(keys).toContain("BWS_API_URL");
      expect(keys).toContain("BWS_IDENTITY_URL");
      expect(keys).toContain("DOTMAN_PROJECT_NAME");
    });
  });
});
