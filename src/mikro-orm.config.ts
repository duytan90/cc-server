import { Post } from "./entities/Post";
import { User } from "./entities/User";
import { __prod__ } from "./constants";
import { MikroORM } from "@mikro-orm/core";
import path from "path";

// After adding a new Entity into src/entities, should
// 1. Add into `entities` array below
// 2. run `yarn run create:migration` command
// to create new migration in `migrations` directory

export default {
  dbName: "caichodb",
  user: "duytan",
  password: "duytan",
  type: "postgresql",
  debug: !__prod__,
  entities: [Post, User],
  migrations: {
    path: path.join(__dirname, "./migrations"),
    pattern: /^[\w-]+\d+\.[tj]s$/,
  },
} as Parameters<typeof MikroORM.init>[0];
