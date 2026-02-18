import { errAsync, ok, okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomError } from "@/lib/error";
import type { Project, StorageClient } from "@/lib/types";
import { messages } from "@/messages";

const mock_select = vi.fn();
const mock_text = vi.fn();
const mock_password = vi.fn();
const mock_cancel = vi.fn();
const mock_is_cancel = vi.fn();
const mock_read_env = vi.fn();
const mock_write_env = vi.fn();
const mock_render_error = vi.fn();
const mock_render_success = vi.fn();
const mock_render_warning = vi.fn();

const mock_storage_client: StorageClient = {
  source: "mock",
  get_project: vi.fn(() => okAsync({ id: "1", title: "test", secrets: [] } as Project)),
  set_project: vi.fn(() => okAsync({ id: "1", title: "test", secrets: [] } as Project)),
  create_project: vi.fn(() => okAsync({ id: "1", title: "test", secrets: [] } as Project)),
  get_client_env_keys: vi.fn(() => []),
  validate_secrets: vi.fn(() => ok(undefined)),
};

const mock_provider_create = vi.fn();

vi.mock("@clack/prompts", () => ({
  select: (opts: unknown) => mock_select(opts),
  cancel: (msg: string) => mock_cancel(msg),
  isCancel: (val: unknown) => mock_is_cancel(val),
  text: (opts: unknown) => mock_text(opts),
  password: (opts: unknown) => mock_password(opts),
}));

vi.mock("@/lib/dotenv", () => ({
  read_env: (file: string) => mock_read_env(file),
  write_env: (map: Record<string, string>, file: string) => mock_write_env(map, file),
}));

vi.mock("@/components/errors", () => ({
  render_error: (opts: unknown) => mock_render_error(opts),
  render_success: (opts: unknown) => mock_render_success(opts),
  render_warning: (opts: unknown) => mock_render_warning(opts),
}));

vi.mock("@/storage/providers", () => ({
  PROVIDER_REGISTRY: {
    onepassword: {
      key: "onepassword",
      label: "1Password",
      env_map_schema: {
        safeParse: (data: unknown) => ({ success: true, data }),
        partial: () => ({
          safeParse: () => ({ success: true }),
        }),
      },
      get_env_map_keys: () => ["DOTMAN_PROJECT_NAME", "OP_VAULT_NAME", "OP_SERVICE_ACCOUNT_TOKEN"],
      get_field_metadata: () => ({
        DOTMAN_PROJECT_NAME: { description: "Enter project name" },
        OP_VAULT_NAME: { description: "Enter vault name" },
        OP_SERVICE_ACCOUNT_TOKEN: { description: "Enter token", doc_url: "https://docs.1password.com" },
      }),
      create: (env_map: Record<string, string>) => mock_provider_create(env_map),
    },
    bitwarden: {
      key: "bitwarden",
      label: "BitWarden",
      env_map_schema: {
        safeParse: (data: unknown) => ({ success: true, data }),
        partial: () => ({
          safeParse: () => ({ success: true }),
        }),
      },
      get_env_map_keys: () => ["DOTMAN_PROJECT_NAME", "BWS_ACCESS_TOKEN", "BWS_ORGANIZATION_ID"],
      get_field_metadata: () => ({}),
      create: (env_map: Record<string, string>) => mock_provider_create(env_map),
    },
  },
}));

import { init_cmd } from "@/cmds/init";

const mock_onepassword_inputs = (project = "test-project", vault = "test-vault", token = "test-token") => {
  mock_text.mockResolvedValueOnce(project).mockResolvedValueOnce(vault).mockResolvedValueOnce(token);
};

