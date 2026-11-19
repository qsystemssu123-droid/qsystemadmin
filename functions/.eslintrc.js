
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
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],

    // Allow helper functions without mandatory JSDoc comments.
    "require-jsdoc": "off",
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
