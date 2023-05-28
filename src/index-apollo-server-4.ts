/**=======================================================================================================================
 *                                                    Подключение/импорт пакетов и модулей
 *=======================================================================================================================**/

import gql from 'graphql-tag'

import { getSession } from 'next-auth/react'

// @apollo/server — это основная библиотека самого сервера Apollo. Apollo Server умеет преобразовывать HTTP-запросы и ответы в 
// операции GraphQL и запускать их в расширяемом контексте с поддержкой подключаемых модулей и других функций.
import { ApolloServer } from '@apollo/server'

// Функция expressMiddleware позволяет вам подключить сервер Apollo к серверу Express.
import { expressMiddleware } from '@apollo/server/express4'

// Чтобы обеспечить корректное завершение работы вашего сервера, 
//мы рекомендуем использовать подключаемый модуль ApolloServerPluginDrainHttpServer.
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'

//подключим сам express-сервер
import express from 'express'

// Функция expressMiddleware предполагает, что вы настроите синтаксический анализ тела HTTP и 
// заголовки CORS для вашей веб-инфраструктуры. В частности, вы должны установить пакеты body-parser 
// и cors и использовать их для настройки приложения Express, как показано ниже.
import bodyParser from 'body-parser';
// import { json } from 'body-parser';
import cors from 'cors';

//пакет для создания http-сервера
import http from 'http'

import * as dotenv from 'dotenv'

/*-------------------------------- пакеты для работы с подпиской ------------------------------*/


import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws'

import { PubSub } from 'graphql-subscriptions'

/*--------------------------------- подключим схемы и резольверы ------------------------------*/

import typeDefs from './graphql/typeDefs-shad'
import resolvers from './graphql/resolvers-shad'
import { makeExecutableSchema } from '@graphql-tools/schema';//для передачи в сервер websocket нужно упаковать типы и резольверы в схему 

/*==================================================== END OF SECTION Подключения пакетов ===============================================*/



const main = async () => {

    //NOTE - активируем dotenv в данном случае внутри асинхронной функции
    dotenv.config()

    //настройки для успешного обхода CORS
    const corsOptions = {
        origin: process.env.CLIENT_ORIGIN,//получим адрес с которого открыт доступ (http://localhost:3000 - клиент)
        credentials: true
    }


    // interface MyContext {
    //     token?: string;
    // }
    //определить константу отвечающую за подписки
    const pubsub = new PubSub()

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
    const schema = makeExecutableSchema({ typeDefs, resolvers })

    // Для использования Express в начале надо создать объект, который будет представлять приложение
    const app = express()

    // Наш httpServer обрабатывает входящие запросы к нашему приложению Express
    const httpServer = http.createServer(app)

                    //===================== WebSocketServer =========================================================//

                    //NOTE - этот блок должен располагаться ДО инициализации ApolloServer
                    const wsServer = new WebSocketServer({
                        server: httpServer,//Это `httpServer`, который мы создали на предыдущем шаге.
                        path: '/graphql'//путь по которому будет обслуживаться должен быть тот-же что и у app.use
                    })

                    //Передайте схему, которую мы только что создали, и пусть WebSocketServer начнет прослушивание.
                    const wsServerCleanup = useServer({ schema }, wsServer)//внедряет wsServer в server(?)

                    //----------------------END OF WebSocketServer -------------------------------------------------------// 

    
    //ANCHOR Создайте экземпляр ApolloServer
    const server = new ApolloServer({
        //TODO объединить в схему:
        // typeDefs,
        // resolvers,
        schema, 
        plugins: [ApolloServerPluginDrainHttpServer({ httpServer }),

        // Правильное завершение работы сервера WebSocket.
        {
            async serverWillStart() {
                return {
                    async drainServer() {
                        await wsServerCleanup.dispose();
                    },
                };
            },
        },
        ],//подключим в сервер модуль для корректного завершения работы сервера.

    })

    // Обратите внимание, что вы должны вызвать `server.start()` на `ApolloServer` экземпляр перед передачей экземпляра в `expressMiddleware
    await server.start()

    // Настройте наше промежуточное ПО Express для обработки CORS, синтаксического анализа тела и нашей функции expressMiddleware.
    app.use(
        '/graphql',
        cors(corsOptions),//в скобках применим настройки для cors которые создали раньше 
        bodyParser.json(),
        // json(),
        // Функция expressMiddleware принимает два аргумента. Первый обязательный аргумент — запущенный экземпляр ApolloServer --^
        // Второй необязательный аргумент функции expressMiddleware — это объект для настройки ApolloServer,     
        // который может содержать следующие параметры: context --> Необязательная асинхронная функция инициализации контекста.
        expressMiddleware(server, {
            context: async ({ req }) => {
                //в данном примере реализация контекста на основе пакета 'next-auth/react' функцией getSession
                const session = await getSession({ req })

            
                console.log('CONTEXT SESSION', session);
                
                return { session }            
            }

        })
    )

    /*---------------------------------------------------- END OF SECTION Express ----------------------------------------------------*/

    const port= process.env.PORT

    await new Promise<void>((resolve) => httpServer.listen({ port: 4000 }, resolve))
    console.log(`🚀 Server ready at http://localhost:${port}/graphql`)
    console.log(`🚀 Subscription endpoint ready at ws://localhost:${port}/graphql}`)
}

main().catch((err) => console.log(err));
