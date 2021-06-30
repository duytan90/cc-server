import {
  Resolver,
  Query,
  Ctx,
  Arg,
  Int,
  Mutation,
  InputType,
  Field,
  UseMiddleware,
  FieldResolver,
  Root,
  ObjectType,
} from 'type-graphql'
import { getConnection } from 'typeorm'
import { Post } from '../entities/Post'
import { Updoot } from '../entities/Updoot'
import { User } from '../entities/User'
import { isAuth } from '../middleware/isAuth'
import { MyContext } from '../types'

@InputType()
class PostInput {
  @Field()
  title!: string

  @Field()
  text!: string
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts!: Post[]
  @Field()
  hasMore!: boolean
}

// Query commands for Post
@Resolver(Post)
export class PostResolver {
  // Return just 50 chars from text
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50)
  }

  // Every time client get Post, response will add User info to the query
  @FieldResolver(() => User)
  creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
    return userLoader.load(post.creatorId)
  }

  @FieldResolver(() => Int, { nullable: true })
  async voteStatus(
    @Root() post: Post,
    @Ctx() { updootLoader, req }: MyContext
  ) {
    if (!req.session.userId) {
      return null
    }
    const updoot = await updootLoader.load({
      postId: post.id,
      userId: req.session.userId,
    })

    return Updoot ? updoot?.value : null
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg('postId', () => Int) postId: number,
    @Arg('value', () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const { userId } = req.session
    const realValue = value > 0 ? 1 : -1
    const updoot = await Updoot.findOne({ where: { postId, userId } })

    if (updoot && updoot.value !== realValue) {
      await getConnection().transaction(async tm => {
        await tm.query(
          `
          update updoot set value = $1 where "postId" = $2 and "userId" = $3
        `,
          [realValue, postId, userId]
        )

        await tm.query(
          `
          update post set points = points + $1 where id = $2
        `,
          [2 * realValue, postId]
        )
      })
    } else if (!updoot) {
      await getConnection().transaction(async tm => {
        await tm.query(
          `
          insert into updoot ("userId", "postId", value) values ($1, $2, $3);
        `,
          [userId, postId, realValue]
        )

        await tm.query(
          `
          update post set points = points + $1 where id = $2;
        `,
          [realValue, postId]
        )
      })
    }

    return true
  }

  // Get all posts
  @Query(() => PaginatedPosts)
  async posts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPosts> {
    // Take extra 1 item to check if no more post to show
    const takeLimit = Math.min(100, limit)
    const takeLimitPlusOne = takeLimit + 1
    const posts = await getConnection().query(
      `
        select p.*
        from post p
        ${cursor ? `where p."createdAt" < to_timestamp(${cursor})` : ''}
        order by p."createdAt" DESC
        limit ${takeLimitPlusOne}
      `
    )

    // const db = getConnection()
    //   .getRepository(Post)
    //   .createQueryBuilder('p')
    //   .innerJoinAndSelect('p.creator', 'u', 'u.id = p."creatorId"')
    //   .orderBy('p."createdAt"', 'DESC')
    //   .take(takeLimit)
    // if (cursor) {
    //   db.where('p."createdAt" > :cursor', {
    //     cursor: new Date(parseInt(cursor)),
    //   })
    // }

    // const posts = await db.getMany()

    return {
      posts: posts.slice(0, takeLimit),
      hasMore: posts.length === takeLimitPlusOne,
    }
  }

  // Note:
  // "id" or any string in @Arg reflects argument in query schema
  // e.g. change "id" into "identifer" then query argument should be "identifer"
  @Query(() => Post, { nullable: true })
  post(
    @Arg('id', () => Int) id: number,
    @Ctx() {}: MyContext
  ): Promise<Post | undefined> {
    return Post.findOne(id)
  }

  // Create a new post
  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg('input') input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    return Post.create({ ...input, creatorId: req.session.userId }).save()
  }

  // Update a post
  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg('id', () => Int) id: number,
    @Arg('title') title: string,
    @Arg('text') text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const result = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id = :id and "creatorId" = :creatorId', {
        id,
        creatorId: req.session.userId,
      })
      .returning('*')
      .execute()

    return result.raw[0]
  }

  // Delete a post
  @Mutation(() => Boolean)
  async deletePost(
    @Arg('id', () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    const post = await Post.findOne(id)
    if (!post) {
      return false
    }
    if (post?.creatorId !== req.session.userId) {
      throw new Error('not authorized!')
    }

    await Updoot.delete({ postId: id })
    await Post.delete({ id, creatorId: req.session.userId })
    return true
  }

  // Delete all posts
  // @Mutation(() => Boolean)
  // async deleteAllPost(@Ctx() { req }: MyContext): Promise<boolean> {
  //   try {
  //     if (!req.session.userId) {
  //       return false
  //     }
  //     await Post.clear()
  //     return true
  //   } catch (err) {
  //     console.error(`Error on deleting all posts ${err}`)
  //     return false
  //   }
  // }
}
