import { Request, Response } from "express";
import { Session, SessionData } from "express-session";
import { Redis } from "ioredis";

export type MyContext = {
  redis: Redis;
  req: Request & {
    session: Session &
      Partial<SessionData> & { userId?: number; username?: string };
  };
  res: Response;
};
