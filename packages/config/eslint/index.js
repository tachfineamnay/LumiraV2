module.exports = {
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
    plugins: ["@typescript-eslint"],
    env: {
        node: true,
        es6: true,
    },
    rules: {
        "@typescript-eslint/no-unused-vars": "error",
        "@typescript-eslint/no-explicit-any": "error",
    },
};
