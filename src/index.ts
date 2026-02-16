#!/usr/bin/env node
import "dotenv/config";
import { render_error } from "@/components/errors";
import { validate_environment_name } from "@/lib/environment";
import { messages } from "@/messages";
import { env_cmd } from "./cmds/env.ts";
import { init_cmd } from "./cmds/init.ts";
import { load_cmd } from "./cmds/load.ts";
import { providers_cmd } from "./cmds/providers.ts";
import { pull_cmd } from "./cmds/pull.ts";
import { push_cmd } from "./cmds/push.ts";
import { program } from "./program.ts";

import { VERSION } from "./version.ts";

program
  .name("dotman")
  .description(messages.program.description)
  .version(VERSION)
  .option("-e, --env <ENV>", messages.program.env_option)
  .option("-a, --apply", messages.program.apply_option, false)
  .hook("preAction", (_thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals();
    const env = opts.env;

    if (env) {
      const validation_result = validate_environment_name(env);
      if (validation_result.isErr()) {
        const error = validation_result.error;
        render_error({
          message: error.message,
          suggestion: error.suggestion,
          exit: true,
        });
      }
    }
  })
  .addCommand(init_cmd)
  .addCommand(pull_cmd)
  .addCommand(push_cmd)
  .addCommand(env_cmd)
  .addCommand(load_cmd)
  .addCommand(providers_cmd)
  .parse();
