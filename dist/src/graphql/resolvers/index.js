"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const merge_1 = require("@graphql-tools/merge");
const userResolvers_1 = require("./userResolvers");
const conversationResolvers_1 = require("./conversationResolvers");
const messageResolvers_1 = require("./messageResolvers");
// import { messageResolvers } from './messageResolvers-shad'
const scalars_1 = __importDefault(require("./scalars")); //NOTE - 
const resolvers = (0, merge_1.mergeResolvers)([
    userResolvers_1.userResolvers,
    conversationResolvers_1.conversationResolvers,
    messageResolvers_1.messageResolvers,
    scalars_1.default
]);
exports.default = resolvers;
