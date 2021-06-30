import { Request, Response } from 'express'
import { Session, SessionData } from 'express-session'
import { Redis } from 'ioredis'
import { createUpdootLoader } from './utils/createUpdootLoader'
import { createUserLoader } from './utils/createUserLoader'

export type MyContext = {
  redis: Redis
  req: Request & {
    session: Session &
      Partial<SessionData> & { userId?: number; username?: string }
  }
  res: Response
  userLoader: ReturnType<typeof createUserLoader>
  updootLoader: ReturnType<typeof createUpdootLoader>
}
