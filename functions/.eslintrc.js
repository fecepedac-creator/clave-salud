module.exports = {
  root: true,
  env: { es2021: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2021, sourceType: "module" },
  plugins: ["@typescript-eslint", "import"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    // Deja de bloquear por estilo
    "max-len": "off",
    "require-jsdoc": "off",
    "comma-dangle": "off",
    "object-curly-spacing": "off",
    "operator-linebreak": "off",

    // Evita que te bloquee por any mientras iteramos
    "@typescript-eslint/no-explicit-any": "off",

    // Permite vars no usadas temporalmente (si quieres estrictos después, lo activamos)
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  },
};
