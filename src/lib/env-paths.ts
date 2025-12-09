import { err, ok, type Result } from "neverthrow";

/**
 * adapted from https://github.com/sindresorhus/env-paths/blob/main/index.js
 */

import os from "node:os";
import process from "node:process";
import { safe_path_join } from "./safe";

const homedir = os.homedir();
const { env } = process;

function windows(name: string): Result<{ state: string }, Error> {
  let localAppData: Result<string, Error>;

  if (env.LOCALAPPDATA) {
    localAppData = ok(env.LOCALAPPDATA);
  } else {
    localAppData = safe_path_join(homedir, "AppData", "Local");
  }

  if (localAppData.isErr()) {
    return err(localAppData.error);
  }

  const final_path = safe_path_join(localAppData.value, name, "State");

  if (final_path.isErr()) {
    return err(final_path.error);
  }

  return ok({
    state: final_path.value,
  });
}

function linux_and_mac(name: string): Result<{ state: string }, Error> {
  let xdg_state_home: Result<string, Error>;

  if (env.XDG_STATE_HOME) {
    xdg_state_home = ok(env.XDG_STATE_HOME);
  } else {
    xdg_state_home = safe_path_join(homedir, ".local", "state");
  }

  if (xdg_state_home.isErr()) {
    return err(xdg_state_home.error);
  }

  const final_path = safe_path_join(xdg_state_home.value, name);

  if (final_path.isErr()) {
    return err(final_path.error);
  }

  return ok({
    state: final_path.value,
  });
}

export function env_paths(name: string, { suffix }: { suffix?: string } = {}): Result<{ state: string }, Error> {
  if (typeof name !== "string") {
    return err(new TypeError(`Expected a string, got ${typeof name}`));
  }

  if (suffix) {
    name += `-${suffix}`;
  }

  if (process.platform === "win32") {
    return windows(name);
  }

  return linux_and_mac(name);
}
