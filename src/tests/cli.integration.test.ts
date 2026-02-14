import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { okAsync } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, StorageClient } from "@/lib/types";
import { messages } from "@/messages";

let temp_dir: string;
let original_cwd: string;

const mock_storage_client: StorageClient = {
  source: "mock",
  get_project: vi.fn(),
  set_project: vi.fn(),
  create_project: vi.fn(),
  get_client_env_keys: vi.fn(() => ["OP_SERVICE_ACCOUNT_TOKEN", "OP_VAULT_NAME", "DOTMAN_PROJECT_NAME"]),
};

const mock_create_storage_client = vi.fn();
const mock_render_error = vi.fn();
const mock_render_success = vi.fn();
const mock_render_warning = vi.fn();
const mock_render_diff = vi.fn();
const mock_get_current_environment = vi.fn();
const mock_opts_with_globals = vi.fn();

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

vi.mock("@/lib/environment", () => ({
  get_current_environment: () => mock_get_current_environment(),
  get_all_environments: () => okAsync(["master"]),
  save_current_env: () => okAsync(undefined),
  validate_environment_name: (name: string) => okAsync(name),
}));

vi.mock("@/program", () => ({
  program: {
    optsWithGlobals: () => mock_opts_with_globals(),
  },
}));

import { pull_cmd } from "@/cmds/pull";
import { push_cmd } from "@/cmds/push";

describe("CLI Integration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "dotman-integration-test-"));
    original_cwd = process.cwd();
    process.chdir(temp_dir);

    (mock_storage_client.get_project as ReturnType<typeof vi.fn>).mockReset();
    (mock_storage_client.set_project as ReturnType<typeof vi.fn>).mockReset();
    (mock_storage_client.create_project as ReturnType<typeof vi.fn>).mockReset();

    mock_get_current_environment.mockReturnValue(okAsync("master"));
    mock_opts_with_globals.mockReturnValue({ apply: false, env: undefined });
  });

  afterEach(async () => {
    process.chdir(original_cwd);
    await fs.rm(temp_dir, { recursive: true, force: true });
  });

  async function create_env_file(content: Record<string, string>, suffix = ""): Promise<void> {
    const filename = suffix ? `.env.${suffix}` : ".env";
    const env_content = Object.entries(content)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    await fs.writeFile(path.join(temp_dir, filename), env_content);
  }

  describe("pull workflow", () => {
    it("pulls secrets from remote and shows diff", async () => {
      await create_env_file({
        OP_SERVICE_ACCOUNT_TOKEN: "test-token",
        OP_VAULT_NAME: "test-vault",
        DOTMAN_PROJECT_NAME: "test-project",
        API_KEY: "old-value",
      });

      const remote_project: Project = {
        id: "1",
        title: "test-project",
        secrets: [{ id: "s1", title: "API_KEY", value: "new-value" }],
      };
      (mock_storage_client.get_project as ReturnType<typeof vi.fn>).mockReturnValue(okAsync(remote_project));
      mock_create_storage_client.mockResolvedValue(okAsync(mock_storage_client));
      mock_opts_with_globals.mockReturnValue({ apply: false, env: undefined });

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_create_storage_client).toHaveBeenCalled();
      expect(mock_storage_client.get_project).toHaveBeenCalled();
      expect(mock_render_diff).toHaveBeenCalled();
    });

    it("applies changes when --apply flag is set", async () => {
      await create_env_file({
        OP_SERVICE_ACCOUNT_TOKEN: "test-token",
        OP_VAULT_NAME: "test-vault",
        DOTMAN_PROJECT_NAME: "test-project",
        OLD_KEY: "old-value",
      });

      const remote_project: Project = {
        id: "1",
        title: "test-project",
        secrets: [{ id: "s1", title: "NEW_KEY", value: "new-value" }],
      };
      (mock_storage_client.get_project as ReturnType<typeof vi.fn>).mockReturnValue(okAsync(remote_project));
      mock_create_storage_client.mockResolvedValue(okAsync(mock_storage_client));
      mock_opts_with_globals.mockReturnValue({ apply: true, env: undefined });

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.pull.success,
        }),
      );
    });
  });

  describe("push workflow", () => {
    it("pushes local env to remote and shows diff", async () => {
      await create_env_file({
        OP_SERVICE_ACCOUNT_TOKEN: "test-token",
        OP_VAULT_NAME: "test-vault",
        DOTMAN_PROJECT_NAME: "test-project",
        API_KEY: "local-value",
      });

      const remote_project: Project = {
        id: "1",
        title: "test-project",
        secrets: [],
      };
      (mock_storage_client.get_project as ReturnType<typeof vi.fn>).mockReturnValue(okAsync(remote_project));
      (mock_storage_client.set_project as ReturnType<typeof vi.fn>).mockReturnValue(okAsync(remote_project));
      mock_create_storage_client.mockResolvedValue(okAsync(mock_storage_client));
      mock_opts_with_globals.mockReturnValue({ apply: false, env: undefined });

      await push_cmd.parseAsync(["node", "push"]);

      expect(mock_create_storage_client).toHaveBeenCalled();
      expect(mock_storage_client.get_project).toHaveBeenCalled();
      expect(mock_render_diff).toHaveBeenCalled();
    });

    it("applies changes when --apply flag is set", async () => {
      await create_env_file({
        OP_SERVICE_ACCOUNT_TOKEN: "test-token",
        OP_VAULT_NAME: "test-vault",
        DOTMAN_PROJECT_NAME: "test-project",
        API_KEY: "local-value",
      });

      const remote_project: Project = {
        id: "1",
        title: "test-project",
        secrets: [],
      };
      (mock_storage_client.get_project as ReturnType<typeof vi.fn>).mockReturnValue(okAsync(remote_project));
      (mock_storage_client.set_project as ReturnType<typeof vi.fn>).mockReturnValue(okAsync(remote_project));
      mock_create_storage_client.mockResolvedValue(okAsync(mock_storage_client));
      mock_opts_with_globals.mockReturnValue({ apply: true, env: undefined });

      await push_cmd.parseAsync(["node", "push"]);

      expect(mock_storage_client.set_project).toHaveBeenCalled();
      expect(mock_render_success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: messages.commands.push.success,
        }),
      );
    });
  });

  describe("environment-specific operations", () => {
    it("operates on .env.staging when --env staging is provided", async () => {
      await create_env_file({
        OP_SERVICE_ACCOUNT_TOKEN: "test-token",
        OP_VAULT_NAME: "test-vault",
        DOTMAN_PROJECT_NAME: "test-project",
      });
      await create_env_file({ API_KEY: "staging-value" }, "staging");

      const remote_project: Project = {
        id: "1",
        title: "test-project__staging",
        secrets: [{ id: "s1", title: "API_KEY", value: "staging-value" }],
      };
      (mock_storage_client.get_project as ReturnType<typeof vi.fn>).mockReturnValue(okAsync(remote_project));
      mock_create_storage_client.mockResolvedValue(okAsync(mock_storage_client));
      mock_opts_with_globals.mockReturnValue({ apply: false, env: "staging" });

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_storage_client.get_project).toHaveBeenCalledWith("staging");
    });
  });

  describe("error scenarios", () => {
    it("handles missing .env file gracefully", async () => {
      mock_opts_with_globals.mockReturnValue({ apply: false, env: undefined });

      await pull_cmd.parseAsync(["node", "pull"]);

      expect(mock_render_error).toHaveBeenCalled();
    });
  });
});
