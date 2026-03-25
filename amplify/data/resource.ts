import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

const schema = a.schema({
  LeaderboardEntry: a
    .model({
      username: a.string().required(),
      timeSeconds: a.integer().required(),
      userId: a.string().required(),
      displayTime: a.string().required(),
      stepsTaken: a.integer(),
      enemiesNoticed: a.integer(),
      crowsSpooked: a.integer(),
      avgHeartRate: a.integer(),
      maxHeartRate: a.integer(),
      leshenSteps: a.integer(),
      monsterCount: a.integer(),
      leshenEnabled: a.boolean(),
      torchBurnoutEnabled: a.boolean(),
      torchTimerSeconds: a.integer(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
});
