
module.exports = {
  root: true,

  env: {
    es6: true,
    es2022: true,
    node: true,
  },

  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "script",
  },

  extends: [
    "eslint:recommended",
    "google",
  ],

  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", { "allowTemplateLiterals": true }],

    // Allow helper functions without mandatory JSDoc comments.
    "require-jsdoc": "off",

    // Use Prettier-compatible 2-space indentation.
    "indent": ["error", 2],

    // Allow spaces inside object destructuring and object literals.
    "object-curly-spacing": ["error", "always"],

    // Allow consistent spacing around parentheses.
    "space-before-function-paren": ["error", "always"],

    // Disable conflicting formatting rules.
    "max-len": "off",
    "operator-linebreak": "off",
    "function-paren-newline": "off",
    "implicit-arrow-linebreak": "off",
    "no-trailing-spaces": "error",
  },

  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],

  globals: {},
};
