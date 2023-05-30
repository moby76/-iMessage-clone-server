"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const merge_1 = require("@graphql-tools/merge");
const userTypeDefs_1 = require("./userTypeDefs");
const conversationTypeDefs_1 = require("./conversationTypeDefs");
const messageTypeDefs_1 = require("./messageTypeDefs");
const typeDefs = (0, merge_1.mergeTypeDefs)([userTypeDefs_1.userTypes, conversationTypeDefs_1.conversationTypes, messageTypeDefs_1.messageTypes]);
exports.default = typeDefs;
