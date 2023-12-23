import { SlackAPI } from "https://deno.land/x/deno_slack_api@2.1.2/mod.ts";
import { load } from "https://deno.land/std@0.210.0/dotenv/mod.ts";
import { writeCSV } from "https://deno.land/x/csv@v0.9.2/mod.ts";
import { datetime } from "https://deno.land/x/ptera/mod.ts";

// reaction, user
type ReactionCSVRow = [string, string];

const env = await load();
const token = env["SLACK_TOKEN"];
const csvFilePath = "/tmp/reactions.csv";
const client = SlackAPI(token);

const fetchChannels = async () => {
  const results = [];
  let cursor: string | undefined;

  do {
    const response = await client.conversations.list({ cursor });
    results.push(...response.channels);
    console.log(`${results.length} channels are found.`);
    cursor = response.response_metadata?.next_cursor;
  } while (cursor);

  return results;
};

const fetchReactions = async (channelId: string) => {
  const results: ReactionCSVRow[] = [];
  let cursor: string | undefined;
  const oldest = datetime("2023-01-01 00:00:00").setLocale("ja").format("X");

  do {
    console.log(`fetching reactions from ${channelId}...`);
    const response = await client.conversations.history({
      channel: channelId,
      cursor,
      oldest,
    });

    if (!response.messages) {
      console.log("no messages are found.");
      break;
    }

    const reactions = response.messages.map(({ reactions }) => (reactions))
      .flat(1).filter(
        Boolean,
      ).map(({ name, users }) => (users.map((u) => [name, u]))).flat(1);

    results.push(...reactions);
    console.log(`${results.length} reactions are found.`);
    cursor = response.response_metadata?.next_cursor;
  } while (cursor);

  return results;
};

const channels = await fetchChannels();
console.log(`${channels.length} channels are found.`);

const file = await Deno.open(csvFilePath, {
  write: true,
  create: true,
  truncate: true,
});

// use `for` for run function serially.
for (let i = 0; i < channels.length; i++) {
  console.log(`i=${i}`);
  const reactions = await fetchReactions(channels[i].id);

  await writeCSV(
    file,
    reactions,
  );
}
