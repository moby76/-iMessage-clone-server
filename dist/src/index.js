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
// import { ApolloServer } from 'apollo-server-express';//NOTE - удалить
const server_1 = require("@apollo/server");
// import { ApolloServerPluginDrainHttpServer, ApolloServerPluginLandingPageLocalDefault } from 'apollo-server-core';//NOTE - удалить
const drainHttpServer_1 = require("@apollo/server/plugin/drainHttpServer");
const express_1 = __importDefault(require("express"));
const express4_1 = require("@apollo/server/express4");
const http_1 = __importDefault(require("http"));
const typeDefs_1 = __importDefault(require("./graphql/typeDefs"));
const resolvers_1 = __importDefault(require("./graphql/resolvers"));
const schema_1 = require("@graphql-tools/schema");
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = require("body-parser");
const dotenv = __importStar(require("dotenv"));
const react_1 = require("next-auth/react");
const client_1 = require("@prisma/client");
const ws_1 = require("ws");
const ws_2 = require("graphql-ws/lib/use/ws");
const graphql_subscriptions_1 = require("graphql-subscriptions");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // 1 - активируем dotenv в данном случае внутри асинхронной функции
        dotenv.config();
        // 2 - упаковать типы и резольверы в схему
        const schema = (0, schema_1.makeExecutableSchema)({ typeDefs: typeDefs_1.default, resolvers: resolvers_1.default });
        // 3 - создать клиент Prisma
        const prisma = new client_1.PrismaClient();
        // 4 - создать экземпляр подписок
        const pubsub = new graphql_subscriptions_1.PubSub();
        // 5 - создать экземпляр от express
        const app = (0, express_1.default)();
        // 6 - создать сервер http
        const httpServer = http_1.default.createServer(app);
        // 7 - создать сервер-ws ===================== WebSocketServer =========================================================//
        // 7.1 Creating the WebSocket server
        const wsServer = new ws_1.WebSocketServer({
            // 7.1.1This is the `httpServer` we created in a previous step.
            server: httpServer,
            // 7.1.2 Pass a different path here if your ApolloServer serves at a different path.
            path: '/subscriptions',
        });
        // 7.2 - Передайте схему, которую мы только что создали, и пусть WebSocketServer начнет прослушивание.
        const wsServerCleanup = (0, ws_2.useServer)({
            schema,
            //создание контекста для ws-сервера
            context: (ctx) => __awaiter(this, void 0, void 0, function* () {
                if (ctx.connectionParams && ctx.connectionParams.session) {
                    const { session } = ctx.connectionParams;
                    return { session, prisma, pubsub };
                }
                //если условие --^ не выполнено то вернём только клиента-prisma, экземпляр подписок - pubsub и нулевое значение для сессии
                //это будет иметь место когда пользователь не вошёл в систему 
                return { session: null, prisma, pubsub };
            })
        }, wsServer);
        //----------------------END OF WebSocketServer -------------------------------------------------------//     
        // 8 - создать сервер Apollo
        const server = new server_1.ApolloServer({
            schema,
            csrfPrevention: true,
            plugins: [
                // Правильное завершение работы HTTP-сервера.
                (0, drainHttpServer_1.ApolloServerPluginDrainHttpServer)({ httpServer }),
                // Правильное завершение работы сервера WebSocket.
                {
                    serverWillStart() {
                        return __awaiter(this, void 0, void 0, function* () {
                            return {
                                drainServer() {
                                    return __awaiter(this, void 0, void 0, function* () {
                                        yield wsServerCleanup.dispose();
                                    });
                                },
                            };
                        });
                    },
                },
                // ApolloServerPluginLandingPageLocalDefault({ embed: true }) //NOTE - удалить
            ],
        });
        // 9 - запустить сервер --^
        yield server.start();
        // server.applyMiddleware({ app, cors: corsOptions });//NOTE - удалить
        // 10 - настройки для успешного обхода CORS
        const corsOptions = {
            // origin: process.env.CLIENT_ORIGIN,//получим адрес с которого открыт доступ (http://localhost:3000 - клиент)
            origin: ["http://localhost:3000", "https://imessage-clone.onrender.com"],
            credentials: true
        };
        // 11 - 
        app.use('/', (0, cors_1.default)(corsOptions), //в скобках применим настройки для cors которые создали раньше 
        (0, body_parser_1.json)(), 
        // Функция expressMiddleware принимает два аргумента. Первый обязательный аргумент — запущенный экземпляр ApolloServer --^
        // Второй необязательный аргумент функции expressMiddleware — это объект для настройки ApolloServer,     
        // который может содержать следующие параметры: context --> Необязательная асинхронная функция инициализации контекста.
        (0, express4_1.expressMiddleware)(server, {
            context: ({ req, res }) => __awaiter(this, void 0, void 0, function* () {
                //в данном примере реализация контекста на основе пакета 'next-auth/react' функцией getSession
                const session = yield (0, react_1.getSession)({ req });
                // console.log('CONTEXT SESSION', session?.user);
                // вернём в КОНТЕКСТ: 
                // данные сессии/сеанса(утентифицированного польз.), 
                // доступ к БД через prisma
                // экземпляр подписок - pubsub
                return { session: session, prisma, pubsub };
            })
        }));
        const PORT = process.env.PORT;
        yield new Promise((resolve) => httpServer.listen({ port: PORT }, resolve));
        console.log(`🚀 Server ready at http://localhost:${PORT}`);
    });
}
// 11 - запуск --^
main().catch((err) => console.log(err));
