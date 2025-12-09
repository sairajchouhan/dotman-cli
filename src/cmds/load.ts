import { spawn, type ChildProcess } from "node:child_process";
import { Command } from "commander";
import { render_error, render_info } from "@/components/errors";
import { read_env_files } from "@/lib/dotenv";
import { get_current_environment } from "@/lib/environment";
import { program } from "@/program";

type NodeSignal = "SIGINT" | "SIGTERM" | "SIGHUP";

export const load_cmd = new Command("load")
  .description("Load environment variables from .env files and run a command")
  .argument("<command...>", "The command to run")
  .action(async (command_args: string[]) => {
    // 1. Validate command arguments
    if (!command_args || command_args.length === 0 || command_args[0]?.trim() === "") {
      render_error({
        message: "No command provided to execute",
        suggestion: "Provide a command, e.g., dotman load -- npm run dev",
        exit: true,
      });
      return;
    }

    // 2. Resolve environment
    const global_opts = program.optsWithGlobals();
    let environment: string | undefined = global_opts.env as string | undefined;

    if (!environment) {
      const env_result = await get_current_environment();
      if (env_result.isErr()) {
        render_error({
          message: env_result.error.message,
          suggestion: env_result.error.suggestion,
          exit: true,
        });
        return;
      }
      environment = env_result.value;
    }

    // 3. Load environment files
    const env_files_res = await read_env_files(environment);

    if (env_files_res.isErr()) {
      render_error({
        message: env_files_res.error.message,
        suggestion: env_files_res.error.suggestion,
        exit: true,
      });
      return;
    }

    const { env_map, environment_env_map, env_file_name } = env_files_res.value;
    const [command, ...args] = command_args as [string, ...string[]];

    render_info({ message: `Loading environment from ${env_file_name}` });

    // 4. Merge environment variables (priority: process.env < env_map < environment_env_map)
    const merged_env = {
      ...process.env,
      ...env_map,
      ...environment_env_map,
    };

    // 5. Spawn child process
    const is_windows = process.platform === "win32";
    const child: ChildProcess = spawn(command, args, {
      stdio: "inherit",
      env: merged_env,
      shell: is_windows,
    });

    // 6. Signal forwarding
    const signals_to_forward: NodeSignal[] = ["SIGINT", "SIGTERM", "SIGHUP"];
    const signal_handlers: Map<NodeSignal, () => void> = new Map();

    for (const signal of signals_to_forward) {
      const handler = () => {
        if (child.pid) {
          // On Windows, SIGTERM/SIGHUP may not work, use SIGKILL as fallback
          if (is_windows && signal !== "SIGINT") {
            child.kill("SIGKILL");
          } else {
            child.kill(signal);
          }
        }
      };
      signal_handlers.set(signal, handler);
      process.on(signal, handler);
    }

    const cleanup_signal_handlers = () => {
      for (const [signal, handler] of signal_handlers) {
        process.removeListener(signal, handler);
      }
    };

    // 7. Exit code handling
    child.on("exit", (code, signal) => {
      cleanup_signal_handlers();

      if (code !== null) {
        process.exit(code);
      } else if (signal) {
        // Convert signal termination to exit code (128 + signal number)
        const signal_codes: Record<string, number> = {
          SIGHUP: 1,
          SIGINT: 2,
          SIGQUIT: 3,
          SIGTERM: 15,
        };
        const signal_num = signal_codes[signal] ?? 15;
        process.exit(128 + signal_num);
      }
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      cleanup_signal_handlers();

      if (err.code === "ENOENT") {
        render_error({
          message: `Command not found: "${command}"`,
          suggestion: "Check that the command is installed and in PATH",
          exit: true,
        });
      } else {
        render_error({
          message: `Failed to start command: ${err.message}`,
          suggestion: "Check that the command is correct and installed.",
          exit: true,
        });
      }
    });
  });
