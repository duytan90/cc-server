### project: cc-server

### status: Work in progress

### description: A server using NodeJS typescript, Postgres SQL, MikroORM

### dev:

- `yarn` to init project, install npm packages, etc.
- `yarn watch` to auto compile TypeScript into JavaScript files on `dist`
- `yarn dev` to start `nodemon`, watching changes on `dist` directory

### Note:

After adding/editing entities, run `yarn create:migration` to update migration files before run resolvers
