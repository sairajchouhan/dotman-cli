import sdk from "@bitwarden/sdk-napi";
import { okAsync, ResultAsync } from "neverthrow";
import { toJSONSchema, z } from "zod";
import { CustomError } from "@/lib/error";
import type { Project, StorageClient } from "@/lib/types";
import { get_project_name } from "@/lib/utils";

export const env_map_bw_schema = z.looseObject({
  DOTMAN_PROJECT_NAME: z.string().min(1),
  BWS_API_URL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z
      .string()
      .url()
      .refine((url) => url.startsWith("https://"), {
        message: "API URL must use HTTPS for security",
      })
      .default("https://api.bitwarden.com"),
  ),
  BWS_IDENTITY_URL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z
      .string()
      .url()
      .refine((url) => url.startsWith("https://"), {
        message: "Identity URL must use HTTPS for security",
      })
      .default("https://identity.bitwarden.com"),
  ),
  BWS_ORGANIZATION_ID: z.string().min(1),
  BWS_ACCESS_TOKEN: z.string().min(1),
});

export type EnvMapBw = z.infer<typeof env_map_bw_schema>;

export class BitwardenStorageClient implements StorageClient {
  public source = "bitwarden" as const;
  private client: sdk.BitwardenClient;
  private env_map: EnvMapBw;

  constructor(client: sdk.BitwardenClient, env_map: EnvMapBw) {
    this.env_map = env_map;
    this.client = client;
  }

  public static init(env_map: EnvMapBw): ResultAsync<sdk.BitwardenClient, CustomError> {
    const client = new sdk.BitwardenClient({ apiUrl: env_map.BWS_API_URL, identityUrl: env_map.BWS_IDENTITY_URL });

    return ResultAsync.fromPromise(
      client.auth().loginAccessToken(env_map.BWS_ACCESS_TOKEN),
      (err) =>
        new CustomError("Could not initialize Bitwarden sdk", {
          cause: err as Error,
        }),
    ).map(() => client);
  }

  public get_project(environment: string | undefined): ResultAsync<Project, CustomError> {
    const projects_res = this.get_bw_project(environment);
    const secrets_res = this.get_bw_project_secrets(environment);

    return ResultAsync.combine([projects_res, secrets_res]).map(([project, secrets]) => {
      return {
        id: project.id,
        title: project.name,
        secrets: secrets.data.map((sec) => ({ id: sec.id, title: sec.key, value: sec.value })),
      } satisfies Project;
    });
  }

  public set_project(project: Project, environment: string | undefined): ResultAsync<Project, CustomError> {
    return this.get_bw_project_secrets(environment)
      .andThen((secrets) => {
        const new_secret_responses = project.secrets.map((secret) => {
          const bw_secret: sdk.SecretResponse | undefined = secrets.data.find(
            (bw_secret) => secret.title === bw_secret.key,
          );
          if (bw_secret) {
            return ResultAsync.fromPromise(
              this.client
                .secrets()
                .update(this.env_map.BWS_ORGANIZATION_ID, bw_secret.id, bw_secret.key, secret.value, "", [project.id]),
              (err) => new CustomError("Could not update secrets", { cause: err as Error }),
            );
          } else {
            // handles create
            return ResultAsync.fromPromise(
              this.client
                .secrets()
                .create(this.env_map.BWS_ORGANIZATION_ID, secret.title, secret.value, "", [project.id]),
              (err) => {
                return new CustomError("Could not create a secret", { cause: err as Error });
              },
            );
          }
        });
        return ResultAsync.combine(new_secret_responses);
      })
      .map((updatd_secrets) => {
        return {
          id: project.id,
          title: project.title,
          secrets: updatd_secrets.map((sec) => ({ id: sec.id, title: sec.key, value: sec.value })),
        } satisfies Project;
      });
  }

  public get_client_env_keys(): string[] {
    const properties = toJSONSchema(env_map_bw_schema).properties;
    if (!properties) {
      return [];
    }
    return Object.keys(properties);
  }

  public create_project(environment: string | undefined): ResultAsync<Project, CustomError> {
    const project_name = get_project_name(this.env_map.DOTMAN_PROJECT_NAME, environment);

    return this.get_bw_project(environment)
      .mapErr((err) => {
        // Enhance error message with suggestions if it's a creation failure
        if (err.message.includes("Could not create project")) {
          return new CustomError(`Could not create project "${project_name}"`, {
            cause: err.cause as Error,
            suggestion: `Possible causes:
- Machine account doesn't have "Can read, write" permission on projects
- Organization has reached project limit (3 for Free tier)
- Access token is invalid or expired
- Organization ID is incorrect`,
          });
        }
        return err;
      })
      .map((project) => {
        return {
          id: project.id,
          title: project.name,
          secrets: [],
        } satisfies Project;
      });
  }

  private get_bw_project(environment: string | undefined): ResultAsync<sdk.ProjectResponse, CustomError> {
    const project_name = get_project_name(this.env_map.DOTMAN_PROJECT_NAME, environment);

    return ResultAsync.fromPromise(
      this.client.projects().list(this.env_map.BWS_ORGANIZATION_ID),
      (err) => new CustomError("Could not list projects", { cause: err as Error }),
    ).andThen((all_projects) => {
      const found_project = all_projects.data.find((pro) => pro.name === project_name);
      if (!found_project) {
        return ResultAsync.fromPromise(
          this.client.projects().create(this.env_map.BWS_ORGANIZATION_ID, project_name),
          (err) => new CustomError("Could not create project", { cause: err as Error }),
        );
      }
      return okAsync(found_project);
    });
  }

  private get_bw_project_secrets(environment: string | undefined): ResultAsync<sdk.SecretsResponse, CustomError> {
    return this.get_bw_project(environment).andThen((project) => {
      return ResultAsync.fromPromise(
        this.client.secrets().list(this.env_map.BWS_ORGANIZATION_ID),
        (err) => new CustomError("Could not list secrets", { cause: err as Error }),
      ).andThen((secret_identifiers) => {
        const secret_ids = secret_identifiers.data.map((it) => it.id);

        if (secret_ids.length === 0) {
          return ResultAsync.fromSafePromise(Promise.resolve({ data: [] }));
        }

        return ResultAsync.fromPromise(
          this.client.secrets().getByIds(secret_ids),
          (err) => new CustomError("Could not access secrets", { cause: err as Error }),
        ).map((secrets) => {
          const filtered_secrets = secrets.data.filter((secret) => secret.projectId === project.id);
          return { data: filtered_secrets } satisfies sdk.SecretsResponse;
        });
      });
    });
  }
}
