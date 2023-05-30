"use strict";
/**=======================================================================================================================
 *                                                    Подключение/импорт пакетов и модулей
 *=======================================================================================================================**/
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
const react_1 = require("next-auth/react");
// @apollo/server — это основная библиотека самого сервера Apollo. Apollo Server умеет преобразовывать HTTP-запросы и ответы в 
// операции GraphQL и запускать их в расширяемом контексте с поддержкой подключаемых модулей и других функций.
const server_1 = require("@apollo/server");
// Функция expressMiddleware позволяет вам подключить сервер Apollo к серверу Express.
const express4_1 = require("@apollo/server/express4");
// Чтобы обеспечить корректное завершение работы вашего сервера, 
//мы рекомендуем использовать подключаемый модуль ApolloServerPluginDrainHttpServer.
const drainHttpServer_1 = require("@apollo/server/plugin/drainHttpServer");
//подключим сам express-сервер
const express_1 = __importDefault(require("express"));
// Функция expressMiddleware предполагает, что вы настроите синтаксический анализ тела HTTP и 
// заголовки CORS для вашей веб-инфраструктуры. В частности, вы должны установить пакеты body-parser 
// и cors и использовать их для настройки приложения Express, как показано ниже.
const body_parser_1 = __importDefault(require("body-parser"));
// import { json } from 'body-parser';
const cors_1 = __importDefault(require("cors"));
//пакет для создания http-сервера
const http_1 = __importDefault(require("http"));
const dotenv = __importStar(require("dotenv"));
/*-------------------------------- пакеты для работы с подпиской ------------------------------*/
const ws_1 = require("ws");
const ws_2 = require("graphql-ws/lib/use/ws");
const graphql_subscriptions_1 = require("graphql-subscriptions");
/*--------------------------------- подключим схемы и резольверы ------------------------------*/
const typeDefs_shad_1 = __importDefault(require("./graphql/typeDefs-shad"));
const resolvers_shad_1 = __importDefault(require("./graphql/resolvers-shad"));
const schema_1 = require("@graphql-tools/schema"); //для передачи в сервер websocket нужно упаковать типы и резольверы в схему 
/*==================================================== END OF SECTION Подключения пакетов ===============================================*/
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    //NOTE - активируем dotenv в данном случае внутри асинхронной функции
    dotenv.config();
    //настройки для успешного обхода CORS
    const corsOptions = {
        origin: process.env.CLIENT_ORIGIN,
        credentials: true
    };
    // interface MyContext {
    //     token?: string;
    // }
    //определить константу отвечающую за подписки
    const pubsub = new graphql_subscriptions_1.PubSub();
    //Определим функцию в которой отрабатывается подписка operationFinished с триггером OPERATION_FINISHED
    // const mockLongLastingOperation = (name) => {
    //     setTimeout(() => {
    //         pubsub.publish('OPERATION_FINISHED', {operationFinished: {name, endDate: new Date().toDateString()}})
    //     }, 3000)
    // }
    // const typeDefs = gql`
    //     type Operation{
    //         name: String!
    //         endDate: String!
    //     }
    //     type NewsEvent{
    //         title: String
    //         description: String
    //     }
    //     type  Query  {
    //         placeolder: Boolean
    //         foo: String
    //     }
    //     type Mutation {
    //         createNewsEvent(title: String, description: String): NewsEvent
    //         scheduleOperation(name: String!): String!
    //     }
    //     type Subscription  {
    //         # запуск подписки newsFeed будет "слушать" изменения в типе NewsEvent который будет возвращён/обновлён в результате работы резольвера createNewsEvent 
    //         newsFeed: NewsEvent
    //         # запуск подписки operationFinished будет "слушать" изменения в типе Operation
    //         operationFinished: Operation!
    //     }
    // `
    // const resolvers = {
    //     Query: {//NOTE - Apollo сервер обязательно требует резольвер Query 
    //         placeolder: () => {
    //             return true
    //         },        
    //     },
    //     Mutation: {
    //         createNewsEvent: (parent, args) => {
    //             console.log(args)
    //             setTimeout(() => {
    //                 //Запинговать эту мутацию для прослушивания в подписках
    //             pubsub.publish('EVENT_CREATED', { newsFeed: args })//'EVENT_CREATED' - триггер/провайдер этого резольвера для подписок, 
    //             }, 3000)            
    //             return args
    //         },
    //         scheduleOperation: (_, {name}) => {
    //             // mockLongLastingOperation(name)
    //             setTimeout(() => {
    //                 pubsub.publish('OPERATION_FINISHED', {operationFinished: {name, endDate: new Date().toDateString()}})
    //             }, 3000)
    //             return `Operation ${name} scheduled`
    //         }
    //     },
    //     Subscription: {
    //         newsFeed: {
    //             subscribe: () => pubsub.asyncIterator(['EVENT_CREATED'])
    //         },
    //         operationFinished: {
    //             subscribe: () => pubsub.asyncIterator(['OPERATION_FINISHED'])
    //         }
    //     }
    // }
    /**-----------------------------------------------------------------------------------------------------------------------
     *                                       Необходимая логика для интеграции с Express
     *-----------------------------------------------------------------------------------------------------------------------**/
    //ANCHOR - упаковать типы и резольверы в схему
    const schema = (0, schema_1.makeExecutableSchema)({ typeDefs: typeDefs_shad_1.default, resolvers: resolvers_shad_1.default });
    // Для использования Express в начале надо создать объект, который будет представлять приложение
    const app = (0, express_1.default)();
    // Наш httpServer обрабатывает входящие запросы к нашему приложению Express
    const httpServer = http_1.default.createServer(app);
    //===================== WebSocketServer =========================================================//
    //NOTE - этот блок должен располагаться ДО инициализации ApolloServer
    const wsServer = new ws_1.WebSocketServer({
        server: httpServer,
        path: '/graphql' //путь по которому будет обслуживаться должен быть тот-же что и у app.use
    });
    //Передайте схему, которую мы только что создали, и пусть WebSocketServer начнет прослушивание.
    const wsServerCleanup = (0, ws_2.useServer)({ schema }, wsServer); //внедряет wsServer в server(?)
    //----------------------END OF WebSocketServer -------------------------------------------------------// 
    //ANCHOR Создайте экземпляр ApolloServer
    const server = new server_1.ApolloServer({
        //TODO объединить в схему:
        // typeDefs,
        // resolvers,
        schema,
        plugins: [(0, drainHttpServer_1.ApolloServerPluginDrainHttpServer)({ httpServer }),
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
        ], //подключим в сервер модуль для корректного завершения работы сервера.
    });
    // Обратите внимание, что вы должны вызвать `server.start()` на `ApolloServer` экземпляр перед передачей экземпляра в `expressMiddleware
    yield server.start();
    // Настройте наше промежуточное ПО Express для обработки CORS, синтаксического анализа тела и нашей функции expressMiddleware.
    app.use('/graphql', (0, cors_1.default)(corsOptions), //в скобках применим настройки для cors которые создали раньше 
    body_parser_1.default.json(), 
    // json(),
    // Функция expressMiddleware принимает два аргумента. Первый обязательный аргумент — запущенный экземпляр ApolloServer --^
    // Второй необязательный аргумент функции expressMiddleware — это объект для настройки ApolloServer,     
    // который может содержать следующие параметры: context --> Необязательная асинхронная функция инициализации контекста.
    (0, express4_1.expressMiddleware)(server, {
        context: ({ req }) => __awaiter(void 0, void 0, void 0, function* () {
            //в данном примере реализация контекста на основе пакета 'next-auth/react' функцией getSession
            const session = yield (0, react_1.getSession)({ req });
            console.log('CONTEXT SESSION', session);
            return { session };
        })
    }));
    /*---------------------------------------------------- END OF SECTION Express ----------------------------------------------------*/
    const port = process.env.PORT;
    yield new Promise((resolve) => httpServer.listen({ port: 4000 }, resolve));
    console.log(`🚀 Server ready at http://localhost:${port}/graphql`);
    console.log(`🚀 Subscription endpoint ready at ws://localhost:${port}/graphql}`);
});
main().catch((err) => console.log(err));
