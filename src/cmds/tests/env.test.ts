import { err, errAsync, ok, okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomError } from "@/lib/error";
import type { Project, StorageClient } from "@/lib/types";
import { messages } from "@/messages";

const mock_validate_environment_name = vi.fn();
const mock_get_all_environments = vi.fn();
const mock_get_current_environment = vi.fn();
const mock_save_current_env = vi.fn();
const mock_read_env = vi.fn();
const mock_write_env = vi.fn();
const mock_create_storage_client = vi.fn();
const mock_render_error = vi.fn();
const mock_render_success = vi.fn();
const mock_render_info = vi.fn();

vi.mock("@/lib/environment", () => ({
  validate_environment_name: (name: string) => mock_validate_environment_name(name),
  get_all_environments: () => mock_get_all_environments(),
  get_current_environment: () => mock_get_current_environment(),
  save_current_env: (env: string) => mock_save_current_env(env),
}));

vi.mock("@/lib/dotenv", () => ({
  read_env: (file: string) => mock_read_env(file),
  write_env: (map: Record<string, string>, file: string) => mock_write_env(map, file),
}));

vi.mock("@/storage/client", () => ({
  create_storage_client: (env_map: Record<string, string>) => mock_create_storage_client(env_map),
}));

vi.mock("@/components/errors", () => ({
  render_error: (opts: unknown) => mock_render_error(opts),
  render_success: (opts: unknown) => mock_render_success(opts),
  render_info: (opts: unknown) => mock_render_info(opts),
}));

import { env_cmd } from "@/cmds/env";

function create_mock_storage_client(): StorageClient {
  const project: Project = { id: "proj-1", title: "test-project", secrets: [] };
  return {
    source: "mock",
    get_project: vi.fn(() => okAsync(project)),
    set_project: vi.fn(() => okAsync(project)),
    create_project: vi.fn(() => okAsync(project)),
    get_client_env_keys: vi.fn(() => ["OP_SERVICE_ACCOUNT_TOKEN", "OP_VAULT_NAME", "DOTMAN_PROJECT_NAME"]),
    validate_secrets: vi.fn(() => ok(undefined)),
  };
}

