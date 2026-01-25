import * as prompts from "@clack/prompts";
import { Command } from "commander";
import { errAsync, ResultAsync } from "neverthrow";
import { render_error, render_success } from "@/components/errors";
import { read_env, write_env } from "@/lib/dotenv";
import { get_current_environment, save_current_env } from "@/lib/environment";
import { CustomError } from "@/lib/error";
import { PROVIDER_REGISTRY } from "@/storage/providers";

export const init_cmd = new Command("init")
  .description("Initialize project to store environment variables")
  .action(async () => {
    const cancel = () => prompts.cancel("Operation cancelled");
    let is_dotenv_empty = false;
    const dotenv_res = await read_env(".env").orElse((err) => {
      if (err.cause && (err.cause as NodeJS.ErrnoException).code === "ENOENT") {
        is_dotenv_empty = true;
        return ResultAsync.fromSafePromise(Promise.resolve({}));
      }
      return errAsync(new CustomError(`Failed to read .env file`, { cause: err }));
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
        message: `Your .env file already has values. Please choose how to proceed:`,
        options: [
          {
            label: "Cancel without changes",
            value: "cancel",
          },
          {
            label: "Overwrite .env with new values",
            value: "overwrite",
          },
          {
            label: "Keep existing .env values and continue",
            hint: "WARNING: All comments in .env will be removed",
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
      message: `Select storage provider:`,
      options: Object.values(PROVIDER_REGISTRY).map((provider) => ({
        label: provider.label,
        value: provider.key,
      })),
    });

    if (prompts.isCancel(provider)) return cancel();

    if (!(provider in PROVIDER_REGISTRY)) {
      render_error({
        message: "Invalid provider selected",
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
          let message = metadata?.description ?? `Enter value for ${key}:`;

          if (metadata?.hint) {
            message += `\n${metadata.hint}`;
          }
          if (metadata?.doc_url) {
            message += `\nDocs: ${metadata.doc_url}`;
          }

          const prompt_fn = metadata?.is_secret ? prompts.password : prompts.text;

          return [
            key,
            () =>
              prompt_fn({
                message,
                validate(value) {
                  // Allow empty values for optional fields
                  if (metadata?.isOptional && value === "") {
                    return undefined;
                  }
                  const result = PROVIDER_REGISTRY[provider].env_map_schema.partial().safeParse({ [key]: value });
                  if (result.success) return undefined;
                  const field_error = result.error.issues.find((issue) => issue.path[0] === key);
                  return field_error?.message ?? result.error.issues[0]?.message ?? "Invalid value";
                },
              }),
          ];
        }),
      ),
      {
        onCancel: () => cancel(),
      },
    );

    const final_env_map = action === "overwrite" ? env_map : { ...dotenv_res.value, ...env_map };

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
      // Warn but don't fail, as this is just state preference
      console.warn("Could not save current environment state:", save_env_res.error.message);
    }

    render_success({
      message: `Successfully initialized project "${project_name}" with ${PROVIDER_REGISTRY[provider].label}`,
    });
  });
