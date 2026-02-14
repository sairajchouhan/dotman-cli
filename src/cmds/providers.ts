import { Command } from "commander";
import { render_info } from "@/components/errors";
import { PROVIDER_REGISTRY } from "@/storage/providers";

export const providers_cmd = new Command("providers").description("List supported storage providers").action(() => {
  const providers = Object.values(PROVIDER_REGISTRY);

  const formatted_list = providers.map((provider) => `  • ${provider.label}`).join("\n");

  const count_text = `${providers.length} ${providers.length === 1 ? "provider" : "providers"} supported`;

  render_info({
    message: `Supported Providers:\n\n${formatted_list}\n\n${count_text}`,
  });
});
