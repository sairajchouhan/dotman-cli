import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { fetch } from "undici";
import { toJSONSchema, z } from "zod";
import { CustomError } from "@/lib/error";
import type { Project, Secret, StorageClient } from "@/lib/types";

export const env_map_cs_launch_schema = z.looseObject({
  DOTMAN_PROJECT_NAME: z.string().min(1),
  CS_LAUNCH_AUTH_TOKEN: z.string().min(1),
  CS_LAUNCH_ORGANIZATION_UID: z.string().min(1),
  CS_LAUNCH_PROJECT_UID: z.string().min(1),
  CS_LAUNCH_API_URL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z
      .url()
      .refine((url) => url.startsWith("https://"), {
        message: "API URL must use HTTPS for security",
      })
      .default("https://launch-api.contentstack.com"),
  ),
});

type EnvMapCsLaunch = z.infer<typeof env_map_cs_launch_schema>;

type LaunchEnvironmentVariable = {
  key: string;
  value: string;
};

type LaunchEnvironment = {
  uid: string;
  name: string;
  environmentVariables?: LaunchEnvironmentVariable[];
};

export class ContentstackLaunchStorageClient implements StorageClient {
  public source = "cs_launch" as const;
  private env_map: EnvMapCsLaunch;

  constructor(env_map: EnvMapCsLaunch) {
    this.env_map = env_map;
  }

  public static init(env_map: EnvMapCsLaunch): ResultAsync<EnvMapCsLaunch, CustomError> {
    const url = `${env_map.CS_LAUNCH_API_URL}/projects/${env_map.CS_LAUNCH_PROJECT_UID}`;

    return ResultAsync.fromPromise(
      fetch(url, {
        method: "GET",
        headers: {
          authtoken: env_map.CS_LAUNCH_AUTH_TOKEN,
          organization_uid: env_map.CS_LAUNCH_ORGANIZATION_UID,
        },
      }),
      (err) => new CustomError("Could not connect to Contentstack Launch API", { cause: err as Error }),
    ).andThen((response) => {
      if (!response.ok) {
        return errAsync(
          new CustomError(`Could not validate Contentstack Launch project (HTTP ${response.status})`, {
            suggestion: "Check that your CS_LAUNCH_AUTH_TOKEN and CS_LAUNCH_PROJECT_UID are correct",
          }),
        );
      }
      return okAsync(env_map);
    });
  }

  public get_project(environment: string | undefined): ResultAsync<Project, CustomError> {
    return this.get_launch_environment(environment).map((launch_env) => {
      const secrets: Secret[] = (launch_env.environmentVariables ?? []).map((env_var) => ({
        id: env_var.key,
        title: env_var.key,
        value: env_var.value,
      }));

      return {
        id: launch_env.uid,
        title: launch_env.name,
        secrets,
      } satisfies Project;
    });
  }

  public set_project(project: Project, environment: string | undefined): ResultAsync<Project, CustomError> {
    return this.get_launch_environment(environment).andThen((launch_env) => {
      const environment_variables: LaunchEnvironmentVariable[] = project.secrets.map((secret) => ({
        key: secret.title,
        value: secret.value,
      }));

      return this.launch_fetch<{ environment: LaunchEnvironment }>(
        `/projects/${this.env_map.CS_LAUNCH_PROJECT_UID}/environments/${launch_env.uid}`,
        {
          method: "PUT",
          body: JSON.stringify({
            environmentVariables: environment_variables,
          }),
        },
      ).map((res) => {
        const updated_env = res.environment;
        return {
          id: updated_env.uid,
          title: updated_env.name,
          secrets: (updated_env.environmentVariables ?? []).map((env_var) => ({
            id: env_var.key,
            title: env_var.key,
            value: env_var.value,
          })),
        } satisfies Project;
      });
    });
  }

  public create_project(environment: string | undefined): ResultAsync<Project, CustomError> {
    const env_name = this.resolve_environment_name(environment);

    return this.launch_fetch<{ environments: LaunchEnvironment[] }>(
      `/projects/${this.env_map.CS_LAUNCH_PROJECT_UID}/environments`,
    ).andThen((res) => {
      const found = res.environments.find((env) => env.name === env_name);
      if (!found) {
        const available_names = res.environments.map((env) => env.name).join(", ");
        return errAsync(
          new CustomError(`Launch environment "${env_name}" not found in project`, {
            suggestion: `Create the "${env_name}" environment in your Launch project dashboard and re-run this command.\n\nAvailable environments: ${available_names || "none"}`,
          }),
        );
      }
      return okAsync({
        id: found.uid,
        title: found.name,
        secrets: [],
      } satisfies Project);
    });
  }

  public get_client_env_keys(): string[] {
    const properties = toJSONSchema(env_map_cs_launch_schema).properties;
    if (!properties) {
      return [];
    }
    return Object.keys(properties);
  }

  private launch_fetch<T>(path: string, options?: RequestInit): ResultAsync<T, CustomError> {
    const url = `${this.env_map.CS_LAUNCH_API_URL}${path}`;
    const _method = options?.method ?? "GET";

    return ResultAsync.fromPromise(
      fetch(url, {
        ...options,
        headers: {
          authtoken: this.env_map.CS_LAUNCH_AUTH_TOKEN,
          organization_uid: this.env_map.CS_LAUNCH_ORGANIZATION_UID,
          "Content-Type": "application/json",
          ...options?.headers,
        },
      }),
      (err) =>
        new CustomError("Contentstack Launch API request failed", {
          cause: err as Error,
        }),
    ).andThen((response) => {
      if (!response.ok) {
        return errAsync(new CustomError(`Contentstack Launch API error (HTTP ${response.status})`));
      }
      return ResultAsync.fromPromise(
        response.json() as Promise<T>,
        (err) => new CustomError("Could not parse Contentstack Launch API response", { cause: err as Error }),
      );
    });
  }

  private resolve_environment_name(environment: string | undefined): string {
    if (!environment || environment === "master") {
      return "Default";
    }
    return environment;
  }

  private get_launch_environment(environment: string | undefined): ResultAsync<LaunchEnvironment, CustomError> {
    const env_name = this.resolve_environment_name(environment);

    return this.launch_fetch<{ environments: LaunchEnvironment[] }>(
      `/projects/${this.env_map.CS_LAUNCH_PROJECT_UID}/environments`,
    )
      .andThen((res) => {
        const found = res.environments.find((env) => env.name === env_name);
        if (!found) {
          return errAsync(
            new CustomError(`Launch environment "${env_name}" not found`, {
              suggestion: `Available environments can be viewed in your Contentstack Launch project settings`,
            }),
          );
        }
        return okAsync(found);
      })
      .andThen((found) =>
        this.launch_fetch<{ environment: LaunchEnvironment }>(
          `/projects/${this.env_map.CS_LAUNCH_PROJECT_UID}/environments/${found.uid}`,
        ).map((res) => res.environment),
      );
  }
}
