export default {
  parser: {
    plugins: ["jsx", "classProperties", "dynamicImport", "throwExpressions", "typescript"]
  },
  traverse: ({ path, push }) => {
    const { node } = path;
    if (node.type !== "CallExpression") {
      return;
    }
    if (node.callee?.property?.name === "resolve" && node.callee?.object?.name === "require") {
      const possiblePackage = node.arguments?.[0]?.value;
      if (typeof possiblePackage === "string") {
        return push(possiblePackage);
      }
    }
  },
  ignore: {
    src: ["~tests", "~"],
    dependencies: ["typescript", "pino-pretty"],
    devDependencies: true,
    peerDependencies: true
  },
  ignoreDirs: ["node_modules/", "dist/", "build/", "nextjs/"],
  packages: ["./"]
};
