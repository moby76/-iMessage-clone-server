/**=======================================================================================================================
 *                                                    Подключение/импорт пакетов и модулей
 *=======================================================================================================================**/

import gql from 'graphql-tag'

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
import cors from 'cors';

//пакет для создания http-сервера
import http from 'http'

/*-------------------------------- пакеты для работы с подпиской ------------------------------*/

import { makeExecutableSchema } from '@graphql-tools/schema';//для передачи в сервер websocket нужно упаковать типы и резольверы в схему 
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws'

import { PubSub } from 'graphql-subscriptions'

/*==================================================== END OF SECTION Подключения пакетов ===============================================*/

//определить константу отвечающую за подписки
const pubsub = new PubSub()

//Определим функцию в которой отрабатывается подписка operationFinished с триггером OPERATION_FINISHED //NOTE - перенесено внутрь резольвера 
// const mockLongLastingOperation = (name) => {
//     setTimeout(() => {
//         pubsub.publish('OPERATION_FINISHED', {operationFinished: {name, endDate: new Date().toDateString()}})
//     }, 3000)
// }


/**-----------------------------------------------------------------------------------------------------------------------
 *                                       Определение схемы и резольверы             
 *-----------------------------------------------------------------------------------------------------------------------**/
const typeDefs = gql`
    type Operation{
        name: String!
        endDate: String!
    }

    type  Query  {
        foo: String
    }
    # Мутация которая принимает только параметр name 
    type Mutation {
        scheduleOperation(name: String!): String!
    }

    type Subscription  {
        operationFinished: Operation!
    }
`

const resolvers = {
    Query: {//NOTE - Apollo сервер обязательно требует резольвер Query 
        foo: () => {
            return 'Thats ok!'
        },        
    },
    Mutation: {        
        scheduleOperation: (_, {name}) => {
            //Определим функцию в которой отрабатывается подписка operationFinished с триггером OPERATION_FINISHED
            // mockLongLastingOperation(name)
            setTimeout(() => {
                pubsub.publish('OPERATION_FINISHED', {operationFinished: {name, endDate: new Date().toDateString()}})
            }, 3000)
            return `Operation ${name} scheduled`
        }
    },
    Subscription: {
        operationFinished: {
            subscribe: () => pubsub.asyncIterator(['OPERATION_FINISHED'])//subscribe - метод
                                                                         //asyncIterator - асинхронный итератор для перебора асинхронных результатов
                                                                         //будет ожидать запуска определённого события и реакции пользователя на это событие
            }
    }
}

/*----------------------------------------- END OF SECTION схемы и резольверов ------------------------------------------------*/


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

            // Создайте экземпляр ApolloServer
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
    cors(),
    bodyParser.json(),
    // Функция expressMiddleware принимает два аргумента. Первый обязательный аргумент — запущенный экземпляр ApolloServer-(server) --^
    // Второй необязательный аргумент функции expressMiddleware — это объект для настройки ApolloServer,     
    // который может содержать следующие параметры: context --> Необязательная асинхронная функция инициализации контекста.
    expressMiddleware(server, {
        context: async ({ req }) => ({ token: req.headers.token }),//Функция контекста получает параметры req и res, которые являются объектами express.Request и express.Response.
    })
)

/*---------------------------------------------------- END OF SECTION Express ----------------------------------------------------*/



await new Promise((resolve) => httpServer.listen({ port: 3000 }, resolve))
console.log(`🚀 Server ready at http://localhost:3000/graphql`)
console.log(`🚀 Subscription endpoint ready at ws://localhost:3000/graphql}`)

    