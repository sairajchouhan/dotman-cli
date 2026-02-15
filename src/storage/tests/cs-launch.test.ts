import { beforeEach, describe, expect, it, vi } from "vitest";

const { mock_fetch } = vi.hoisted(() => ({
  mock_fetch: vi.fn(),
}));
vi.mock("undici", () => ({
  fetch: mock_fetch,
}));

import { ContentstackLaunchStorageClient } from "@/storage/clients/cs-launch";

function make_valid_env_map() {
  return {
    DOTMAN_PROJECT_NAME: "test-project",
    CS_LAUNCH_AUTH_TOKEN: "test-token",
    CS_LAUNCH_ORGANIZATION_UID: "org-uid-456",
    CS_LAUNCH_PROJECT_UID: "proj-uid-123",
    CS_LAUNCH_API_URL: "https://launch-api.contentstack.com",
  };
}

function make_json_response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function make_error_response(status: number, body?: unknown) {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: body ? { "Content-Type": "application/json" } : {},
  });
}

// biome-ignore lint/nursery/noSecrets: test class name is not a secret
describe("ContentstackLaunchStorageClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("init", () => {
    it("validates connectivity with GET /projects/{uid}", async () => {
      mock_fetch.mockResolvedValue(make_json_response({ project: { uid: "proj-uid-123" } }));

      const env_map = make_valid_env_map();
      const result = await ContentstackLaunchStorageClient.init(env_map);

      expect(result.isOk()).toBe(true);
      expect(mock_fetch).toHaveBeenCalledWith("https://launch-api.contentstack.com/projects/proj-uid-123", {
        method: "GET",
        headers: {
          authtoken: "test-token",
          organization_uid: "org-uid-456",
        },
      });
    });

    it("returns error on non-OK response", async () => {
      mock_fetch.mockResolvedValue(make_error_response(401));

      const env_map = make_valid_env_map();
      const result = await ContentstackLaunchStorageClient.init(env_map);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("401");
        expect(result.error.suggestion).toContain("CS_LAUNCH_AUTH_TOKEN");
      }
    });

    it("returns error on network failure", async () => {
      mock_fetch.mockRejectedValue(new Error("Network error"));

      const env_map = make_valid_env_map();
      const result = await ContentstackLaunchStorageClient.init(env_map);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe("Could not connect to Contentstack Launch API");
      }
    });
  });

  describe("get_project", () => {
    it("fetches environment and returns secrets", async () => {
      mock_fetch
        .mockResolvedValueOnce(
          make_json_response({
            environments: [
              { uid: "env-1", name: "Default" },
              { uid: "env-2", name: "staging" },
            ],
          }),
        )
        .mockResolvedValueOnce(
          make_json_response({
            environment: {
              uid: "env-1",
              name: "Default",
              environmentVariables: [
                {
                  key: "API_KEY",
                  value: "secret-123",
                },
                {
                  key: "DB_URL",
                  value: "postgres://...",
                },
              ],
            },
          }),
        );

      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);
      const result = await client.get_project(undefined);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe("env-1");
        expect(result.value.title).toBe("Default");
        expect(result.value.secrets).toHaveLength(2);
        expect(result.value.secrets[0]).toEqual({
          id: "API_KEY",
          title: "API_KEY",
          value: "secret-123",
        });
      }
    });

    it("maps 'master' environment to 'Default'", async () => {
      mock_fetch
        .mockResolvedValueOnce(
          make_json_response({
            environments: [{ uid: "env-1", name: "Default" }],
          }),
        )
        .mockResolvedValueOnce(
          make_json_response({
            environment: {
              uid: "env-1",
              name: "Default",
              environmentVariables: [],
            },
          }),
        );

      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);
      const result = await client.get_project("master");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.title).toBe("Default");
      }
    });

    it("maps non-master environment name directly", async () => {
      mock_fetch
        .mockResolvedValueOnce(
          make_json_response({
            environments: [
              { uid: "env-1", name: "production" },
              { uid: "env-2", name: "staging" },
            ],
          }),
        )
        .mockResolvedValueOnce(
          make_json_response({
            environment: {
              uid: "env-2",
              name: "staging",
              environmentVariables: [],
            },
          }),
        );

      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);
      const result = await client.get_project("staging");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.title).toBe("staging");
      }
    });

    it("returns error when environment not found", async () => {
      mock_fetch.mockResolvedValue(
        make_json_response({
          environments: [{ uid: "env-1", name: "Default" }],
        }),
      );

      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);
      const result = await client.get_project("nonexistent");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("nonexistent");
        expect(result.error.message).toContain("not found");
      }
    });

    it("handles empty environment variables", async () => {
      mock_fetch
        .mockResolvedValueOnce(
          make_json_response({
            environments: [{ uid: "env-1", name: "Default" }],
          }),
        )
        .mockResolvedValueOnce(
          make_json_response({
            environment: {
              uid: "env-1",
              name: "Default",
            },
          }),
        );

      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);
      const result = await client.get_project(undefined);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.secrets).toEqual([]);
      }
    });
  });

  describe("set_project", () => {
    it("updates environment variables via PUT", async () => {
      mock_fetch
        // get_launch_environment: list environments
        .mockResolvedValueOnce(
          make_json_response({
            environments: [{ uid: "env-1", name: "Default" }],
          }),
        )
        // get_launch_environment: get environment details
        .mockResolvedValueOnce(
          make_json_response({
            environment: {
              uid: "env-1",
              name: "Default",
              environmentVariables: [
                {
                  key: "API_KEY",
                  value: "old-value",
                },
              ],
            },
          }),
        )
        // set_project: PUT environment
        .mockResolvedValueOnce(
          make_json_response({
            environment: {
              uid: "env-1",
              name: "Default",
              environmentVariables: [
                {
                  key: "API_KEY",
                  value: "new-value",
                },
                {
                  key: "NEW_KEY",
                  value: "new-secret",
                },
              ],
            },
          }),
        );

      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);
      const project = {
        id: "env-1",
        title: "Default",
        secrets: [
          { id: "var-1", title: "API_KEY", value: "new-value" },
          { id: "var-2", title: "NEW_KEY", value: "new-secret" },
        ],
      };

      const result = await client.set_project(project, undefined);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.secrets).toHaveLength(2);
        expect(result.value.secrets[0].value).toBe("new-value");
      }

      // Verify the PUT call
      const put_call = mock_fetch.mock.calls[2];
      expect(put_call[0]).toContain("/environments/env-1");
      expect(put_call[1].method).toBe("PUT");
      const body = JSON.parse(put_call[1].body);
      expect(body.environmentVariables).toHaveLength(2);
      expect(body.environmentVariables[0].key).toBe("API_KEY");
    });

    it("returns error when API PUT fails", async () => {
      mock_fetch
        .mockResolvedValueOnce(
          make_json_response({
            environments: [{ uid: "env-1", name: "Default" }],
          }),
        )
        .mockResolvedValueOnce(
          make_json_response({
            environment: {
              uid: "env-1",
              name: "Default",
              environmentVariables: [],
            },
          }),
        )
        .mockResolvedValueOnce(make_error_response(500));

      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);
      const project = {
        id: "env-1",
        title: "Default",
        secrets: [{ id: "var-1", title: "KEY", value: "value" }],
      };

      const result = await client.set_project(project, undefined);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("500");
      }
    });

    it("parses Launch API error response into readable messages", async () => {
      mock_fetch
        .mockResolvedValueOnce(
          make_json_response({
            environments: [{ uid: "env-1", name: "Default" }],
          }),
        )
        .mockResolvedValueOnce(
          make_json_response({
            environment: {
              uid: "env-1",
              name: "Default",
              environmentVariables: [],
            },
          }),
        )
        .mockResolvedValueOnce(
          make_error_response(400, {
            errors: [
              {
                "environmentVariables.0.value": {
                  code: "launch.ENVIRONMENT.ENVIRONMENT_VARIABLES.VALUE.NOT_EMPTY",
                  message: "Environment variable value should not be empty.",
                },
              },
            ],
            status: 400,
          }),
        );

      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);
      const project = {
        id: "env-1",
        title: "Default",
        secrets: [{ id: "var-1", title: "KEY", value: "" }],
      };

      const result = await client.set_project(project, undefined);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("400");
        expect(result.error.suggestion).toBe("Environment variable value should not be empty.");
      }
    });
  });

  describe("validate_secrets", () => {
    it("returns ok when all values are non-empty", () => {
      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);

      const result = client.validate_secrets({ API_KEY: "value", DB_URL: "postgres://..." });

      expect(result.isOk()).toBe(true);
    });

    it("returns error listing keys with empty values", () => {
      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);

      const result = client.validate_secrets({ FILLED: "value", EMPTY_ONE: "", EMPTY_TWO: "" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("EMPTY_ONE");
        expect(result.error.message).toContain("EMPTY_TWO");
        expect(result.error.message).not.toContain("FILLED");
      }
    });
  });

  describe("create_project", () => {
    it("validates environment exists and returns empty project", async () => {
      mock_fetch.mockResolvedValue(
        make_json_response({
          environments: [
            { uid: "env-1", name: "Default" },
            { uid: "env-2", name: "staging" },
          ],
        }),
      );

      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);
      const result = await client.create_project("staging");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe("env-2");
        expect(result.value.title).toBe("staging");
        expect(result.value.secrets).toEqual([]);
      }
    });

    it("maps master to 'Default' environment", async () => {
      mock_fetch.mockResolvedValue(
        make_json_response({
          environments: [{ uid: "env-1", name: "Default" }],
        }),
      );

      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);
      const result = await client.create_project("master");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.title).toBe("Default");
      }
    });

    it("returns error when environment does not exist", async () => {
      mock_fetch.mockResolvedValue(
        make_json_response({
          environments: [{ uid: "env-1", name: "Default" }],
        }),
      );

      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);
      const result = await client.create_project("nonexistent");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("nonexistent");
        expect(result.error.message).toContain("not found");
        expect(result.error.suggestion).toContain("Launch project dashboard");
        expect(result.error.suggestion).toContain("nonexistent");
        expect(result.error.suggestion).toContain("Available environments: Default");
      }
    });

    it("returns error on API failure", async () => {
      mock_fetch.mockResolvedValue(make_error_response(403));

      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);
      const result = await client.create_project("staging");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("403");
      }
    });
  });

  describe("get_client_env_keys", () => {
    it("returns expected environment variable keys", () => {
      const env_map = make_valid_env_map();
      const client = new ContentstackLaunchStorageClient(env_map);

      const keys = client.get_client_env_keys();

      expect(keys).toContain("DOTMAN_PROJECT_NAME");
      expect(keys).toContain("CS_LAUNCH_AUTH_TOKEN");
      expect(keys).toContain("CS_LAUNCH_ORGANIZATION_UID");
      expect(keys).toContain("CS_LAUNCH_PROJECT_UID");
      expect(keys).toContain("CS_LAUNCH_API_URL");
    });
  });
});
