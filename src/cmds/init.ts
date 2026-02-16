import * as prompts from "@clack/prompts";
import { Command } from "commander";
import { errAsync, ResultAsync } from "neverthrow";
import { render_error, render_success, render_warning } from "@/components/errors";
import { read_env, write_env } from "@/lib/dotenv";
import { save_current_env } from "@/lib/environment";
import { CustomError } from "@/lib/error";
import { messages } from "@/messages";
import { PROVIDER_REGISTRY } from "@/storage/providers";

export const init_cmd = new Command("init").description(messages.commands.init.description).action(async () => {
  const cancel = () => prompts.cancel(messages.commands.init.operation_cancelled);
  let is_dotenv_empty = false;
  const dotenv_res = await read_env(".env").orElse((err) => {
    if (err.cause && (err.cause as NodeJS.ErrnoException).code === "ENOENT") {
      is_dotenv_empty = true;
      return ResultAsync.fromSafePromise(Promise.resolve({}));
    }
    return errAsync(new CustomError(messages.commands.init.read_env_failed, { cause: err }));
  });

  if (dotenv_res.isErr()) {
    const error = dotenv_res.error;
    render_error({
      message: error.message,
      suggestion: error.suggestion,
      exit: true,
    });
    return;
  }

  let action: "overwrite" | "ignore";
  const has_existing_values = !is_dotenv_empty && Object.keys(dotenv_res.value).length > 0;
  if (has_existing_values) {
    const res = await prompts.select({
      message: messages.commands.init.existing_values_prompt,
      options: [
        {
          label: messages.commands.init.cancel_option,
          value: "cancel",
        },
        {
          label: messages.commands.init.overwrite_option,
          value: "overwrite",
        },
        {
          label: messages.commands.init.keep_option,
          hint: messages.commands.init.keep_hint,
          value: "ignore",
        },
      ],
    });
    if (prompts.isCancel(res) || res === "cancel") {
      return cancel();
    }
    action = res;
  } else {
    action = "overwrite";
  }

  const provider = await prompts.select({
    message: messages.commands.init.provider_prompt,
    options: Object.values(PROVIDER_REGISTRY).map((provider) => ({
      label: provider.label,
      value: provider.key,
    })),
  });

  if (prompts.isCancel(provider)) return cancel();

  if (!(provider in PROVIDER_REGISTRY)) {
    render_error({
      message: messages.commands.init.invalid_provider,
      exit: true,
    });
    return;
  }

  const env_map_keys = PROVIDER_REGISTRY[provider].get_env_map_keys();
  const field_metadata = PROVIDER_REGISTRY[provider].get_field_metadata();

  const env_map = await prompts.group(
    Object.fromEntries(
      env_map_keys.map((key) => {
        const metadata = field_metadata[key];
        let message = metadata?.description ?? messages.commands.init.field_value_fallback(key);

        if (metadata?.doc_url) {
          // We append docs but try to keep it cleaner
          message += ` (Docs: ${metadata.doc_url})`;
        }

        const prompt_fn = metadata?.is_secret ? prompts.password : prompts.text;

        // biome-ignore lint/suspicious/noExplicitAny: library types are complex to match perfectly here
        const prompt_options: any = {
          message,
          validate(value: string) {
            // Allow empty values for optional fields
            if (metadata?.is_optional && value === "") {
              return undefined;
            }
            const result = PROVIDER_REGISTRY[provider].env_map_schema.partial().safeParse({ [key]: value });
            if (result.success) return undefined;
            const field_error = result.error.issues.find((issue) => issue.path[0] === key);
            return (
              field_error?.message ?? result.error.issues[0]?.message ?? messages.commands.init.validation_fallback
            );
          },
        };

        if (metadata?.hint) {
          prompt_options.placeholder = metadata.hint;
        }

        if (!metadata?.is_secret && metadata?.default_value) {
          prompt_options.initialValue = metadata.default_value;
        }

        return [key, () => prompt_fn(prompt_options)];
      }),
    ),
    {
      onCancel: () => cancel(),
    },
  );

  const parse_res = PROVIDER_REGISTRY[provider].env_map_schema.safeParse(env_map);
  if (!parse_res.success) {
    render_error({
      message: messages.commands.init.invalid_configuration,
      suggestion: parse_res.error.issues.map((i) => i.message).join("\n"),
      exit: true,
    });
    return;
  }
  const parsed_env_map = parse_res.data as Record<string, string>;

  const final_env_map = action === "overwrite" ? parsed_env_map : { ...dotenv_res.value, ...parsed_env_map };

  const write_env_res = await write_env(final_env_map, ".env");
  if (write_env_res.isErr()) {
    const error = write_env_res.error;
    render_error({
      message: error.message,
      suggestion: error.suggestion,
      exit: true,
    });
    return;
  }

  const storage_client_res = await PROVIDER_REGISTRY[provider].create(final_env_map);
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
  const project_name = final_env_map.DOTMAN_PROJECT_NAME as string;
  // We default to "master" environment for the initial .env file
  const create_project_res = await storage_client.create_project("master");
  if (create_project_res.isErr()) {
    const error = create_project_res.error;
    render_error({
      message: error.message,
      suggestion: error.suggestion,
      exit: true,
    });
    return;
  }

  // Explicitly save the current environment as "master"
  const save_env_res = await save_current_env("master");
  if (save_env_res.isErr()) {
    render_warning({ message: messages.commands.init.save_env_state_failed(save_env_res.error.message) });
  }

  render_success({
    message: messages.commands.init.success(project_name, PROVIDER_REGISTRY[provider].label),
  });
});
