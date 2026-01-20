// TODO: don't try to cover every single case of Initializing, instead just tell what all env vars are missing
import op_sdk, { type Client, ItemCategory, type VaultOverview } from "@1password/sdk";
import type { DotenvParseOutput } from "dotenv";
import { Box, Text, useApp } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import { ResultAsync } from "neverthrow";
import { useEffect, useState } from "react";
import { render_error, render_success } from "@/components/errors";
import { constants } from "@/constants";
import { write_env } from "@/lib/dotenv";
import type { SelectItem } from "@/lib/types";

type InitCmdCompProps = {
  env_map: DotenvParseOutput;
  env_file_name: string;
  env_project_name: string | undefined;
  env_vault_name: string | undefined;
};

export const InitCmdComp = ({ env_map, env_file_name, env_vault_name, env_project_name }: InitCmdCompProps) => {
  const [project_name, set_project_name] = useState<string>("");
  const [to_show, set_to_show] = useState(() => {
    if (!env_project_name) return "project_name" as const;
    if (!env_vault_name) return "vault_name" as const;
  });
  const cli_app = useApp();
  const [op_client, set_op_client] = useState<Client | null>(null);

  const [select_item, set_select_item] = useState<SelectItem<VaultOverview> | null>(null);
  const [select_list, set_select_list] = useState<SelectItem<VaultOverview>[]>([]);
  const [loading, set_loading] = useState(false);

  useEffect(() => {
    // biome-ignore lint/nursery/noFloatingPromises: <have to do this for using await in useEffect>
    (async () => {
      set_loading(true);
      const op_service_account_token = env_map[constants.op_service_account_token];
      if (!op_service_account_token) return;
      const op_cliet_res = await init_op_client(op_service_account_token);
      if (op_cliet_res.isErr()) {
        set_loading(false);
        return;
      }
      set_loading(false);
      set_op_client(op_cliet_res.value);
    })();
  }, [env_map[constants.op_service_account_token]]);

  useEffect(() => {
    // biome-ignore lint/nursery/noFloatingPromises: <have to do this for using await in useEffect>
    (async () => {
      if (!op_client) return;
      // TODO: handle fail case
      const vaults = await op_client.vaults.list();
      set_select_list(
        vaults.map((vault) => ({
          label: vault.title,
          value: vault,
        })),
      );
    })();
  }, [op_client]);

  const op_service_account_token = process.env[constants.op_service_account_token];
  if (!op_service_account_token) {
    return (
      <Text color="red">
        {constants.op_service_account_token} environment variable not found {env_file_name}
      </Text>
    );
  }

  function handle_submit(value: string) {
    set_project_name(value);
    set_to_show("vault_name");
  }

  const handleSelect = async (item: SelectItem<VaultOverview>) => {
    if (loading) return;
    set_select_item(item);
    const write_res = await write_env(
      {
        ...env_map,
        [constants.dotman_project_name_env_key]: project_name,
        [constants.op_vault_name_env_key]: item.value.title,
      },
      env_file_name,
    );

    if (write_res.isErr()) {
      render_error({ error: write_res.error });
      cli_app.exit();
      return;
    }

    if (op_client) {
      await op_client.items.create({
        category: ItemCategory.SecureNote,
        title: project_name,
        vaultId: item.value.id,
      });
      render_success({ message: `Project ${project_name} created successfully` });
      cli_app.exit();
      return;
    }
  };

  return (
    <>
      {!env_project_name ? (
        <Box>
          <Box marginRight={1}>
            <Text>Enter Project Name:</Text>
          </Box>

          <TextInput
            onSubmit={handle_submit}
            showCursor={to_show === "project_name"}
            focus={to_show === "project_name"}
            value={project_name}
            onChange={set_project_name}
          />
        </Box>
      ) : null}

      {!env_vault_name &&
      ((project_name && to_show === "vault_name") || (env_project_name && to_show === "vault_name")) ? (
        <Box display="flex" flexDirection="column">
          <Text>Select Vault</Text>
          <Box>
            <SelectInput items={select_list} onSelect={handleSelect} />
          </Box>
        </Box>
      ) : null}

      {select_item ? (
        <Box>
          <Text>Selected Vault {select_item.label}</Text>
        </Box>
      ) : null}
    </>
  );
};

function init_op_client(op_service_account_token: string) {
  const client = ResultAsync.fromPromise(
    op_sdk.createClient({
      auth: op_service_account_token,
      integrationName: "dotman",
      integrationVersion: "v0.0.1",
    }),
    (err) => err,
  );

  return client;
}
