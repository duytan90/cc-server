import {
  Resolver,
  Query,
  Ctx,
  Arg,
  Mutation,
  Field,
  ObjectType,
} from "type-graphql";
import { User } from "../entities/User";
import { MyContext } from "../types";
import argon2 from "argon2";
import { FORGET_PASSWORD_PREFIX, USER_COOKIE_NAME } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";
import { getConnection } from "typeorm";

@ObjectType()
class FieldError {
  @Field()
  field!: string;

  @Field()
  message!: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  // Get current user
  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyContext) {
    // You are not logged in
    if (!req.session.userId) {
      return null;
    }

    return User.findOne(req.session.userId);
  }

  // Get all users
  @Query(() => [User], { nullable: true })
  getAllUser(@Ctx() { req }: MyContext) {
    // You are not logged in
    if (!req.session.userId || !req.session?.username?.includes("duytan")) {
      return null;
    }

    return User.find();
  }

  // Create new user
  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const registeredEmail = await User.findOne({
      where: { email: options.email },
    });
    if (registeredEmail) {
      return {
        errors: [
          {
            field: "email",
            message: "This email is registered!",
          },
        ],
      };
    }

    if (!options.email.includes("@")) {
      return {
        errors: [
          {
            field: "email",
            message: "Invalid email!",
          },
        ],
      };
    }

    // Simple validation
    if (options.username.length < 2) {
      return {
        errors: [
          {
            field: "username",
            message: "Username should be longer than 2 characters",
          },
        ],
      };
    }

    if (options.password.length < 2) {
      return {
        errors: [
          {
            field: "password",
            message: "Password should be longer than 2 characters",
          },
        ],
      };
    }

    const hashedPassword = await argon2.hash(options.password);
    let user;
    try {
      const user = await User.create({
        username: options.username,
        email: options.email,
        password: hashedPassword,
      }).save()

      // Alternative: use createQueryBuilder()
      // const result = await getConnection()
      //   .createQueryBuilder()
      //   .insert()
      //   .into(User)
      //   .values({
      //     username: options.username,
      //     email: options.email,
      //     password: hashedPassword,
      //   })
      //   .returning("*")
      //   .execute();

      req.session.userId = user.id;
      req.session.username = user.username;
      
    } catch (err) {
      console.log("Error on register: ", err);
    }

    return {
      user,
    };
  }

  // Login
  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne(
      usernameOrEmail.includes("@")
        ? { where: { email: usernameOrEmail } }
        : { where: { username: usernameOrEmail } }
    );

    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "Username or Email doesn't exist",
          },
        ],
      };
    }

    const validPassword = await argon2.verify(user.password, password);
    if (!validPassword) {
      return {
        errors: [
          {
            field: "password",
            message: "Something went wrong!",
          },
        ],
      };
    }

    // Keep user info on session cookie using Redis
    req.session.userId = user.id;
    req.session.username = user.username;

    return {
      user,
    };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(USER_COOKIE_NAME);

        if (err) {
          console.log("Error on logout: ", err);
          resolve(false);
          return;
        }

        resolve(true);
      })
    );
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      console.log("Found no user with email: ", email);
      return true;
    }

    const token = v4();

    await redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id,
      "ex",
      1000 * 60 * 60 * 24 * 3
    ); // expire in 3 days

    const emailHTML = `<a href="http://localhost:3000/change-password/${token}">reset password</a>`;
    await sendEmail(email, emailHTML);

    return true;
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redis, req }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length <= 2) {
      return {
        errors: [
          {
            field: "newPassword",
            message: "Password must be longer than 2 characters!",
          },
        ],
      };
    }

    const redisKey = FORGET_PASSWORD_PREFIX + token;
    const userID = await redis.get(redisKey);

    if (!userID) {
      return {
        errors: [
          {
            field: "token",
            message: "Token is expired",
          },
        ],
      };
    }

    const user = await User.findOne(parseInt(userID));

    await User.update(
      {
        id: parseInt(userID),
      },
      {
        password: await argon2.hash(newPassword),
      }
    );

    await redis.del(redisKey);

    // Login user after change password
    req.session.userId = user?.id;

    return { user };
  }
}
