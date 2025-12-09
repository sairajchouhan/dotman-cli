// import { spawn } from "node:child_process";
import { Command } from "commander";
// import { render_error } from "@/components/errors";
// import { read_env_files } from "@/lib/dotenv";

export const load_cmd = new Command("load")
  .description("Load environment variables from .env files and run a command")
  .argument("<command...>", "The command to run")
  .action(async (_command_args: string[], _options: Record<string, unknown>) => {
    // const global_opts = options.optsWithGlobals();
    // const environment = global_opts.env;
    //
    // const env_files_res = await read_env_files(environment);
    //
    // if (env_files_res.isErr()) {
    //   render_error({
    //     message: env_files_res.error.message,
    //     suggestion: env_files_res.error.suggestion,
    //     exit: true,
    //   });
    //   return;
    // }
    //
    // const { env_map, environment_env_map } = env_files_res.value;
    // const [command, ...args] = command_args;
    //
    // const child = spawn(command, args, {
    //   stdio: "inherit",
    //   env: {
    //     ...process.env,
    //     ...env_map,
    //     ...environment_env_map,
    //   },
    // });
    //
    // child.on("exit", (code) => {
    //   if (code !== null) {
    //     process.exit(code);
    //   }
    // });
    //
    // child.on("error", (err) => {
    //   render_error({
    //     message: `Failed to start command: ${err.message}`,
    //     suggestion: "Check that the command is correct and installed.",
    //     exit: true,
    //   });
    // });
  });
