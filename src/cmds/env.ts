import { Command } from "commander";
import { render_error, render_success } from "@/components/errors";
import { read_env, write_env } from "@/lib/dotenv";
import {
  get_all_environments,
  get_current_environment,
  save_current_env,
  validate_environment_name,
} from "@/lib/environment";
import { messages } from "@/messages";
import { create_storage_client } from "@/storage/client";

export const env_cmd = new Command("env").description(messages.commands.env.description);

env_cmd.addCommand(
  new Command("new")
    .description(messages.commands.env.new.description)
    .argument("<environment>", "name of the new environment")
    .action(async (environment: string) => {
      // Explicitly reject "master" for new environment creation
      if (environment.trim() === "master") {
        render_error({
          message: messages.commands.env.new.master_reserved,
          suggestion: messages.commands.env.new.master_reserved_suggestion,
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
          message: messages.commands.env.new.no_env_vars(env_file_name),
          suggestion: messages.commands.env.new.no_env_vars_suggestion,
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
            message: messages.commands.env.new.success(validated_environment),
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
    .description(messages.commands.env.use.description)
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
          message: messages.commands.env.use.not_found(environment),
          suggestion: messages.commands.env.use.not_found_suggestion,
          exit: true,
        });
        return;
      }

      const current_env_res = await get_current_environment();
      if (current_env_res.isOk() && current_env_res.value === environment) {
        render_success({
          message: messages.commands.env.use.already_using(environment),
        });
        return;
      }

      const res = await save_current_env(environment);

      if (res.isErr()) {
        render_error({ message: res.error.message, suggestion: res.error.suggestion, exit: true });
        return;
      }

      render_success({
        message: messages.commands.env.use.success(environment),
      });
    }),
);

env_cmd.addCommand(
  new Command("list").description(messages.commands.env.list.description).action(async () => {
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
        message: messages.commands.env.list.no_environments,
        suggestion: messages.commands.env.list.no_environments_suggestion,
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
        const icon = is_current ? messages.commands.env.list.current_icon : messages.commands.env.list.other_icon;
        const file_indicator = env === "master" ? messages.commands.env.list.base_env_indicator : "";
        const current_indicator = is_current ? messages.commands.env.list.current_indicator : "";
        return `  ${icon} ${env}${file_indicator}${current_indicator}`;
      })
      .join("\n");

    const count_text = messages.commands.env.list.count(all_environments.length);

    render_success({
      message: `${messages.commands.env.list.header}\n${formatted_list}\n\n${count_text}`,
    });
  }),
);
