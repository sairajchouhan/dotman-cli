import { errAsync, okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomError } from "@/lib/error";
import type { Project, StorageClient } from "@/lib/types";
import { messages } from "@/messages";

const mock_opts_with_globals = vi.fn();
const mock_get_current_environment = vi.fn();
const mock_read_env_files = vi.fn();
const mock_create_storage_client = vi.fn();
const mock_write_env = vi.fn();
const mock_render_error = vi.fn();
const mock_render_success = vi.fn();
const mock_render_warning = vi.fn();
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
  write_env: (map: Record<string, string>, file: string) => mock_write_env(map, file),
}));

vi.mock("@/storage/client", () => ({
  create_storage_client: (env_map: Record<string, string>) => mock_create_storage_client(env_map),
}));

vi.mock("@/components/errors", () => ({
  render_error: (opts: unknown) => mock_render_error(opts),
  render_success: (opts: unknown) => mock_render_success(opts),
  render_warning: (opts: unknown) => mock_render_warning(opts),
}));

vi.mock("@/components/diff", () => ({
  render_diff: (diff: unknown, context?: string) => mock_render_diff(diff, context),
}));

import { pull_cmd } from "@/cmds/pull";

function create_mock_storage_client(secrets: Array<{ id: string; title: string; value: string }> = []): StorageClient {
  const project: Project = { id: "proj-1", title: "test-project", secrets };
  return {
    source: "mock",
    get_project: vi.fn(() => okAsync(project)),
    set_project: vi.fn(() => okAsync(project)),
    create_project: vi.fn(() => okAsync(project)),
    get_client_env_keys: vi.fn(() => ["OP_SERVICE_ACCOUNT_TOKEN", "OP_VAULT_NAME", "DOTMAN_PROJECT_NAME"]),
  };
}

describe("pull_cmd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("environment resolution", () => {
    it("uses environment from --env flag when provided", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "staging" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { API_KEY: "local-value" },
          env_file_name: ".env.staging",
        }),
      );
      const storage_client = create_mock_storage_client([{ id: "1", title: "API_KEY", value: "remote-value" }]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_get_current_environment).not.toHaveBeenCalled();
      expect(mock_read_env_files).toHaveBeenCalledWith("staging");
    });

    it("falls back to state file when --env not provided", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: undefined });
      mock_get_current_environment.mockReturnValue(okAsync("production"));
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { API_KEY: "local-value" },
          env_file_name: ".env.production",
        }),
      );
      const storage_client = create_mock_storage_client([{ id: "1", title: "API_KEY", value: "remote-value" }]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_get_current_environment).toHaveBeenCalled();
      expect(mock_read_env_files).toHaveBeenCalledWith("production");
    });

    it("renders error when state file read fails", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: undefined });
      mock_get_current_environment.mockReturnValue(
        errAsync(new CustomError("State file not found", { suggestion: "Run dotman env use <env>" })),
      );

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "State file not found",
          suggestion: "Run dotman env use <env>",
          exit: true,
        }),
      );
    });
  });

  describe("env files handling", () => {
    it("renders error when env files cannot be read", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "dev" });
      mock_read_env_files.mockReturnValue(errAsync(new CustomError(".env file not found")));

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: ".env file not found",
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
          environment_env_map: {},
          env_file_name: ".env.dev",
        }),
      );
      mock_create_storage_client.mockReturnValue(errAsync(new CustomError("No provider found")));

      await pull_cmd.parseAsync(["node", "pull"]);

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
          environment_env_map: {},
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client();
      (storage_client.get_project as ReturnType<typeof vi.fn>).mockReturnValue(
        errAsync(new CustomError("Remote access denied")),
      );
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Remote access denied",
          exit: true,
        }),
      );
    });
  });

  describe("client env keys warning", () => {
    it("renders warning when client env keys found in remote", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: {},
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client([
        { id: "1", title: "OP_SERVICE_ACCOUNT_TOKEN", value: "leaked-token" },
        { id: "2", title: "API_KEY", value: "secret" },
      ]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_render_warning).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("OP_SERVICE_ACCOUNT_TOKEN"),
        }),
      );
    });
  });

  describe("empty remote", () => {
    it("renders error when remote has no secrets", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: {},
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client([]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.pull.no_secrets("test-project"),
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

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.pull.up_to_date,
        }),
      );
    });

    it("renders diff when changes exist without --apply", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { API_KEY: "old-value" },
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client([{ id: "1", title: "API_KEY", value: "new-value" }]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_render_diff).toHaveBeenCalledWith(
        expect.objectContaining({
          total_count: 1,
          modified_count: 1,
        }),
        "pull",
      );
    });
  });

  describe("apply mode", () => {
    it("writes changes to env file with --apply", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: true, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { OLD_KEY: "old" },
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client([{ id: "1", title: "NEW_KEY", value: "new" }]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));
      mock_write_env.mockReturnValue(okAsync(undefined));

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_write_env).toHaveBeenCalledWith({ NEW_KEY: "new" }, ".env.dev");
      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.pull.success,
        }),
      );
    });

    it("renders error when write_env fails", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: true, env: "dev" });
      mock_read_env_files.mockReturnValue(
        okAsync({
          env_map: { OP_SERVICE_ACCOUNT_TOKEN: "token" },
          environment_env_map: { API_KEY: "old" },
          env_file_name: ".env.dev",
        }),
      );
      const storage_client = create_mock_storage_client([{ id: "1", title: "API_KEY", value: "new" }]);
      mock_create_storage_client.mockReturnValue(okAsync(storage_client));
      mock_write_env.mockReturnValue(errAsync(new CustomError("Write failed")));

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.pull.write_failed,
          exit: true,
        }),
      );
    });
  });
});
