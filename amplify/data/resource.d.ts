import { type ClientSchema } from "@aws-amplify/backend";
declare const schema: import("@aws-amplify/data-schema").ModelSchema<{
    types: {
        LeaderboardEntry: import("@aws-amplify/data-schema").ModelType<import("@aws-amplify/data-schema-types").SetTypeSubArg<{
            fields: {
                username: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                timeSeconds: import("@aws-amplify/data-schema").ModelField<number, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.Integer>;
                userId: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                displayTime: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                stepsTaken: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<number>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Integer>;
                enemiesNoticed: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<number>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Integer>;
                crowsSpooked: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<number>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Integer>;
                avgHeartRate: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<number>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Integer>;
                maxHeartRate: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<number>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Integer>;
                leshenSteps: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<number>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Integer>;
                monsterCount: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<number>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Integer>;
                leshenEnabled: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<boolean>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Boolean>;
                torchBurnoutEnabled: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<boolean>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Boolean>;
                torchTimerSeconds: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<number>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Integer>;
            };
            identifier: import("@aws-amplify/data-schema").ModelDefaultIdentifier;
            secondaryIndexes: [];
            authorization: [];
            disabledOperations: [];
        }, "authorization", (import("@aws-amplify/data-schema").Authorization<"public", undefined, false> & {
            to: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, operations: ("list" | "get" | "create" | "update" | "delete" | "read" | "sync" | "listen" | "search")[]) => Omit<SELF, "to">;
        })[]>, "authorization">;
    };
    authorization: [];
    configuration: any;
}, never>;
export type Schema = ClientSchema<typeof schema>;
export declare const data: import("@aws-amplify/plugin-types").ConstructFactory<import("@aws-amplify/graphql-api-construct").AmplifyGraphqlApi>;
export {};
