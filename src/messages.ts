import { project_environment_separator } from "@/constants";

export const messages = {
  program: {
    description: "Manage environment variables with password managers",
    env_option: "Environment name (e.g., dev, stag, prod)",
    apply_option: "Apply changes to the source",
  },

  commands: {
    push: {
      description: "Push local environment variables to remote",
      no_env_vars: (file: string) => `No environment variables found in "${file}"`,
      no_env_vars_suggestion: "Add some KEY=VALUE pairs to your .env file before pushing",
      no_custom_env_vars: (file: string) => `No custom environment variables found in "${file}"`,
      no_custom_env_vars_suggestion:
        "Add some KEY=VALUE pairs apart from client environment vars to your .env file before pushing",
      validation_failed_suggestion: (file: string) => `Fix the issues in "${file}" before pushing`,
      up_to_date: "Everything up to date",
      success: "Pushed latest changes to remote",
    },

    pull: {
      description: "Pull environment variables from remote to local files",
      client_keys_warning: (keys: string[]) =>
        `Client environment variables ${keys.join(", ")} found in source\nremove it from the source`,
      no_secrets: (title: string) => `No secrets found in Project "${title}"`,
      up_to_date: "Everything up to date",
      write_failed: "Could not update env file",
      success: "Synced with remote",
    },

    env: {
      description: "List available environments or manage environment configurations",
      new: {
        description: "Create a new environment file based on the default .env file",
        master_reserved: 'Cannot create environment named "master"',
        master_reserved_suggestion:
          'The name "master" is reserved for the base .env file. Use a different name (e.g., main, primary, base)',
        no_env_vars: (file: string) => `No environment variables found in "${file}"`,
        no_env_vars_suggestion: "Add some KEY=VALUE pairs to your .env file before creating a new environment",
        success: (env: string) =>
          `Created new environment "${env}"\n\nRun "dotman env use ${env}" to switch to this environment`,
      },
      use: {
        description: "Set the current environment to use for operations",
        not_found: (env: string) => `Environment "${env}" not found`,
        not_found_suggestion: 'List all environments by running "dotman env list"',
        already_using: (env: string) => `Already using environment "${env}"`,
        success: (env: string) => `Changed the current environment to "${env}"`,
      },
      list: {
        description: "List all environments",
        no_environments: "No environments found",
        no_environments_suggestion: 'Create a new environment with "dotman env new <name>" or add a .env file',
        header: "Available Environments:",
        current_icon: "\u2605",
        other_icon: "\u2022",
        base_env_indicator: " (.env)",
        current_indicator: " (current)",
        count: (n: number) => `${n} ${n === 1 ? "environment" : "environments"} found`,
      },
    },

    init: {
      description: "Initialize project to store environment variables",
      operation_cancelled: "Operation cancelled",
      existing_values_prompt: "Your .env file already has values. Please choose how to proceed:",
      cancel_option: "Cancel without changes",
      overwrite_option: "Overwrite .env with new values",
      keep_option: "Keep existing .env values and continue",
      keep_hint: "WARNING: All comments in .env will be removed",
      provider_prompt: "Select storage provider:",
      invalid_provider: "Invalid provider selected",
      invalid_configuration: "Invalid configuration",
      read_env_failed: "Failed to read .env file",
      field_value_fallback: (key: string) => `Enter value for ${key}:`,
      validation_fallback: "Invalid value",
      save_env_state_failed: (error_message: string) =>
        `Could not save current environment state: ${error_message}`,
      success: (project_name: string, provider_label: string) =>
        `Successfully initialized project "${project_name}" with ${provider_label}`,
    },

    load: {
      description: "Load environment variables from .env files and run a command",
      no_command: "No command provided to execute",
      no_command_suggestion: "Provide a command, e.g., dotman load -- npm run dev",
      loading_env: (file: string) => `Loading environment from ${file}`,
      command_not_found: (command: string) => `Command not found: "${command}"`,
      command_not_found_suggestion: "Check that the command is installed and in PATH",
      start_failed: (error_message: string) => `Failed to start command: ${error_message}`,
      start_failed_suggestion: "Check that the command is correct and installed.",
    },

    providers: {
      description: "List supported storage providers",
      header: "Supported Providers:",
      count: (n: number) => `${n} ${n === 1 ? "provider" : "providers"} supported`,
    },
  },

  diff: {
    up_to_date: "Everything up to date",
    push_header: "Changes to be pushed:",
    pull_header: "Changes to be pulled:",
    push_tip: "\uD83D\uDCA1 Use --apply to push these changes to remote",
    pull_tip: "\uD83D\uDCA1 Use --apply to pull these changes to your env file",
    added_label: "(added)",
    deleted_label: "(deleted)",
    summary: (total: number, added: number, modified: number, deleted: number) =>
      `${total} changes total (${added} added, ${modified} modified, ${deleted} deleted)`,
  },

  environment: {
    not_valid_project: "Not a valid dotman project directory",
    not_valid_project_suggestion:
      "Ensure you are in a directory with a .env file, or run 'dotman init' to initialize a new project",
    name_empty: "Environment name cannot be empty",
    name_empty_suggestion: "Provide a valid environment name (e.g., dev, staging, prod)",
    name_contains_separator: `Environment name cannot contain the separator "${project_environment_separator}"`,
    name_contains_separator_suggestion: `Remove "${project_environment_separator}" from the environment name`,
    name_invalid_chars: (chars: string) => `Environment name contains invalid characters: ${chars}`,
    name_invalid_chars_suggestion: "Use only alphanumeric characters, hyphens, and underscores",
    name_path_traversal: 'Environment name cannot contain ".."',
    name_path_traversal_suggestion: "Remove path traversal patterns from the environment name",
    name_master_reserved: "Environment name 'master' is reserved",
    failed_to_get_all: "Failed to get all environments",
    failed_to_read_state: "Failed to read environment state file",
  },

  dotenv: {
    path_outside_cwd: (operation: "read" | "write") => `Cannot ${operation} files outside of current working directory`,
    check_file_status_failed: "Could not check file status",
    symlink_not_permitted: (file: string) => `Symlinks are not permitted for security reasons: "${file}"`,
    symlink_suggestion: "Use a regular file instead of a symlink",
    stringify_failed: "Could not process to a string",
    write_failed: (file: string) => `Could not update "${file}" file`,
    file_not_found: (file: string) => `Environment file "${file}" not found`,
    file_not_found_suggestion: (file: string) =>
      `Create the file "${file}" in your current directory (${process.cwd()}) or specify a different environment with --env`,
    read_failed: (file: string, error_message: string) => `Failed to read "${file}": ${error_message}`,
    read_failed_suggestion: "Check that the file exists and is accessible",
    parse_failed: (file: string) => `Failed to parse environment file "${file}"`,
    parse_failed_suggestion: "Check that your .env file contains valid KEY=VALUE pairs and fix any syntax errors",
  },

  storage: {
    multiple_providers:
      "More than one source environment variables are available, filter environment variables to only include one client",
    no_provider: "No environment variables found that match any provider",
    init_failed: "Storage provider initialization failed",
    init_failed_suggestion: "This is an internal error. Please try again or raise an issue on the github repo",
  },

  utils: {
    state_path_error: "Could not get path for storing current environment",
    no_change: "(no change)",
    length_change: (old_length: number, new_length: number) => `(length: ${old_length} \u2192 ${new_length})`,
    modified: "(modified)",
  },
} as const;
