import { Resolver, Query, Ctx, Arg, Int, Mutation } from "type-graphql";
import { Post } from "../entities/Post";
import { MyContext } from "../types";

// Query commands for Post
@Resolver()
export class PostResolver {
  // Get all posts
  @Query(() => [Post])
  posts(@Ctx() {}: MyContext): Promise<Post[]> {
    return Post.find();
  }

  // Note:
  // "id" or any string in @Arg reflects argument in query schema
  // e.g. change "id" into "identifer" then query argument should be "identifer"

  // Get a post from id
  @Query(() => Post, { nullable: true })
  post(
    @Arg("id", () => Int) id: number,
    @Ctx() {}: MyContext
  ): Promise<Post | undefined> {
    return Post.findOne(id);
  }

  // Create a new post
  @Mutation(() => Post, { nullable: true })
  async createPost(
    @Arg("title") title: string,
    @Ctx() {}: MyContext
  ): Promise<Post> {
    return Post.create({ title }).save();
  }

  // Update a post
  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("id") id: number,
    @Arg("title", () => String, { nullable: true }) title: string,
    @Ctx() {}: MyContext
  ): Promise<Post | null> {
    const post = await Post.findOne(id);
    if (!post) {
      return null;
    }
    if (typeof title !== "undefined") {
      await Post.update({ id }, { title });
    }
    return post;
  }

  // Delete a post
  @Mutation(() => Boolean)
  async deletePost(
    @Arg("id") id: number,
    @Ctx() {}: MyContext
  ): Promise<boolean> {
    await Post.delete(id);
    return true;
  }

  // Delete all posts
  @Mutation(() => Boolean)
  async deleteAllPost(@Ctx() { req }: MyContext): Promise<boolean> {
    try {
      if (!req.session.userId) {
        return false;
      }
      await Post.clear();
      return true;
    } catch (err) {
      console.error(`Error on deleting all posts ${err}`);
      return false;
    }
  }
}
