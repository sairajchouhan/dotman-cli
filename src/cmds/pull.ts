import { Command } from "commander";
import { render_diff } from "@/components/diff";
import { render_error, render_success, render_warning } from "@/components/errors";
import { calculate_pull_diff } from "@/lib/diff";
import { read_env_files, write_env } from "@/lib/dotenv";
import { get_current_environment } from "@/lib/environment";
import { messages } from "@/messages";
import { program } from "@/program";
import { create_storage_client } from "@/storage/client";

export const pull_cmd = new Command("pull").description(messages.commands.pull.description).action(async () => {
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

  const storage_client = await create_storage_client(env_map);

  if (storage_client.isErr()) {
    render_error({ message: storage_client.error.message, exit: true });
    return;
  }
  const client = storage_client.value;
  const project_res = await client.get_project(environment);

  if (project_res.isErr()) {
    render_error({ message: project_res.error.message, exit: true });
    return;
  }

  const project = project_res.value;
  const secrets_map = Object.fromEntries(project.secrets.map((i) => [i.title, i.value]));
  const client_env_keys = client.get_client_env_keys();
  const secrets_map_client_env_keys = Object.keys(secrets_map).filter((key) => client_env_keys.includes(key));

  if (secrets_map_client_env_keys.length > 0) {
    render_warning({
      message: messages.commands.pull.client_keys_warning(secrets_map_client_env_keys),
    });
    return;
  }

  if (Object.keys(secrets_map).length === 0) {
    render_error({ message: messages.commands.pull.no_secrets(project.title), exit: true });
    return;
  }

  const diff_result = calculate_pull_diff(environment_env_map, secrets_map, client_env_keys);

  if (diff_result.total_count === 0) {
    render_success({ message: messages.commands.pull.up_to_date });
    return;
  }

  if (apply) {
    for (const change of diff_result.changes) {
      if (change.type === "added" || change.type === "modified") {
        environment_env_map[change.key] = change.new_value || "";
      } else if (change.type === "deleted") {
        delete environment_env_map[change.key];
      }
    }

    const write_res = await write_env(environment_env_map, env_file_name);

    if (write_res.isErr()) {
      render_error({ message: messages.commands.pull.write_failed, exit: true });
      return;
    }

    render_success({ message: messages.commands.pull.success });
  } else {
    render_diff(diff_result, "pull");
  }
});
