// @ts-expect-error - JSON import handled by bundler
import packageJson from "../package.json";

export const VERSION = packageJson.version as string;
