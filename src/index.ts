// import { ApolloServer } from 'apollo-server-express';//NOTE - удалить
import { ApolloServer } from '@apollo/server'
// import { ApolloServerPluginDrainHttpServer, ApolloServerPluginLandingPageLocalDefault } from 'apollo-server-core';//NOTE - удалить
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import express from 'express';
import { expressMiddleware } from '@apollo/server/express4'
import http from 'http';

import typeDefs from './graphql/typeDefs'
import resolvers from './graphql/resolvers'
import { makeExecutableSchema } from '@graphql-tools/schema'

import cors from 'cors'
import { json } from 'body-parser';
import * as dotenv from 'dotenv'

import { getSession } from 'next-auth/react'
import { GraphQLContext, SubscriptionContext, Session } from './util/types'

import { PrismaClient } from '@prisma/client'
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { PubSub } from 'graphql-subscriptions';

async function main() {

    // 1 - активируем dotenv в данном случае внутри асинхронной функции
    dotenv.config()

    // 2 - упаковать типы и резольверы в схему
    const schema = makeExecutableSchema({ typeDefs, resolvers })

    // 3 - создать клиент Prisma
    const prisma = new PrismaClient()

    // 4 - создать экземпляр подписок
    const pubsub = new PubSub()

    // 5 - создать экземпляр от express
    const app = express();

    // 6 - создать сервер http
    const httpServer = http.createServer(app);

    // 7 - создать сервер-ws ===================== WebSocketServer =========================================================//

    // 7.1 Creating the WebSocket server
    const wsServer = new WebSocketServer({
        // 7.1.1This is the `httpServer` we created in a previous step.
        server: httpServer,
        // 7.1.2 Pass a different path here if your ApolloServer serves at a different path.
        path: '/subscriptions',
    });

    // 7.2 - Передайте схему, которую мы только что создали, и пусть WebSocketServer начнет прослушивание.
    const wsServerCleanup = useServer(
        {
            schema,
            //создание контекста для ws-сервера
            context: async (ctx: SubscriptionContext): Promise<GraphQLContext> => {
                if (ctx.connectionParams && ctx.connectionParams.session) {
                    const { session } = ctx.connectionParams

                    return { session, prisma, pubsub }
                }

                //если условие --^ не выполнено то вернём только клиента-prisma, экземпляр подписок - pubsub и нулевое значение для сессии
                //это будет иметь место когда пользователь не вошёл в систему 
                return { session: null, prisma, pubsub }
            }
        },
        wsServer
    )
    //----------------------END OF WebSocketServer -------------------------------------------------------//     

    // 8 - создать сервер Apollo
    const server = new ApolloServer({
        schema,
        csrfPrevention: true,
        // context: async ({req, res}): Promise<GraphQLContext> => {
        //     const session = await getSession(
        //         req,
        //         process.env.CLIENT_ORIGIN
        //     )
        //         return (session, prisma)
        // },
        plugins: [
            // Правильное завершение работы HTTP-сервера.
            ApolloServerPluginDrainHttpServer({ httpServer }),

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
            // ApolloServerPluginLandingPageLocalDefault({ embed: true }) //NOTE - удалить
        ],
    });

    // 9 - запустить сервер --^
    await server.start();
    // server.applyMiddleware({ app, cors: corsOptions });//NOTE - удалить

    // 10 - настройки для успешного обхода CORS
    const corsOptions = {
        origin: process.env.CLIENT_ORIGIN,//получим адрес с которого открыт доступ (http://localhost:3000 - клиент)
        // origin: "https://imessage-clone-client.vercel.app",//получим адрес с которого открыт доступ (http://localhost:3000 - клиент)
        credentials: true
    }

    // 11 - 
    app.use(
        '/',
        cors<cors.CorsRequest>(corsOptions),//в скобках применим настройки для cors которые создали раньше 
        json(),
        // Функция expressMiddleware принимает два аргумента. Первый обязательный аргумент — запущенный экземпляр ApolloServer --^
        // Второй необязательный аргумент функции expressMiddleware — это объект для настройки ApolloServer,     
        // который может содержать следующие параметры: context --> Необязательная асинхронная функция инициализации контекста.
        expressMiddleware(server, {
            context: async ({ req, res }): Promise<GraphQLContext> => {//применить типы для контекста (через промис?)// для асинхронных функций типы передаются через промис
                //в данном примере реализация контекста на основе пакета 'next-auth/react' функцией getSession
                const session = await getSession({ req })
                
                const cookies = req?.headers?.cookie
                const parsedCookies = require('cookie').parse(cookies)
                const sessionToken = parsedCookies['next-auth.session-token']
                if(sessionToken) {
                    const sessionResponse = await fetch(
                        'https://imessage-clone-client.vercel.app/',
                        {
                            headers: {
                                Cookie: `next-auth.session-token=${sessionToken}`
                            }
                        }
                    )

                    const sessionData = await sessionResponse.json()
                    console.log("sessionData", sessionData)
                    return { session: sessionData, prisma, pubsub }
                }
                // console.log(cookies)
                // console.log(parsedCookies)    
                // console.log('CONTEXT SESSION', session?.user);

                // вернём в КОНТЕКСТ: 
                // данные сессии/сеанса(утентифицированного польз.), 
                // доступ к БД через prisma
                // экземпляр подписок - pubsub
                return { session: session as Session, prisma, pubsub }
            }
        })
    )

    const PORT = process.env.PORT || 4000

    await new Promise<void>((resolve) => httpServer.listen({ port: PORT }, resolve));
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
}

// 11 - запуск --^
main().catch((err) => console.log(err));