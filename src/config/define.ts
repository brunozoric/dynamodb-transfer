import { z } from "zod";

const nonEmpty = z.string().min(1);

export const TableConfigSchema = z.object({
  name: nonEmpty,
  description: nonEmpty.max(25, "description must be 25 characters or fewer"),
  awsProfile: nonEmpty.optional(),
  region: nonEmpty.optional(),
});

export const DefaultsSchema = z.object({
  awsProfile: nonEmpty,
  region: nonEmpty,
});

export const ConfigSchema = z
  .object({
    defaults: DefaultsSchema,
    tables: z.array(TableConfigSchema).min(1, "tables must be a non-empty array"),
  })
  .superRefine((config, ctx) => {
    const names = new Map<string, number>();
    const descriptions = new Map<string, number>();
    config.tables.forEach((table, i) => {
      const prevName = names.get(table.name);
      if (prevName !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["tables", i, "name"],
          message: `duplicate of tables[${prevName}].name`,
        });
      } else {
        names.set(table.name, i);
      }
      const prevDesc = descriptions.get(table.description);
      if (prevDesc !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["tables", i, "description"],
          message: `duplicate of tables[${prevDesc}].description`,
        });
      } else {
        descriptions.set(table.description, i);
      }
    });
  });

export type TableConfig = z.infer<typeof TableConfigSchema>;
export type Defaults = z.infer<typeof DefaultsSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export interface ResolvedTable {
  name: string;
  description: string;
  awsProfile: string;
  region: string;
}

export const defineConfig = (config: Config): Config => config;