describe("init_cmd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock_is_cancel.mockReturnValue(false);
  });

  describe("existing .env handling", () => {
    it("prompts for action when .env exists with values", async () => {
      mock_read_env.mockReturnValue(okAsync({ EXISTING_KEY: "value" }));
      mock_select.mockResolvedValueOnce("overwrite").mockResolvedValueOnce("onepassword");
      mock_onepassword_inputs();
      mock_write_env.mockReturnValue(okAsync(undefined));
      mock_provider_create.mockReturnValue(okAsync(mock_storage_client));

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("already has values"),
        }),
      );
    });

    it("skips action prompt for empty .env (ENOENT)", async () => {
      const enoent_error = new CustomError("File not found");
      (enoent_error as { cause?: { code: string } }).cause = { code: "ENOENT" };
      mock_read_env.mockReturnValue(errAsync(enoent_error));
      mock_select.mockResolvedValueOnce("onepassword");
      mock_onepassword_inputs();
      mock_write_env.mockReturnValue(okAsync(undefined));
      mock_provider_create.mockReturnValue(okAsync(mock_storage_client));

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_select).toHaveBeenCalledTimes(1);
      expect(mock_select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("storage provider"),
        }),
      );
    });

    it("cancels when user selects cancel option", async () => {
      mock_read_env.mockReturnValue(okAsync({ EXISTING_KEY: "value" }));
      mock_select.mockResolvedValueOnce("cancel");
      mock_is_cancel.mockReturnValue(false);

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_cancel).toHaveBeenCalledWith(messages.commands.init.operation_cancelled);
      expect(mock_write_env).not.toHaveBeenCalled();
    });

    it("cancels when user presses Ctrl+C on action prompt", async () => {
      mock_read_env.mockReturnValue(okAsync({ EXISTING_KEY: "value" }));
      const cancel_symbol = Symbol("cancel");
      mock_select.mockResolvedValueOnce(cancel_symbol);
      mock_is_cancel.mockImplementation((val) => val === cancel_symbol);

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_cancel).toHaveBeenCalled();
    });

    it("keeps existing values when ignore action selected", async () => {
      mock_read_env.mockReturnValue(okAsync({ EXISTING_KEY: "existing-value" }));
      mock_select.mockResolvedValueOnce("ignore").mockResolvedValueOnce("onepassword");
      mock_onepassword_inputs();
      mock_write_env.mockReturnValue(okAsync(undefined));
      mock_provider_create.mockReturnValue(okAsync(mock_storage_client));

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_write_env).toHaveBeenCalledWith(
        expect.objectContaining({
          EXISTING_KEY: "existing-value",
          DOTMAN_PROJECT_NAME: "test-project",
        }),
        ".env",
      );
    });

    it("overwrites existing values when overwrite action selected", async () => {
      mock_read_env.mockReturnValue(okAsync({ EXISTING_KEY: "existing-value" }));
      mock_select.mockResolvedValueOnce("overwrite").mockResolvedValueOnce("onepassword");
      mock_onepassword_inputs();
      mock_write_env.mockReturnValue(okAsync(undefined));
      mock_provider_create.mockReturnValue(okAsync(mock_storage_client));

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_write_env).toHaveBeenCalledWith(
        expect.not.objectContaining({
          EXISTING_KEY: "existing-value",
        }),
        ".env",
      );
    });
  });

  describe("read_env errors", () => {
    it("renders error when read_env fails with non-ENOENT error", async () => {
      mock_read_env.mockReturnValue(errAsync(new CustomError("Permission denied")));

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.init.read_env_failed,
          exit: true,
        }),
      );
    });
  });

  describe("provider selection", () => {
    it("prompts for provider selection", async () => {
      mock_read_env.mockReturnValue(okAsync({}));
      mock_select.mockResolvedValueOnce("onepassword");
      mock_onepassword_inputs();
      mock_write_env.mockReturnValue(okAsync(undefined));
      mock_provider_create.mockReturnValue(okAsync(mock_storage_client));

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("storage provider"),
          options: expect.arrayContaining([
            expect.objectContaining({ label: "1Password", value: "onepassword" }),
            expect.objectContaining({ label: "BitWarden", value: "bitwarden" }),
          ]),
        }),
      );
    });

    it("cancels when user cancels provider selection", async () => {
      mock_read_env.mockReturnValue(okAsync({}));
      const cancel_symbol = Symbol("cancel");
      mock_select.mockResolvedValueOnce(cancel_symbol);
      mock_is_cancel.mockImplementation((val) => val === cancel_symbol);

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_cancel).toHaveBeenCalled();
      expect(mock_text).not.toHaveBeenCalled();
    });

    it("renders error for invalid provider", async () => {
      mock_read_env.mockReturnValue(okAsync({}));
      mock_select.mockResolvedValueOnce("overwrite").mockResolvedValueOnce("invalid_provider");

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.init.invalid_provider,
          exit: true,
        }),
      );
    });
  });

  describe("credential input", () => {
    it("collects credentials via prompt inputs", async () => {
      mock_read_env.mockReturnValue(okAsync({}));
      mock_select.mockResolvedValueOnce("onepassword");
      mock_onepassword_inputs("my-project", "my-vault", "my-token");
      mock_write_env.mockReturnValue(okAsync(undefined));
      mock_provider_create.mockReturnValue(okAsync(mock_storage_client));

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_text).toHaveBeenCalledTimes(3);
    });

    it("aborts all remaining credential prompts when user presses Ctrl+C", async () => {
      mock_read_env.mockReturnValue(okAsync({}));
      mock_select.mockResolvedValueOnce("onepassword");
      const cancel_symbol = Symbol("cancel");
      mock_text.mockResolvedValueOnce(cancel_symbol);
      mock_is_cancel.mockImplementation((val) => val === cancel_symbol);

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_cancel).toHaveBeenCalledWith(messages.commands.init.operation_cancelled);
      expect(mock_text).toHaveBeenCalledTimes(1);
      expect(mock_write_env).not.toHaveBeenCalled();
      expect(mock_provider_create).not.toHaveBeenCalled();
      expect(mock_render_error).not.toHaveBeenCalled();
    });
  });

  describe("write_env", () => {
    it("writes env map to .env file", async () => {
      mock_read_env.mockReturnValue(okAsync({}));
      mock_select.mockResolvedValueOnce("onepassword");
      mock_onepassword_inputs();
      mock_write_env.mockReturnValue(okAsync(undefined));
      mock_provider_create.mockReturnValue(okAsync(mock_storage_client));

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_write_env).toHaveBeenCalledWith(
        {
          DOTMAN_PROJECT_NAME: "test-project",
          OP_VAULT_NAME: "test-vault",
          OP_SERVICE_ACCOUNT_TOKEN: "test-token",
        },
        ".env",
      );
    });

    it("renders error when write_env fails", async () => {
      mock_read_env.mockReturnValue(okAsync({}));
      mock_select.mockResolvedValueOnce("onepassword");
      mock_onepassword_inputs();
      mock_write_env.mockReturnValue(errAsync(new CustomError("Write failed")));

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Write failed",
          exit: true,
        }),
      );
    });
  });

  describe("storage client creation", () => {
    it("creates storage client with provider", async () => {
      mock_read_env.mockReturnValue(okAsync({}));
      mock_select.mockResolvedValueOnce("onepassword");
      mock_onepassword_inputs();
      mock_write_env.mockReturnValue(okAsync(undefined));
      mock_provider_create.mockReturnValue(okAsync(mock_storage_client));

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_provider_create).toHaveBeenCalledWith({
        DOTMAN_PROJECT_NAME: "test-project",
        OP_VAULT_NAME: "test-vault",
        OP_SERVICE_ACCOUNT_TOKEN: "test-token",
      });
    });

    it("renders error when storage client creation fails", async () => {
      mock_read_env.mockReturnValue(okAsync({}));
      mock_select.mockResolvedValueOnce("onepassword");
      mock_onepassword_inputs("test-project", "test-vault", "invalid-token");
      mock_write_env.mockReturnValue(okAsync(undefined));
      mock_provider_create.mockReturnValue(errAsync(new CustomError("Invalid token")));

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid token",
          exit: true,
        }),
      );
    });
  });

  describe("project creation", () => {
    it("creates project in vault", async () => {
      mock_read_env.mockReturnValue(okAsync({}));
      mock_select.mockResolvedValueOnce("onepassword");
      mock_onepassword_inputs();
      mock_write_env.mockReturnValue(okAsync(undefined));
      mock_provider_create.mockReturnValue(okAsync(mock_storage_client));

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_storage_client.create_project).toHaveBeenCalledWith("master");
    });

    it("renders error when project creation fails", async () => {
      mock_read_env.mockReturnValue(okAsync({}));
      mock_select.mockResolvedValueOnce("onepassword");
      mock_onepassword_inputs();
      mock_write_env.mockReturnValue(okAsync(undefined));
      const failing_client = {
        ...mock_storage_client,
        create_project: vi.fn(() => errAsync(new CustomError("Project already exists"))),
      };
      mock_provider_create.mockReturnValue(okAsync(failing_client));

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_render_error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Project already exists",
          exit: true,
        }),
      );
    });

    it("renders success message after successful initialization", async () => {
      mock_read_env.mockReturnValue(okAsync({}));
      mock_select.mockResolvedValueOnce("onepassword");
      mock_onepassword_inputs("my-awesome-project", "test-vault", "test-token");
      mock_write_env.mockReturnValue(okAsync(undefined));
      mock_provider_create.mockReturnValue(okAsync(mock_storage_client));

      await init_cmd.parseAsync(["node", "init"]);

      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("my-awesome-project"),
        }),
      );
      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("1Password"),
        }),
      );
    });
  });
});
