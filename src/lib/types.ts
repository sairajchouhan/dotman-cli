import type { ResultAsync } from "neverthrow";
import type { CustomError } from "./error";

export type SelectItem<T = string> = {
  label: string;
  value: T;
};

export type EnvMap = Record<string, string>;

export type Secret = {
  id: string;
  title: string;
  value: string;
};

export interface Project {
  id: string;
  title: string;
  secrets: Array<Secret>;
}

export type FieldMetadata = {
  description: string;
  hint?: string;
  doc_url?: string;
};

export interface StorageClient {
  source: string;
  get_project(environment: string | undefined): ResultAsync<Project, CustomError>;
  set_project(project: Project, environment: string | undefined): ResultAsync<Project, CustomError>;
  create_project(environment: string | undefined): ResultAsync<Project, CustomError>;
  get_client_env_keys(): string[];
}
