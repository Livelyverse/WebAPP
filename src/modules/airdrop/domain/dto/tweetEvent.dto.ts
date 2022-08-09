import { TweetV2 } from "twitter-api-v2";

export class TweetEventDto {

  public static from(tweetV2: TweetV2): TweetEventDto {
    if (tweetV2) {
      const tweetEvent = new TweetEventDto();
      tweetEvent.text = tweetV2.text;
      tweetEvent.source = tweetV2?.source;
      tweetEvent.referencedTweets = tweetV2?.referenced_tweets;
      tweetEvent.id = tweetV2.id;
      tweetEvent.createdAt = tweetV2.created_at ? new Date(tweetV2.created_at) : new Date();
      tweetEvent.conversationId = tweetV2?.conversation_id;
      tweetEvent.publicMetrics = tweetV2?.public_metrics;
      tweetEvent.possiblySensitive = tweetV2?.possibly_sensitive;
      tweetEvent.replySettings = tweetV2?.reply_settings
      tweetEvent.authorId = tweetV2.author_id;
      tweetEvent.lang = tweetV2?.lang;
      return tweetEvent;
    }
    return null;
  }

  public text: string
  public source: string
  public referencedTweets: Array<{type: string, id: string}>
  public id: string
  public createdAt: Date
  public conversationId: string
  public publicMetrics: {
    retweet_count: number,
    reply_count: number,
    like_count: number,
    quote_count: number,
  }
  public possiblySensitive: boolean
  public replySettings: string
  public authorId: string
  public lang: string
}
