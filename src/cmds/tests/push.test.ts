import { errAsync, ok, okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomError } from "@/lib/error";
import type { Project, StorageClient } from "@/lib/types";
import { messages } from "@/messages";

const mock_opts_with_globals = vi.fn();
const mock_get_current_environment = vi.fn();
const mock_read_env_files = vi.fn();
const mock_create_storage_client = vi.fn();
const mock_render_error = vi.fn();
const mock_render_success = vi.fn();
const mock_render_diff = vi.fn();

vi.mock("@/program", () => ({
  program: {
    optsWithGlobals: () => mock_opts_with_globals(),
  },
}));

vi.mock("@/lib/environment", () => ({
  get_current_environment: () => mock_get_current_environment(),
}));

vi.mock("@/lib/dotenv", () => ({
  read_env_files: (env: string | undefined) => mock_read_env_files(env),
}));

vi.mock("@/storage/client", () => ({
  create_storage_client: (env_map: Record<string, string>) => mock_create_storage_client(env_map),
}));

vi.mock("@/components/errors", () => ({
  render_error: (opts: unknown) => mock_render_error(opts),
  render_success: (opts: unknown) => mock_render_success(opts),
}));

vi.mock("@/components/diff", () => ({
  render_diff: (diff: unknown, context?: string) => mock_render_diff(diff, context),
}));

vi.mock("@/lib/uuid", () => ({
  uuid: () => "generated-uuid",
}));

import { push_cmd } from "@/cmds/push";

function create_mock_storage_client(secrets: Array<{ id: string; title: string; value: string }> = []): StorageClient {
  const project: Project = { id: "proj-1", title: "test-project", secrets };
  return {
    source: "mock",
    get_project: vi.fn(() => okAsync(project)),
    set_project: vi.fn(() => okAsync(project)),
    create_project: vi.fn(() => okAsync(project)),
    get_client_env_keys: vi.fn(() => ["OP_SERVICE_ACCOUNT_TOKEN", "OP_VAULT_NAME", "DOTMAN_PROJECT_NAME"]),
    validate_secrets: vi.fn(() => ok(undefined)),
  };
}

