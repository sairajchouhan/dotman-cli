import { Command } from "commander";
import { render_error, render_success } from "@/components/errors";
import { read_env, write_env } from "@/lib/dotenv";
import {
  get_all_environments,
  get_current_environment,
  save_current_env,
  validate_environment_name,
} from "@/lib/environment";
import { create_storage_client } from "@/storage/client";

export const env_cmd = new Command("env").description(
  "List available environments or manage environment configurations",
);

env_cmd.addCommand(
  new Command("new")
    .description("Create a new environment file based on the default .env file")
    .argument("<environment>", "name of the new environment")
    .action(async (environment: string) => {
      // Explicitly reject "master" for new environment creation
      if (environment.trim() === "master") {
        render_error({
          message: 'Cannot create environment named "master"',
          suggestion:
            'The name "master" is reserved for the base .env file. Use a different name (e.g., main, primary, base)',
          exit: true,
        });
        return;
      }

      const validation_result = validate_environment_name(environment);
      if (validation_result.isErr()) {
        const error = validation_result.error;
        render_error({
          message: error.message,
          suggestion: error.suggestion,
          exit: true,
        });
        return;
      }

      const validated_environment = validation_result.value;
      const env_file_name = ".env";
      const new_env_file_name = `.env.${validated_environment}`;
      const env_map_res = await read_env(env_file_name);

      if (env_map_res.isErr()) {
        const error = env_map_res.error;
        render_error({
          message: error.message,
          suggestion: error.suggestion,
          exit: true,
        });
        return;
      }

      const env_map = env_map_res.value;

      if (Object.keys(env_map).length === 0) {
        render_error({
          message: `No environment variables found in "${env_file_name}"`,
          suggestion: "Add some KEY=VALUE pairs to your .env file before creating a new environment",
          exit: true,
        });
        return;
      }

      const storage_client_res = await create_storage_client(env_map);

      if (storage_client_res.isErr()) {
        const error = storage_client_res.error;
        render_error({
          message: error.message,
          suggestion: error.suggestion,
          exit: true,
        });
        return;
      }

      const storage_client = storage_client_res.value;
      const project_res = await storage_client.create_project(validated_environment);

      if (project_res.isErr()) {
        const error = project_res.error;
        render_error({
          message: error.message,
          suggestion: error.suggestion,
          exit: true,
        });
        return;
      }

      const client_env_keys = storage_client.get_client_env_keys();
      const filtered_env_map = Object.fromEntries(
        Object.keys(env_map)
          .filter((k) => !client_env_keys.includes(k))
          .map((k) => [k, ""]),
      );

      write_env(filtered_env_map, new_env_file_name).match(
        () => {
          render_success({
            message: `Created new environment "${validated_environment}"\n\nRun "dotman env use ${validated_environment}" to switch to this environment`,
          });
        },
        (err) => {
          render_error({
            message: err.message,
            suggestion: err.suggestion,
            exit: true,
          });
        },
      );
    }),
);

env_cmd.addCommand(
  new Command("use")
    .description("Set the current environment to use for operations")
    .argument("<environment>", "name of the environment to use")
    .action(async (environment: string) => {
      const all_environments_res = await get_all_environments();

      if (all_environments_res.isErr()) {
        render_error({
          message: all_environments_res.error.message,
          suggestion: all_environments_res.error.suggestion,
          exit: true,
        });
        return;
      }

      const all_environments = all_environments_res.value;
      const user_environment_found = all_environments.find((e) => e === environment);

      if (!user_environment_found) {
        render_error({
          message: `Environment "${environment}" not found`,
          suggestion: `List all environments by running "dotman env list"`,
          exit: true,
        });
        return;
      }

      const current_env_res = await get_current_environment();
      if (current_env_res.isOk() && current_env_res.value === environment) {
        render_success({
          message: `Already using environment "${environment}"`,
        });
        return;
      }

      const res = await save_current_env(environment);

      if (res.isErr()) {
        render_error({ message: res.error.message, suggestion: res.error.suggestion, exit: true });
        return;
      }

      render_success({
        message: `Changed the current environment to "${environment}"`,
      });
    }),
);

env_cmd.addCommand(
  new Command("list").description("List all environments").action(async () => {
    const all_environments_res = await get_all_environments();

    if (all_environments_res.isErr()) {
      render_error({
        message: all_environments_res.error.message,
        suggestion: all_environments_res.error.suggestion,
        exit: true,
      });
      return;
    }

    const all_environments = all_environments_res.value;

    if (all_environments.length === 0) {
      render_error({
        message: "No environments found",
        suggestion: 'Create a new environment with "dotman env new <name>" or add a .env file',
        exit: true,
      });
      return;
    }

    const current_environment_res = await get_current_environment();
    if (current_environment_res.isErr()) {
      render_error({
        message: current_environment_res.error.message,
        suggestion: current_environment_res.error.suggestion,
        exit: true,
      });
      return;
    }

    const current_environment = current_environment_res.value;

    const formatted_list = all_environments
      .map((env) => {
        const is_current = current_environment === env;
        const icon = is_current ? "★" : "•";
        const file_indicator = env === "master" ? " (.env)" : "";
        const current_indicator = is_current ? " (current)" : "";
        return `  ${icon} ${env}${file_indicator}${current_indicator}`;
      })
      .join("\n");

    const count_text = `${all_environments.length} ${all_environments.length === 1 ? "environment" : "environments"} found`;

    render_success({
      message: `Available Environments:\n${formatted_list}\n\n${count_text}`,
    });
  }),
);
