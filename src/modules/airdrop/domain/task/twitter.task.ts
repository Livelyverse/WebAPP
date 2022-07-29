// This will work on TypeScript (with commonJS and ECMA)
// AND with Node.js in ECMA mode (.mjs files, type: "module" in package.json)
import { TwitterApi } from 'twitter-api-v2';
import { ETwitterStreamEvent } from "twitter-api-v2/dist/types";


// OAuth2 (app-only or user context)
// Create a client with an already known bearer token
async function main() {
  const appOnlyClient = new TwitterApi('AAAAAAAAAAAAAAAAAAAAAL86ewEAAAAAse96gclDBGSUtHtPUtmNrIcKBD4%3DumBH2Q4nGA4HGvZDWHXJQnnK3XKtDVAVMHvUOPXCHeFD9r8Zsw');
  const client = appOnlyClient.readOnly
// const v2Client = roClient.v2;

  const rules = await client.v2.streamRules();

// Log every rule ID
  console.log(rules.data.map(rule => rule.id));

  // // Delete rules
  // const deleteRules = await client.v2.updateStreamRules({
  //   delete: {
  //     ids: ['1549398805274959872', '1549398805274959873', '1549398805274959874', '1549398805274959875', '1551926034265944064'],
  //   },
  // });
  //
  // console.log(`delete rules error: ${JSON.stringify(deleteRules.errors)}`);
  //
  // // Add rules
  // const addedRules = await client.v2.updateStreamRules({
  //   add: [
  //     { value: 'from:Lively_planet', },
  //   ],
  // });

  // console.log('add new rule: ');
  // console.log(addedRules.data.map(rule => rule.id));

  let  sampleFilterv2 = await client.v2.searchStream()
  sampleFilterv2 = await sampleFilterv2.connect()
  sampleFilterv2.on(ETwitterStreamEvent.Data, (data) => {
    console.log(`Event: ${JSON.stringify(data)}`);
  });
}

// @ts-ignore
//   const jackTimeline = await client.v2.userTimeline('1473018554303885316', {
//     expansions: ['attachments.media_keys', 'attachments.poll_ids', 'referenced_tweets.id'],
//     'media.fields': ['url'],
//   });

// jackTimeline.includes contains a TwitterV2IncludesHelper instance
// @ts-ignore
//   for await (const tweet of jackTimeline) {
//     const medias = jackTimeline.includes.medias(tweet);
//     const poll = jackTimeline.includes.poll(tweet);
//
//     if (medias.length) {
//       console.log('This tweet contains medias! URLs:', medias.map(m => m.url));
//     }
//     if (poll) {
//       console.log('This tweet contains a poll! Options:', poll.options.map(opt => opt.label));
//     }
//   }
// }

main()

