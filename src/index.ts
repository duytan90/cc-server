import 'reflect-metadata'
import { __prod__, USER_COOKIE_NAME } from './constants'
import 'dotenv-safe/config'
import express from 'express'
import { ApolloServer } from 'apollo-server-express'
import { buildSchema } from 'type-graphql'
import { PostResolver } from './resolvers/post'
import { UserResolver } from './resolvers/user'
import Redis from 'ioredis'
import session from 'express-session'
import connectRedis from 'connect-redis'
import cors from 'cors'
import { createConnection } from 'typeorm'
import { Post } from './entities/Post'
import { User } from './entities/User'
import path from 'path'
import { Updoot } from './entities/Updoot'
import { createUserLoader } from './utils/createUserLoader'
import { createUpdootLoader } from './utils/createUpdootLoader'

const main = async () => {
  const conn = await createConnection({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    logging: true,
    // synchronize: true,
    migrations: [path.join(__dirname, './migrations/*')],
    entities: [Post, User, Updoot],
  })

  await conn.runMigrations()

  // await Post.delete({})

  const app = express()
  const RedisStore = connectRedis(session)
  const redis = new Redis(process.env.REDIS_URL)
  app.set('proxy', 1)
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    })
  )

  app.use(
    session({
      name: USER_COOKIE_NAME,
      store: new RedisStore({
        client: redis,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
        httpOnly: true,
        secure: __prod__, // cookie only works in https
        sameSite: 'lax', // csrf
        domain: __prod__ ? '' : undefined, // TODO: add production domain here
      },
      saveUninitialized: false,
      secret: process.env.REDIS_SESSION_SECRET?.toString(),
      resave: false,
    })
  )

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({
      req,
      res,
      redis,
      userLoader: createUserLoader(),
      updootLoader: createUpdootLoader(),
    }),
  })

  apolloServer.applyMiddleware({
    app,
    cors: false,
  })

  app.get('/', (_, res) => {
    res.send('Hello from express')
  })

  app.listen(parseInt(process.env.PORT), () => {
    console.log('server started on localhost:4000')
  })
}

main().catch(err => {
  console.log('-------------------------- MAIN ERROR')
  console.log(err)
  console.log('-------------------------- ----------')
})
