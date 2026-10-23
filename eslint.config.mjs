import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // El proyecto nativo de iOS: `cap sync` copia ahí el JS de Capacitor
    // (cordova.js y compañía), que es código de terceros, no nuestro.
    "ios/**",
  ]),
]);

export default eslintConfig;
