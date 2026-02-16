import { Command } from "commander";
import { render_info } from "@/components/errors";
import { messages } from "@/messages";
import { PROVIDER_REGISTRY } from "@/storage/providers";

export const providers_cmd = new Command("providers")
  .description(messages.commands.providers.description)
  .action(() => {
    const providers = Object.values(PROVIDER_REGISTRY);

    const formatted_list = providers.map((provider) => `  \u2022 ${provider.label}`).join("\n");

    const count_text = messages.commands.providers.count(providers.length);

    render_info({
      message: `${messages.commands.providers.header}\n\n${formatted_list}\n\n${count_text}`,
    });
  });
