"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageTypes = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.messageTypes = (0, graphql_tag_1.default) `

    scalar Date

    type Message {
        id: String
        sender: User
        body: String
        createdAt: Date
    }

    type Query {
        messages(conversationId: String): [Message]
    }

    type Mutation {
        sendMessage(
            id: String
            body: String
            conversationId: String 
            senderId: String            
        ): Boolean
    }

    type Subscription {
        messageSent(conversationId: String): Message
    }
`;
