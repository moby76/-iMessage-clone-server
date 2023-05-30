"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagePopulated = exports.messageResolvers = void 0;
const client_1 = require("@prisma/client");
const graphql_1 = require("graphql");
const graphql_subscriptions_1 = require("graphql-subscriptions");
const functions_1 = require("../../util/functions");
const conversationResolvers_1 = require("./conversationResolvers");
exports.messageResolvers = {
    Query: {
        messages: function (_, args, context) {
            return __awaiter(this, void 0, void 0, function* () {
                const { session, prisma } = context;
                const { conversationId } = args;
                if (!(session === null || session === void 0 ? void 0 : session.user)) {
                    throw new graphql_1.GraphQLError("Not authorized");
                }
                const { user: { id: userId }, } = session;
                /**
                 * Verify that conversation exists & user is a participant
                 */
                const conversation = yield prisma.conversation.findUnique({
                    where: {
                        id: conversationId,
                    },
                    include: conversationResolvers_1.conversationPopulated,
                });
                if (!conversation) {
                    throw new graphql_1.GraphQLError("Conversation Not Found");
                }
                const allowedToView = (0, functions_1.userIsConversationParticipant)(conversation.participants, userId);
                if (!allowedToView) {
                    throw new graphql_1.GraphQLError("Not Authorized");
                }
                try {
                    const messages = yield prisma.message.findMany({
                        where: {
                            conversationId,
                        },
                        include: exports.messagePopulated,
                        orderBy: {
                            createdAt: "desc",
                        },
                    });
                    return messages;
                }
                catch (error) {
                    console.log("messages error", error);
                    throw new graphql_1.GraphQLError(error === null || error === void 0 ? void 0 : error.message);
                }
            });
        },
    },
    Mutation: {
        sendMessage: function (_, args, context) {
            return __awaiter(this, void 0, void 0, function* () {
                const { session, prisma, pubsub } = context;
                const { id: messageId, senderId, conversationId, body } = args;
                if (!(session === null || session === void 0 ? void 0 : session.user)) {
                    throw new graphql_1.GraphQLError("Not authorized");
                }
                const { id: userId } = session.user;
                if (userId !== senderId) {
                    throw new graphql_1.GraphQLError("Not authorized");
                }
                console.log("HERE IS DATA", args);
                try {
                    /**
                     * Create new message entity
                     */
                    const newMessage = yield prisma.message.create({
                        data: {
                            id: messageId,
                            senderId,
                            conversationId,
                            body,
                        },
                        include: exports.messagePopulated,
                    });
                    /**
                     * Find ConversationParticipant entity
                     */
                    const participant = yield prisma.conversationParticipant.findFirst({
                        where: {
                            userId,
                            conversationId,
                        },
                    });
                    /**
                     * Should always exist
                     */
                    if (!participant) {
                        throw new graphql_1.GraphQLError("Participant does not exist");
                    }
                    console.log("HERE IS PARTICIPANT", participant);
                    /**
                     * Update conversation entity
                     */
                    const conversation = yield prisma.conversation.update({
                        where: {
                            id: conversationId,
                        },
                        data: {
                            latestMessageId: newMessage.id,
                            participants: {
                                update: {
                                    where: {
                                        id: participant.id,
                                    },
                                    data: {
                                        hasSeenLatestMessage: true,
                                    },
                                },
                                updateMany: {
                                    where: {
                                        userId: {
                                            not: userId //NOTE - 
                                        }
                                    },
                                    data: {
                                        hasSeenLatestMessage: false,
                                    },
                                },
                            },
                        },
                        include: conversationResolvers_1.conversationPopulated,
                    });
                    pubsub.publish("MESSAGE_SENT", { messageSent: newMessage });
                    pubsub.publish("CONVERSATION_UPDATED", {
                        conversationUpdated: {
                            conversation,
                        },
                    });
                }
                catch (error) {
                    console.log("sendMessage error", error);
                    throw new graphql_1.GraphQLError("Error sending message");
                }
                return true;
            });
        },
    },
    Subscription: {
        messageSent: {
            subscribe: (0, graphql_subscriptions_1.withFilter)((_, __, context) => {
                const { pubsub } = context;
                return pubsub.asyncIterator(["MESSAGE_SENT"]);
            }, (payload, args, context) => {
                return payload.messageSent.conversationId === args.conversationId;
            }),
        },
    },
};
exports.messagePopulated = client_1.Prisma.validator()({
    sender: {
        select: {
            id: true,
            username: true,
        },
    },
});
// export default resolvers;