describe("push_cmd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("environment resolution", () => {
    it("uses environment from --env flag when provided", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "staging" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { API_KEY: "value" },
          env_file_name: ".env.staging",
        }),
      );
      const storage_client = create_mock_storage_client([]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await push_cmd.parseAsync(["node", "push"]);

      expect(mock_get_current_environment).not.toHaveBeenCalled();
      expect(mock_read_env_files).toHaveBeenCalledWith("staging");
    });

    it("falls back to state file when --env not provided", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: undefined });
      mock_get_current_environment.mockReturnValue(okAsync("production"));
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { API_KEY: "value" },
          env_file_name: ".env.production",
        }),
      );
      const storage_client = create_mock_storage_client([]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await push_cmd.parseAsync(["node", "push"]);

      expect(mock_get_current_environment).toHaveBeenCalled();
      expect(mock_read_env_files).toHaveBeenCalledWith("production");
    });

    it("renders error when state file read fails", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: undefined });
      mock_get_current_environment.mockReturnValue(errAsync(new CustomError("State file not found")));

      await push_cmd.parseAsync(["node", "push"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "State file not found",
          exit: true,
        }),
      );
    });
  });

  describe("env files handling", () => {
    it("renders error when env files cannot be read", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "dev" });
      mock_read_env_files.mockReturnValue(errAsync(new CustomError(".env file not found")));

      await push_cmd.parseAsync(["node", "push"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: ".env file not found",
          exit: true,
        }),
      );
    });

    it("renders error when env file is empty", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: {},
          env_file_name: ".env.dev",
        }),
      );

      await push_cmd.parseAsync(["node", "push"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.push.no_env_vars(".env.dev"),
          suggestion: messages.commands.push.no_env_vars_suggestion,
          exit: true,
        }),
      );
    });
  });

  describe("storage client", () => {
    it("renders error when storage client fails to initialize", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: {},
          environment_env_map: { API_KEY: "value" },
          env_file_name: ".env.dev",
        }),
      );
      mock_create_storage_client.mockReturnValue(errAsync(new CustomError("No provider found")));

      await push_cmd.parseAsync(["node", "push"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "No provider found",
          exit: true,
        }),
      );
    });

    it("renders error when get_project fails", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { API_KEY: "value" },
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client();
      (storage_client.get_project as ReturnType<typeof vi.fn>).mockReturnValue(
        errAsync(new CustomError("Remote access denied")),
      );
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await push_cmd.parseAsync(["node", "push"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Remote access denied",
          exit: true,
        }),
      );
    });
  });

  describe("client env filtering", () => {
    it("filters out client environment keys from push", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: {
            OP_SERVICE_ACCOUNT_TOKEN: "token",
            API_KEY: "secret",
          },
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client([]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await push_cmd.parseAsync(["node", "push"]);

      const call_args = mock_render_diff.mock.calls[0]!;
      expect(call_args[0].added_count).toBe(1);
    });

    it("renders error when only client env vars present", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: {
            OP_SERVICE_ACCOUNT_TOKEN: "token",
            OP_VAULT_NAME: "vault",
            DOTMAN_PROJECT_NAME: "project",
          },
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client();
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await push_cmd.parseAsync(["node", "push"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.push.no_custom_env_vars(".env.dev"),
          exit: true,
        }),
      );
    });
  });

  describe("diff calculation", () => {
    it("renders success when no changes needed", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { API_KEY: "same-value" },
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client([{ id: "1", title: "API_KEY", value: "same-value" }]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await push_cmd.parseAsync(["node", "push"]);

      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.push.up_to_date,
        }),
      );
    });

    it("renders diff when changes exist without --apply", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { API_KEY: "new-value" },
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client([{ id: "1", title: "API_KEY", value: "old-value" }]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await push_cmd.parseAsync(["node", "push"]);

      const call_args = mock_render_diff.mock.calls[0]!;
      expect(call_args[0].total_count).toBe(1);
      expect(call_args[0].modified_count).toBe(1);
    });
  });

  describe("apply mode", () => {
    it("calls set_project with updated secrets", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: true, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { NEW_KEY: "new-value" },
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client([]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await push_cmd.parseAsync(["node", "push"]);

      expect(storage_client.set_project).toHaveBeenCalled();
      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.push.success,
        }),
      );
    });

    it("handles added secrets correctly", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: true, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { NEW_KEY: "new-value" },
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client([]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await push_cmd.parseAsync(["node", "push"]);

      const set_project_call = (storage_client.set_project as ReturnType<typeof vi.fn>).mock.calls[0]!;
      const project: Project = set_project_call[0];
      expect(project.secrets).toHaveLength(1);
      expect(project.secrets[0]?.title).toBe("NEW_KEY");
      expect(project.secrets[0]?.value).toBe("new-value");
      expect(project.secrets[0]?.id).toBe("generated-uuid");
    });

    it("handles modified secrets correctly", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: true, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { API_KEY: "updated-value" },
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client([{ id: "existing-id", title: "API_KEY", value: "old-value" }]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await push_cmd.parseAsync(["node", "push"]);

      const set_project_call = (storage_client.set_project as ReturnType<typeof vi.fn>).mock.calls[0]!;
      const project: Project = set_project_call[0];
      const modified_secret = project.secrets.find((s) => s.title === "API_KEY");
      expect(modified_secret?.value).toBe("updated-value");
      expect(modified_secret?.id).toBe("existing-id");
    });

    it("handles deleted secrets correctly", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: true, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { KEEP_KEY: "value" },
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client([
        { id: "keep-id", title: "KEEP_KEY", value: "value" },
        { id: "delete-id", title: "DELETE_KEY", value: "old-value" },
      ]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await push_cmd.parseAsync(["node", "push"]);

      const set_project_call = (storage_client.set_project as ReturnType<typeof vi.fn>).mock.calls[0]!;
      const project: Project = set_project_call[0];
      expect(project.secrets).toHaveLength(1);
      expect(project.secrets.find((s) => s.title === "DELETE_KEY")).toBeUndefined();
    });

    it("renders error when set_project fails", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: true, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { API_KEY: "value" },
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client([]);
      (storage_client.set_project as ReturnType<typeof vi.fn>).mockReturnValue(
        errAsync(new CustomError("Update failed")),
      );
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await push_cmd.parseAsync(["node", "push"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Update failed",
          exit: true,
        }),
      );
    });
  });
});
