// This will work on TypeScript (with commonJS and ECMA)
// AND with Node.js in ECMA mode (.mjs files, type: "module" in package.json)
import { TwitterApi } from 'twitter-api-v2';


// OAuth2 (app-only or user context)
// Create a client with an already known bearer token
async function main() {
  const appOnlyClient = new TwitterApi('AAAAAAAAAAAAAAAAAAAAAL86ewEAAAAAse96gclDBGSUtHtPUtmNrIcKBD4%3DumBH2Q4nGA4HGvZDWHXJQnnK3XKtDVAVMHvUOPXCHeFD9r8Zsw');
  const client = appOnlyClient.readOnly
// const v2Client = roClient.v2;

// @ts-ignore
  const jackTimeline = await client.v2.userTimeline('1473018554303885316', {
    expansions: ['attachments.media_keys', 'attachments.poll_ids', 'referenced_tweets.id'],
    'media.fields': ['url'],
  });

// jackTimeline.includes contains a TwitterV2IncludesHelper instance
// @ts-ignore
  for await (const tweet of jackTimeline) {
    const medias = jackTimeline.includes.medias(tweet);
    const poll = jackTimeline.includes.poll(tweet);

    if (medias.length) {
      console.log('This tweet contains medias! URLs:', medias.map(m => m.url));
    }
    if (poll) {
      console.log('This tweet contains a poll! Options:', poll.options.map(opt => opt.label));
    }
  }
}

main()

