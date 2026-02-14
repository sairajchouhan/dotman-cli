import { Command } from "commander";
import { render_diff } from "@/components/diff";
import { render_error, render_success } from "@/components/errors";
import { calculate_push_diff } from "@/lib/diff";
import { read_env_files } from "@/lib/dotenv";
import { get_current_environment } from "@/lib/environment";
import type { Secret } from "@/lib/types";
import { uuid } from "@/lib/uuid";
import { messages } from "@/messages";
import { create_storage_client } from "@/storage/client";
import { program } from "../program";

export const push_cmd = new Command("push").description(messages.commands.push.description).action(async () => {
  const opts = program.optsWithGlobals();
  const apply: boolean = opts.apply;
  let environment: string | undefined = opts.env;

  if (!environment) {
    const state_environment_res = await get_current_environment();
    if (state_environment_res.isErr()) {
      render_error({
        message: state_environment_res.error.message,
        suggestion: state_environment_res.error.suggestion,
        exit: true,
      });
      return;
    }
    environment = state_environment_res.value;
  }

  const env_files_res = await read_env_files(environment);

  if (env_files_res.isErr()) {
    const error = env_files_res.error;
    render_error({
      message: error.message,
      suggestion: error.suggestion,
      exit: true,
    });
    return;
  }

  const { env_map, environment_env_map, env_file_name } = env_files_res.value;

  if (Object.keys(environment_env_map).length === 0) {
    render_error({
      message: messages.commands.push.no_env_vars(env_file_name),
      suggestion: messages.commands.push.no_env_vars_suggestion,
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
  const client_env_keys = storage_client.get_client_env_keys();
  const filtered_env_map = Object.fromEntries(
    Object.keys(environment_env_map)
      .filter((k) => !client_env_keys.includes(k))
      .map((k) => [k, environment_env_map[k] || ""]),
  );

  if (Object.keys(filtered_env_map).length === 0) {
    render_error({
      message: messages.commands.push.no_custom_env_vars(env_file_name),
      suggestion: messages.commands.push.no_custom_env_vars_suggestion,
      exit: true,
    });
    return;
  }

  const project_res = await storage_client.get_project(environment);

  if (project_res.isErr()) {
    const error = project_res.error;
    render_error({
      message: error.message,
      suggestion: error.suggestion,
      exit: true,
    });
    return;
  }

  const project = project_res.value;
  const secrets_map = new Map<string, Secret>(project.secrets.map((sec) => [sec.title, sec]));

  const diff_result = calculate_push_diff(filtered_env_map, secrets_map);

  if (diff_result.total_count === 0) {
    render_success({ message: messages.commands.push.up_to_date });
    return;
  }

  if (apply) {
    for (const change of diff_result.changes) {
      if (change.type === "added") {
        const new_secret: Secret = {
          id: uuid(),
          title: change.key,
          value: change.new_value || "",
        };
        project.secrets.push(new_secret);
      } else if (change.type === "modified") {
        const existing_secret = secrets_map.get(change.key);
        if (existing_secret) {
          existing_secret.value = change.new_value || "";
        }
      } else if (change.type === "deleted") {
        const secret_to_delete = secrets_map.get(change.key);
        if (secret_to_delete) {
          project.secrets = project.secrets.filter((sec) => sec.id !== secret_to_delete.id);
        }
      }
    }

    storage_client.set_project(project, environment).match(
      () => render_success({ message: messages.commands.push.success }),
      (err) => {
        render_error({
          message: err.message,
          suggestion: err.suggestion,
          exit: true,
        });
      },
    );
  } else {
    render_diff(diff_result);
  }
});
