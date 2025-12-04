import nextConfig from "eslint-config-next";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = [
  ...nextConfig,
  prettierConfig,
  {
    ignores: [".next/**", "node_modules/**", "out/**", "build/**", "dist/**"],
  },
];

export default eslintConfig;
