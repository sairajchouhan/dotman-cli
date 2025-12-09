import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function create_temp_dir(prefix = "dotman-test-"): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function cleanup_temp_dir(temp_dir: string): Promise<void> {
  await fs.rm(temp_dir, { recursive: true, force: true });
}

export async function with_temp_dir<T>(fn: (temp_dir: string) => Promise<T>): Promise<T> {
  const temp_dir = await create_temp_dir();
  const original_cwd = process.cwd();

  try {
    process.chdir(temp_dir);
    return await fn(temp_dir);
  } finally {
    process.chdir(original_cwd);
    await cleanup_temp_dir(temp_dir);
  }
}

export async function create_file(dir: string, filename: string, content: string): Promise<string> {
  const file_path = path.join(dir, filename);
  await fs.writeFile(file_path, content);
  return file_path;
}

export async function read_file(file_path: string): Promise<string> {
  return fs.readFile(file_path, "utf-8");
}

export async function file_exists(file_path: string): Promise<boolean> {
  try {
    await fs.access(file_path);
    return true;
  } catch {
    return false;
  }
}

export async function create_env_file(dir: string, content: Record<string, string>, suffix = ""): Promise<string> {
  const filename = suffix ? `.env.${suffix}` : ".env";
  const env_content = Object.entries(content)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  return create_file(dir, filename, env_content);
}
