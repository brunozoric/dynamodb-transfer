import { writeFileSync, existsSync } from "node:fs";

if (!existsSync(".yarnrc.yml")) {
  writeFileSync(
    ".yarnrc.yml",
    `nodeLinker: node-modules
`
  );
  console.log("Created .yarnrc.yml — run 'yarn install' again");
}
