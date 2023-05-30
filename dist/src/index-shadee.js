"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
// import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
// import { ApolloServer } from "apollo-server-express";
const server_1 = require("@apollo/server");
const drainHttpServer_1 = require("@apollo/server/plugin/drainHttpServer");
const express4_1 = require("@apollo/server/express4");
const express_1 = __importDefault(require("express"));
const graphql_subscriptions_1 = require("graphql-subscriptions");
const ws_1 = require("graphql-ws/lib/use/ws");
const http_1 = require("http");
const ws_2 = require("ws");
const react_1 = require("next-auth/react");
const typeDefs_shad_1 = __importDefault(require("./graphql/typeDefs-shad"));
const resolvers_shad_1 = __importDefault(require("./graphql/resolvers-shad"));
const schema_1 = require("@graphql-tools/schema"); //для передачи в сервер websocket нужно упаковать типы и резольверы в схему 
// import { GraphQLContext, Session, SubscriptionContext } from "./util/types";
const dotenv = __importStar(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = require("body-parser");
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    dotenv.config();
    // Create the schema, which will be used separately by ApolloServer and
    // the WebSocket server.
    const schema = (0, schema_1.makeExecutableSchema)({
        typeDefs: typeDefs_shad_1.default,
        resolvers: resolvers_shad_1.default,
    });
    // Create an Express app and HTTP server; we will attach both the WebSocket
    // server and the ApolloServer to this HTTP server.
    const app = (0, express_1.default)();
    const httpServer = (0, http_1.createServer)(app);
    // Create our WebSocket server using the HTTP server we just set up.
    const wsServer = new ws_2.WebSocketServer({
        server: httpServer,
        path: "/graphql/subscriptions",
    });
    // Context parameters
    const prisma = new client_1.PrismaClient();
    const pubsub = new graphql_subscriptions_1.PubSub();
    const getSubscriptionContext = (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        ctx;
        // ctx is the graphql-ws Context where connectionParams live
        if (ctx.connectionParams && ctx.connectionParams.session) {
            const { session } = ctx.connectionParams;
            return { session, prisma, pubsub };
        }
        // Otherwise let our resolvers know we don't have a current user
        return { session: null, prisma, pubsub };
    });
    // Save the returned server's info so we can shutdown this server later
    const serverCleanup = (0, ws_1.useServer)({
        schema,
        context: (ctx) => {
            // This will be run every time the client sends a subscription request
            // Returning an object will add that information to our
            // GraphQL context, which all of our resolvers have access to.
            return getSubscriptionContext(ctx);
        },
    }, wsServer);
    // Set up ApolloServer.
    const server = new server_1.ApolloServer({
        schema,
        csrfPrevention: true,
        plugins: [
            // Proper shutdown for the HTTP server.
            (0, drainHttpServer_1.ApolloServerPluginDrainHttpServer)({ httpServer }),
            // Proper shutdown for the WebSocket server.
            {
                serverWillStart() {
                    return __awaiter(this, void 0, void 0, function* () {
                        return {
                            drainServer() {
                                return __awaiter(this, void 0, void 0, function* () {
                                    yield serverCleanup.dispose();
                                });
                            },
                        };
                    });
                },
            },
        ],
    });
    yield server.start();
    const corsOptions = {
        origin: process.env.BASE_URL,
        credentials: true,
    };
    app.use("/graphql", (0, cors_1.default)(corsOptions), (0, body_parser_1.json)(), (0, express4_1.expressMiddleware)(server, {
        context: ({ req }) => __awaiter(void 0, void 0, void 0, function* () {
            const session = yield (0, react_1.getSession)({ req });
            return { session: session, prisma, pubsub };
        }),
    }));
    // server.applyMiddleware({ app, path: "/graphql", cors: corsOptions });
    const PORT = 4000;
    // Now that our HTTP server is fully set up, we can listen to it.
    yield new Promise((resolve) => httpServer.listen({ port: PORT }, resolve));
    console.log(`Server is now running on http://localhost:${PORT}/graphql`);
});
main().catch((err) => console.log(err));
