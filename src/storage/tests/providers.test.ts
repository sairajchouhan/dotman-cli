import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROVIDER_REGISTRY } from "@/storage/providers";

// No mocks needed - these tests only check synchronous properties and functions
// (is_available, get_env_map_keys, get_field_metadata, key, label, env_map_schema)
// The SDK is only initialized when create() is called, which these tests don't do.

describe("PROVIDER_REGISTRY", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("onepassword", () => {
    describe("is_available", () => {
      it("returns true when OP_SERVICE_ACCOUNT_TOKEN is present", () => {
        const env_map = { OP_SERVICE_ACCOUNT_TOKEN: "test-token" };

        const result = PROVIDER_REGISTRY.onepassword.is_available(env_map);

        expect(result).toBe(true);
      });

      it("returns false when OP_SERVICE_ACCOUNT_TOKEN is missing", () => {
        const env_map = { OTHER_KEY: "value" };

        const result = PROVIDER_REGISTRY.onepassword.is_available(env_map);

        expect(result).toBe(false);
      });

      it("returns false for empty string token", () => {
        const env_map = { OP_SERVICE_ACCOUNT_TOKEN: "" };

        const result = PROVIDER_REGISTRY.onepassword.is_available(env_map);

        expect(result).toBe(false);
      });
    });

    describe("get_env_map_keys", () => {
      it("returns required environment variable keys", () => {
        const keys = PROVIDER_REGISTRY.onepassword.get_env_map_keys();

        expect(keys).toContain("OP_SERVICE_ACCOUNT_TOKEN");
        expect(keys).toContain("OP_VAULT_NAME");
        expect(keys).toContain("DOTMAN_PROJECT_NAME");
      });
    });

    describe("get_field_metadata", () => {
      it("returns metadata for all fields", () => {
        const metadata = PROVIDER_REGISTRY.onepassword.get_field_metadata();

        expect(metadata.DOTMAN_PROJECT_NAME).toBeDefined();
        expect(metadata.DOTMAN_PROJECT_NAME?.description).toBeDefined();
        expect(metadata.OP_VAULT_NAME).toBeDefined();
        expect(metadata.OP_SERVICE_ACCOUNT_TOKEN).toBeDefined();
        expect(metadata.OP_SERVICE_ACCOUNT_TOKEN?.doc_url).toBeDefined();
      });
    });
  });

  describe("bitwarden", () => {
    describe("is_available", () => {
      it("returns true when BWS_ACCESS_TOKEN is present", () => {
        const env_map = { BWS_ACCESS_TOKEN: "test-token" };

        const result = PROVIDER_REGISTRY.bitwarden.is_available(env_map);

        expect(result).toBe(true);
      });

      it("returns false when BWS_ACCESS_TOKEN is missing", () => {
        const env_map = { OTHER_KEY: "value" };

        const result = PROVIDER_REGISTRY.bitwarden.is_available(env_map);

        expect(result).toBe(false);
      });

      it("returns false for empty string token", () => {
        const env_map = { BWS_ACCESS_TOKEN: "" };

        const result = PROVIDER_REGISTRY.bitwarden.is_available(env_map);

        expect(result).toBe(false);
      });
    });

    describe("get_env_map_keys", () => {
      it.skip("returns required environment variable keys", () => {
        const keys = PROVIDER_REGISTRY.bitwarden.get_env_map_keys();

        expect(keys).toContain("BWS_ACCESS_TOKEN");
        expect(keys).toContain("BWS_ORGANIZATION_ID");
        expect(keys).toContain("BWS_API_URL");
        expect(keys).toContain("BWS_IDENTITY_URL");
        expect(keys).toContain("DOTMAN_PROJECT_NAME");
      });
    });

    describe("get_field_metadata", () => {
      it("returns metadata for all fields", () => {
        const metadata = PROVIDER_REGISTRY.bitwarden.get_field_metadata();

        expect(metadata.DOTMAN_PROJECT_NAME).toBeDefined();
        expect(metadata.BWS_ACCESS_TOKEN).toBeDefined();
        expect(metadata.BWS_ACCESS_TOKEN?.doc_url).toBeDefined();
        expect(metadata.BWS_ORGANIZATION_ID).toBeDefined();
        expect(metadata.BWS_API_URL).toBeDefined();
        expect(metadata.BWS_IDENTITY_URL).toBeDefined();
      });
    });
  });

  describe("cs_launch", () => {
    describe("is_available", () => {
      it("returns true when CS_LAUNCH_AUTH_TOKEN is present", () => {
        const env_map = { CS_LAUNCH_AUTH_TOKEN: "test-token" };

        const result = PROVIDER_REGISTRY.cs_launch.is_available(env_map);

        expect(result).toBe(true);
      });

      it("returns false when CS_LAUNCH_AUTH_TOKEN is missing", () => {
        const env_map = { OTHER_KEY: "value" };

        const result = PROVIDER_REGISTRY.cs_launch.is_available(env_map);

        expect(result).toBe(false);
      });

      it("returns false for empty string token", () => {
        const env_map = { CS_LAUNCH_AUTH_TOKEN: "" };

        const result = PROVIDER_REGISTRY.cs_launch.is_available(env_map);

        expect(result).toBe(false);
      });
    });

    describe("get_env_map_keys", () => {
      it("returns required environment variable keys", () => {
        const keys = PROVIDER_REGISTRY.cs_launch.get_env_map_keys();

        expect(keys).toContain("CS_LAUNCH_AUTH_TOKEN");
        expect(keys).toContain("CS_LAUNCH_ORGANIZATION_UID");
        expect(keys).toContain("CS_LAUNCH_PROJECT_UID");
        expect(keys).toContain("CS_LAUNCH_API_URL");
        expect(keys).toContain("DOTMAN_PROJECT_NAME");
      });
    });

    describe("get_field_metadata", () => {
      it("returns metadata for all fields", () => {
        const metadata = PROVIDER_REGISTRY.cs_launch.get_field_metadata();

        expect(metadata.DOTMAN_PROJECT_NAME).toBeDefined();
        expect(metadata.CS_LAUNCH_AUTH_TOKEN).toBeDefined();
        expect(metadata.CS_LAUNCH_AUTH_TOKEN?.doc_url).toBeDefined();
        expect(metadata.CS_LAUNCH_AUTH_TOKEN?.is_secret).toBe(true);
        expect(metadata.CS_LAUNCH_ORGANIZATION_UID).toBeDefined();
        expect(metadata.CS_LAUNCH_PROJECT_UID).toBeDefined();
        expect(metadata.CS_LAUNCH_API_URL).toBeDefined();
        expect(metadata.CS_LAUNCH_API_URL?.is_optional).toBe(true);
      });
    });
  });

  describe("registry structure", () => {
    it("has unique keys for each provider", () => {
      expect(PROVIDER_REGISTRY.onepassword.key).toBe("onepassword");
      expect(PROVIDER_REGISTRY.bitwarden.key).toBe("bitwarden");
      expect(PROVIDER_REGISTRY.cs_launch.key).toBe("cs_launch");
    });

    it("has labels for each provider", () => {
      expect(PROVIDER_REGISTRY.onepassword.label).toBe("1Password");
      expect(PROVIDER_REGISTRY.bitwarden.label).toBe("BitWarden");
      expect(PROVIDER_REGISTRY.cs_launch.label).toBe("Contentstack Launch");
    });

    it("has env_map_schema for each provider", () => {
      expect(PROVIDER_REGISTRY.onepassword.env_map_schema).toBeDefined();
      expect(PROVIDER_REGISTRY.bitwarden.env_map_schema).toBeDefined();
      expect(PROVIDER_REGISTRY.cs_launch.env_map_schema).toBeDefined();
    });
  });
});
