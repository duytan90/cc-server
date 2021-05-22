import { Resolver, Query, Ctx, Arg, Int, Mutation } from "type-graphql";
import { Post } from "../entities/Post";
import { MyContext } from "../types";

// Query commands for Post
@Resolver()
export class PostResolver {
  // Get all posts
  @Query(() => [Post])
  posts(@Ctx() { em }: MyContext): Promise<Post[]> {
    return em.find(Post, {});
  }

  // Note:
  // "id" or any string in @Arg reflects argument in query schema
  // e.g. change "id" into "identifer" then query argument should be "identifer"

  // Get a post from id
  @Query(() => Post, { nullable: true })
  post(
    @Arg("id", () => Int) id: number,
    @Ctx() { em }: MyContext
  ): Promise<Post | null> {
    return em.findOne(Post, { id });
  }

  // Create a new post
  @Mutation(() => Post, { nullable: true })
  async createPost(
    @Arg("title") title: string,
    @Ctx() { req, em }: MyContext
  ): Promise<Post | null> {
    if (!req.session.userId) {
      return null;
    }
    try {
      const post = em.create(Post, { title, ownerId: req.session.userId });
      await em.persistAndFlush(post);
      return post;
    } catch (err) {
      console.log(`Create new post error: ${err}`);
      return null;
    }
  }

  // Update a post
  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("id") id: number,
    @Arg("title", () => String, { nullable: true }) title: string,
    @Ctx() { em }: MyContext
  ): Promise<Post | null> {
    const post = await em.findOne(Post, { id });
    if (!post) {
      return null;
    }
    if (typeof title !== "undefined") {
      post.title = title;
      await em.persistAndFlush(post);
    }
    return post;
  }

  // Delete a post
  @Mutation(() => Boolean)
  async deletePost(
    @Arg("id") id: number,
    @Ctx() { em }: MyContext
  ): Promise<boolean> {
    try {
      await em.nativeDelete(Post, { id });
      return true;
    } catch (err) {
      console.error(`Error on deleting post id ${id}: ${err}`);
      return false;
    }
  }

  // Delete all posts
  @Mutation(() => Boolean)
  async deleteAllPost(@Ctx() { req, em }: MyContext): Promise<boolean> {
    try {
      if (!req.session.userId) {
        return false;
      }
      const posts = await em.find(Post, {ownerId: req.session.userId});
      await em.removeAndFlush(posts)
      return true;
    } catch (err) {
      console.error(`Error on deleting all posts ${err}`);
      return false;
    }
  }
}