describe("env_cmd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("env new", () => {
    it("creates new environment successfully", async () => {
      mock_validate_environment_name.mockReturnValue(ok("staging"));
      mock_read_env.mockReturnValue(
        okAsync({
          OP_SERVICE_ACCOUNT_TOKEN: "token",
          OP_VAULT_NAME: "vault",
          DOTMAN_PROJECT_NAME: "project",
          API_KEY: "secret",
        }),
      );
      const storage_client = create_mock_storage_client();
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));
      mock_write_env.mockReturnValue(okAsync(undefined));

      await env_cmd.parseAsync(["node", "env", "new", "staging"]);

      expect(mock_validate_environment_name).toHaveBeenCalledWith("staging");
      expect(storage_client.create_project).toHaveBeenCalledWith("staging");
      expect(mock_write_env).toHaveBeenCalledWith({ API_KEY: "" }, ".env.staging");
      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.env.new.success("staging"),
        }),
      );
    });

    it("rejects 'master' as environment name for new command", async () => {
      await env_cmd.parseAsync(["node", "env", "new", "master"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.env.new.master_reserved,
          suggestion: messages.commands.env.new.master_reserved_suggestion,
          exit: true,
        }),
      );
      expect(mock_validate_environment_name).not.toHaveBeenCalled();
    });

    it("renders error for invalid environment name", async () => {
      mock_validate_environment_name.mockReturnValue(
        err(new CustomError("Invalid environment name", { suggestion: "Use alphanumeric characters" })),
      );

      await env_cmd.parseAsync(["node", "env", "new", "../bad"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid environment name",
          suggestion: "Use alphanumeric characters",
          exit: true,
        }),
      );
    });

    it("renders error when .env file cannot be read", async () => {
      mock_validate_environment_name.mockReturnValue(ok("dev"));
      mock_read_env.mockReturnValue(errAsync(new CustomError(".env file not found")));

      await env_cmd.parseAsync(["node", "env", "new", "dev"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: ".env file not found",
          exit: true,
        }),
      );
    });

    it("renders error when .env file is empty", async () => {
      mock_validate_environment_name.mockReturnValue(ok("dev"));
      mock_read_env.mockReturnValue(okAsync({}));

      await env_cmd.parseAsync(["node", "env", "new", "dev"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.env.new.no_env_vars(".env"),
          exit: true,
        }),
      );
    });

    it("renders error when storage client fails", async () => {
      mock_validate_environment_name.mockReturnValue(ok("dev"));
      mock_read_env.mockReturnValue(okAsync({ OP_SERVICE_ACCOUNT_TOKEN: "token", API_KEY: "secret" }));
      mock_create_storage_client.mockReturnValue(errAsync(new CustomError("No provider found")));

      await env_cmd.parseAsync(["node", "env", "new", "dev"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "No provider found",
          exit: true,
        }),
      );
    });

    it("renders error when project creation fails", async () => {
      mock_validate_environment_name.mockReturnValue(ok("dev"));
      mock_read_env.mockReturnValue(okAsync({ OP_SERVICE_ACCOUNT_TOKEN: "token", API_KEY: "secret" }));
      const storage_client = create_mock_storage_client();
      (storage_client.create_project as ReturnType<typeof vi.fn>).mockReturnValue(
        errAsync(new CustomError("Project already exists")),
      );
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await env_cmd.parseAsync(["node", "env", "new", "dev"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Project already exists",
          exit: true,
        }),
      );
    });

    it("filters client environment keys from new env file", async () => {
      mock_validate_environment_name.mockReturnValue(ok("dev"));
      mock_read_env.mockReturnValue(
        okAsync({
          OP_SERVICE_ACCOUNT_TOKEN: "token",
          OP_VAULT_NAME: "vault",
          DOTMAN_PROJECT_NAME: "project",
          API_KEY: "secret",
          DB_URL: "connection",
        }),
      );
      const storage_client = create_mock_storage_client();
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));
      mock_write_env.mockReturnValue(okAsync(undefined));

      await env_cmd.parseAsync(["node", "env", "new", "dev"]);

      expect(mock_write_env).toHaveBeenCalledWith({ API_KEY: "", DB_URL: "" }, ".env.dev");
    });

    it("renders error when write_env fails", async () => {
      mock_validate_environment_name.mockReturnValue(ok("dev"));
      mock_read_env.mockReturnValue(okAsync({ OP_SERVICE_ACCOUNT_TOKEN: "token", API_KEY: "secret" }));
      const storage_client = create_mock_storage_client();
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));
      mock_write_env.mockReturnValue(errAsync(new CustomError("Write failed")));

      await env_cmd.parseAsync(["node", "env", "new", "dev"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Write failed",
          exit: true,
        }),
      );
    });
  });

  describe("env use", () => {
    it("sets current environment successfully", async () => {
      mock_get_all_environments.mockReturnValue(okAsync(["master", "staging", "production"]));
      mock_get_current_environment.mockReturnValue(okAsync("master"));
      mock_save_current_env.mockReturnValue(okAsync(undefined));

      await env_cmd.parseAsync(["node", "env", "use", "staging"]);

      expect(mock_save_current_env).toHaveBeenCalledWith("staging");
      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.env.use.success("staging"),
        }),
      );
    });

    it("renders error when get_all_environments fails", async () => {
      mock_get_all_environments.mockReturnValue(errAsync(new CustomError("Failed to read directory")));

      await env_cmd.parseAsync(["node", "env", "use", "dev"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Failed to read directory",
          exit: true,
        }),
      );
    });

    it("renders error when environment does not exist", async () => {
      mock_get_all_environments.mockReturnValue(okAsync(["master", "staging"]));

      await env_cmd.parseAsync(["node", "env", "use", "nonexistent"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.env.use.not_found("nonexistent"),
          suggestion: messages.commands.env.use.not_found_suggestion,
          exit: true,
        }),
      );
    });

    it("renders error when save_current_env fails", async () => {
      mock_get_all_environments.mockReturnValue(okAsync(["master", "dev"]));
      mock_get_current_environment.mockReturnValue(okAsync("master"));
      mock_save_current_env.mockReturnValue(errAsync(new CustomError("Could not save state")));

      await env_cmd.parseAsync(["node", "env", "use", "dev"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Could not save state",
          exit: true,
        }),
      );
    });
  });

  describe("env list", () => {
    it("lists all environments with current highlighted", async () => {
      mock_get_all_environments.mockReturnValue(okAsync(["master", "staging", "production"]));
      mock_get_current_environment.mockReturnValue(okAsync("staging"));

      await env_cmd.parseAsync(["node", "env", "list"]);

      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("staging"),
        }),
      );
      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("(current)"),
        }),
      );
    });

    it("shows master with .env indicator", async () => {
      mock_get_all_environments.mockReturnValue(okAsync(["master"]));
      mock_get_current_environment.mockReturnValue(okAsync("master"));

      await env_cmd.parseAsync(["node", "env", "list"]);

      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("(.env)"),
        }),
      );
    });

    it("shows correct pluralization for single environment", async () => {
      mock_get_all_environments.mockReturnValue(okAsync(["master"]));
      mock_get_current_environment.mockReturnValue(okAsync("master"));

      await env_cmd.parseAsync(["node", "env", "list"]);

      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(messages.commands.env.list.count(1)),
        }),
      );
    });

    it("shows correct pluralization for multiple environments", async () => {
      mock_get_all_environments.mockReturnValue(okAsync(["master", "dev", "staging"]));
      mock_get_current_environment.mockReturnValue(okAsync("master"));

      await env_cmd.parseAsync(["node", "env", "list"]);

      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(messages.commands.env.list.count(3)),
        }),
      );
    });

    it("renders error when get_all_environments fails", async () => {
      mock_get_all_environments.mockReturnValue(errAsync(new CustomError("Read failed")));

      await env_cmd.parseAsync(["node", "env", "list"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Read failed",
          exit: true,
        }),
      );
    });

    it("renders error when no environments found", async () => {
      mock_get_all_environments.mockReturnValue(okAsync([]));

      await env_cmd.parseAsync(["node", "env", "list"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.env.list.no_environments,
          suggestion: messages.commands.env.list.no_environments_suggestion,
          exit: true,
        }),
      );
    });

    it("renders error when get_current_environment fails", async () => {
      mock_get_all_environments.mockReturnValue(okAsync(["master"]));
      mock_get_current_environment.mockReturnValue(errAsync(new CustomError("State read failed")));

      await env_cmd.parseAsync(["node", "env", "list"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "State read failed",
          exit: true,
        }),
      );
    });
  });
});
