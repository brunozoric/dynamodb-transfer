import dynalite = require("dynalite");
import type { DynaliteServer } from "dynalite";

let server: DynaliteServer;

export async function setup(): Promise<void> {
  server = dynalite({ createTableMs: 0, deleteTableMs: 0 });
  await new Promise<void>((resolve, reject) => {
    server.listen(0, err => (err ? reject(err) : resolve()));
  });
  const port = server.address().port;
  process.env.AWS_ENDPOINT_URL_DYNAMODB = `http://localhost:${port}`;
  process.env.AWS_ACCESS_KEY_ID = "test";
  process.env.AWS_SECRET_ACCESS_KEY = "test";
  process.env.AWS_REGION = "us-east-1";
}

export async function teardown(): Promise<void> {
  await new Promise<void>(resolve => {
    server.close(() => resolve());
  });
}
