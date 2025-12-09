import type { Item as OpItem } from "@1password/sdk";
import sdk, { type Client, type ItemField, ItemFieldType } from "@1password/sdk";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { toJSONSchema, type z } from "zod";
import { constants } from "@/constants";
import { env_map_op_schema } from "@/lib/env_schema";
import { CustomError } from "@/lib/error";
import type { Project, StorageClient } from "@/lib/types";
import { get_project_name } from "@/lib/utils";
import { uuid } from "@/lib/uuid";

type EnvMapOp = z.infer<typeof env_map_op_schema>;

export class OnePasswordStorageClient implements StorageClient {
  public source = "onepassword" as const;
  private client: Client;
  private env_map: EnvMapOp;

  constructor(client: Client, env_map: EnvMapOp) {
    this.env_map = env_map;
    this.client = client;
  }

  public static init(env_map: EnvMapOp): ResultAsync<sdk.Client, CustomError> {
    return ResultAsync.fromPromise(
      sdk.createClient({
        auth: env_map.OP_SERVICE_ACCOUNT_TOKEN,
        integrationName: "dotman",
        integrationVersion: "v0.0.1",
      }),
      (err) => {
        return new CustomError("Could not initialize 1Password sdk", { cause: err as Error });
      },
    );
  }

  public get_project(environment: string | undefined): ResultAsync<Project, CustomError> {
    return this.get_op_project(environment).map((project) => {
      return {
        id: project.id,
        title: project.title,
        secrets: project.fields.map((field) => ({ id: field.id, title: field.title, value: field.value })),
      } satisfies Project;
    });
  }

  public set_project(project: Project, environment: string | undefined): ResultAsync<Project, CustomError> {
    return this.get_op_project(environment)
      .andThen((op_project) => {
        const new_op_secrets: ItemField[] = project.secrets.map((secret) => {
          const op_field = op_project.fields.find((op_field) => secret.title === op_field.title);
          if (op_field) {
            // handles updates
            return {
              ...op_field,
              title: secret.title,
              value: secret.value,
            };
          } else {
            // handles create
            return {
              id: uuid(),
              title: secret.title,
              value: secret.value,
              fieldType: ItemFieldType.Concealed,
            } satisfies ItemField;
          }
        });

        op_project.fields = new_op_secrets;

        return ResultAsync.fromPromise(
          this.client.items.put(op_project),
          (err) => new CustomError("Could not update project", { cause: err as Error }),
        );
      })
      .map((op_project) => {
        return {
          id: op_project.id,
          title: op_project.title,
          secrets: op_project.fields.map((field) => ({
            id: field.id,
            title: field.title,
            value: field.value,
          })),
        } satisfies Project;
      });
  }

  public get_client_env_keys(): string[] {
    const properties = toJSONSchema(env_map_op_schema).properties;
    if (!properties) {
      return [];
    }
    return Object.keys(properties);
  }

  public create_project(environment: string): ResultAsync<Project, CustomError> {
    const project_name = get_project_name(this.env_map.DOTMAN_PROJECT_NAME, environment);

    return ResultAsync.fromPromise(
      this.client.vaults.list(),
      (err) => new CustomError("Could not list vaults", { cause: err as Error }),
    )
      .andThen((vaults) => {
        const found_vault = vaults.find((vault) => vault.title === this.env_map.OP_VAULT_NAME);
        return found_vault
          ? okAsync(found_vault)
          : errAsync(new CustomError(`Vault "${this.env_map.OP_VAULT_NAME}" not found`));
      })
      .andThen((vault) =>
        ResultAsync.fromPromise(
          this.client.items.list(vault.id),
          (err) => new CustomError("Could not list items", { cause: err as Error }),
        ).map((projects) => ({ vault, projects })),
      )
      .andThen(({ vault, projects }) => {
        const found_project = projects.find((i) => i.title === project_name);
        return found_project
          ? errAsync(
              new CustomError(
                `Project "${this.env_map.DOTMAN_PROJECT_NAME}" with environment "${environment}" already exists`,
              ),
            )
          : okAsync(vault);
      })
      .andThen((vault) =>
        ResultAsync.fromPromise(
          this.client.items.create({
            category: sdk.ItemCategory.SecureNote,
            title: project_name,
            vaultId: vault.id,
          }),
          (err) => new CustomError("Could not create project", { cause: err as Error }),
        ),
      )
      .map((op_project) => ({
        id: op_project.id,
        title: project_name,
        secrets: [],
      }));
  }

  private get_op_project(environment: string | undefined): ResultAsync<OpItem, CustomError> {
    const env_vault_name = this.env_map[constants.op_vault_name_env_key];
    const env_project_name = get_project_name(this.env_map[constants.dotman_project_name_env_key], environment);

    return ResultAsync.fromPromise(
      this.client.vaults.list(),
      (err) => new CustomError("Could not list vaults", { cause: err as Error }),
    )
      .map((vaults_overview) => {
        return vaults_overview.find((val) => val.title === env_vault_name);
      })
      .andThen((vault) => {
        if (!vault) {
          return errAsync(new CustomError(`Vault "${env_vault_name}" not found`));
        }
        return ResultAsync.fromPromise(
          this.client.items.list(vault.id),
          (err) => new CustomError("Could not list items", { cause: err as Error }),
        ).map((projects) => ({ vault, projects }));
      })
      .andThen(({ vault, projects }) => {
        const found_project = projects.find((i) => i.title === env_project_name);

        if (!found_project) {
          return ResultAsync.fromPromise(
            this.client.items.create({
              category: sdk.ItemCategory.SecureNote,
              title: env_project_name,
              vaultId: vault.id,
            }),
            (err) => new CustomError("Could not create project", { cause: err as Error }),
          );
        }

        return ResultAsync.fromPromise(
          this.client.items.get(found_project.vaultId, found_project.id),
          (err) => new CustomError("Could not get project", { cause: err as Error }),
        );
      });
  }
}
