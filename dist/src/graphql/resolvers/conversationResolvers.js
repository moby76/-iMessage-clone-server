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
exports.conversationPopulated = exports.participantPopulated = exports.conversationResolvers = void 0;
// import { GraphQLError } from "apollo-server-core";
const graphql_1 = require("graphql");
const client_1 = require("@prisma/client");
const graphql_subscriptions_1 = require("graphql-subscriptions");
const functions_1 = require("../../util/functions");
exports.conversationResolvers = {
    Query: {
        conversations: (_, __, context) => __awaiter(void 0, void 0, void 0, function* () {
            // console.log('Запрос на диалоги');
            //STEP-1 получим текущ. пользователя(session) и БД(prisma) из контекста
            const { session, prisma } = context;
            //STEP-2 - реализуем условие проверки на наличие текущего пользователя в системе(аутентифицирован/нет)
            if (!(session === null || session === void 0 ? void 0 : session.user)) {
                //если не авторизирован - выведем ошибку на клиенте
                throw new graphql_1.GraphQLError('Not Autthorized');
            }
            //если авторизован, то получим id из БД присвоив ему имя userId для дальнейшего использования в коде резольвера
            const { user: { id: userId } } = session;
            //STEP-4 - выполним запрос к БД с целью получения
            try {
                //получить из БД все диалоги к которым принадлежит данный пользователь         
                const conversations = yield prisma.conversation.findMany({
                    /**
                     * Below has been confirmed to be the correct
                     * query by the Prisma team. Has been confirmed
                     * that there is an issue on their end
                     * Issue seems specific to Mongo
                     */
                    where: {
                        participants: {
                            every: {
                                userId: {
                                    equals: userId,
                                },
                            },
                        },
                    },
                    include: exports.conversationPopulated
                });
                return conversations;
                /**
                * Since above query does not work(Так-как этот --^ запрос не работает)
                */
                // return conversations.filter(
                //     (conversation) =>
                //         !!conversation.participants.find((p) => p.userId === userId)
                // );
            }
            catch (error) {
                console.log('Ошибка запроса диалогов', error);
                throw new graphql_1.GraphQLError(error === null || error === void 0 ? void 0 : error.message);
            }
        })
    },
    Mutation: {
        createConversation: (_, args, context) => __awaiter(void 0, void 0, void 0, function* () {
            // console.log('INSIDE createConversation Mutation', args);
            //STEP-1 - получим массив id учасиников обсуждения
            const { participantIds } = args;
            //STEP-2 получим текущ. пользователя(session) и БД(prisma) из контекста
            const { session, prisma, pubsub } = context;
            //STEP-3 - реализуем условие проверки на наличие текущего пользователя в системе(аутентифицирован/нет)
            if (!(session === null || session === void 0 ? void 0 : session.user)) {
                //если не авторизирован - выведем ошибку на клиенте
                throw new graphql_1.GraphQLError('Not Autthorized');
            }
            //если авторизован, то получим id из БД присвоив ему имя userId для дальнейшего использования в коде резольвера
            // const { user: { id: userId } } = session//1-й вариант получить id авторизованного пользователя(как в уроке)
            // const { id: userId } = session.user//2-й вариант получить id авторизованного пользователя
            const { user: { id: userId } } = session;
            // console.log('User', session.user);      
            //STEP-4 - выполним запрос к БД с целью создания/заполнения диалога Conversation
            try {
                //создать ... 
                const conversation = yield prisma.conversation.create({
                    data: {
                        participants: {
                            createMany: {
                                //для этого нужно преобразовать массив из id участников и присвоить каждому значение поля userId модели ConversationParticipant значение = id участника
                                data: participantIds.map((id) => ({
                                    userId: id,
                                    hasSeenLatestMessage: id === userId // нужно инициировать логическое значение поля hasSeenLatestMessage ДЛЯ СОЗДАВШЕГО ДИАЛОГ. Задаём ему true, т.к. id соответствует userId. Для других оно будет false, пока они не подтвердят/не откроют диалог
                                }))
                            }
                        }
                    },
                    include: exports.conversationPopulated // переменную conversationPopulated на основе шаблона заполненных полей созданных при помощи Prisma.validator<Prisma.ConversationInclude>
                });
                //эмитировать событие CONVERSATION_CREATED для использования подписки pubSub 
                pubsub.publish('CONVERSATION_CREATED', {
                    // эта подписка - conversationCreated с передачей в него переменной conversation с созданными данными в качестве полезной нагрузки
                    conversationCreated: conversation
                });
                //вернём поле conversationId(которое определено в graphQL-типе CreateConversationResponse (conversationTypeDefs.ts) )
                return { conversationId: conversation.id }; // полю conversationId присваивается значение идентификатора переменной conversation(модели/коллекции Conversation )
            }
            catch (error) {
                console.log('Ошибка создания диалога', error);
                throw new graphql_1.GraphQLError('Ошибка сервера при создания диалога');
            }
        }),
        markConversationAsRead: (_, args, context) => __awaiter(void 0, void 0, void 0, function* () {
            const { session, prisma } = context;
            const { userId, conversationId } = args;
            if (!(session === null || session === void 0 ? void 0 : session.user)) {
                //если не авторизирован - выведем ошибку на клиенте
                throw new graphql_1.GraphQLError('Not Autthorized');
            }
            try {
                const participant = yield prisma.conversationParticipant.findFirst({
                    where: {
                        userId,
                        conversationId,
                    },
                });
                if (!participant) {
                    throw new graphql_1.GraphQLError("Participant entity not found");
                }
                yield prisma.conversationParticipant.update({
                    where: {
                        id: participant.id
                    },
                    data: {
                        hasSeenLatestMessage: true
                    }
                });
                return true;
            }
            catch (error) {
                console.log('markConversationAsRead error', error);
                throw new graphql_1.GraphQLError(error === null || error === void 0 ? void 0 : error.message);
            }
        }),
        deleteConversation: (_, args, context) => __awaiter(void 0, void 0, void 0, function* () {
            const { session, prisma, pubsub } = context;
            const { conversationId } = args;
            if (!(session === null || session === void 0 ? void 0 : session.user)) {
                //если не авторизирован - выведем ошибку на клиенте
                throw new graphql_1.GraphQLError('Not Autthorized');
            }
            try {
                // Нужно удалить из БД как диалог - conversation, так и участника диалога - conversationParticipant, и сообщения которые привязаны к диалогу - messages
                // Будет реализовано с помощью транзакции-БД(за один проход), удаляется всё что принадлежит этому диалогу, или ничего. Если не возможно удалить хот одну сущьность, то и всё остальное нельзя удалить
                //REVIEW - LINK - (https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
                const [deletedConversation] = yield prisma.$transaction([
                    prisma.conversation.delete({
                        where: {
                            id: conversationId
                        },
                        include: exports.conversationPopulated
                    }),
                    prisma.conversationParticipant.deleteMany({
                        where: {
                            conversationId: conversationId
                        }
                    }),
                    prisma.message.deleteMany({
                        where: {
                            conversationId: conversationId
                        }
                    })
                ]);
                pubsub.publish("CONVERSATION_DELETED", {
                    conversationDeleted: deletedConversation //подписка conversationDeleted будет активировать созданную --^ транзакцию deletedConversation
                });
            }
            catch (error) {
                console.log('deleteConversation error', error);
                throw new graphql_1.GraphQLError(error === null || error === void 0 ? void 0 : error.message);
            }
            return true;
        })
    },
    Subscription: {
        //ANCHOR - подписка на создание диалога
        conversationCreated: {
            // subscribe: (_: any, __: any, context: GraphQLContext, info: any) => {
            //     //получим экземпляр PubSub из контекста
            //     const { pubsub } = context
            //     //запуск прослушивания события CONVERSATION_CREATED - создание нового диалога
            //     return pubsub.asyncIterator(['CONVERSATION_CREATED'])
            // }
            //NOTE - данный код --^ произведёт рассылку всем участникам. Для того чтобы отправка произошла только выбранному 
            // нужно использовать функционал метода withFilter из пакета "graphql-subscriptions". Описание: https://www.apollographql.com/docs/apollo-server/v3/data/subscriptions/#filtering-events
            // РАССЫЛКУ ПОЛУЧИТ лишь указанный во втором параметре функции withFilter
            // принимает 2 параметра
            subscribe: (0, graphql_subscriptions_1.withFilter)(
            //() => pubsub.asyncIterator('COMMENT_ADDED'),
            //Первый параметр — это именно та функция, которую вы использовали бы для подписки, если бы не применяли фильтр.
            (_, __, context, info) => {
                //получим экземпляр PubSub из контекста
                const { pubsub } = context;
                //запуск прослушивания события CONVERSATION_CREATED - создание нового диалога
                return pubsub.asyncIterator(['CONVERSATION_CREATED']);
            }, 
            //Второй параметр — это функция фильтра, которая возвращает true, если обновление подписки должно быть отправлено конкретному клиенту, и false в противном случае (также допускается Promise<boolean>). 
            //Эта функция принимает два собственных параметра:
            //  полезная нагрузка — это полезная нагрузка опубликованного события.
            //  переменные — это объект, содержащий все аргументы, предоставленные клиентом при инициации подписки.(в нашем случае переменных не будет)
            (payload, _, context) => {
                const { session } = context; //получим данные сессии из контекста для сопоставления 
                if (!(session === null || session === void 0 ? void 0 : session.user)) {
                    throw new graphql_1.GraphQLError("Not authorized");
                }
                const { id: userId } = session.user;
                const { conversationCreated: { participants } } = payload; // получим участников из части шаблона conversationCreated
                //сопоставим для успешного совмещения(участника которому отправляется диалог). 
                //Метод Array.find(Метод JS). найдём из массива participants --> ConversationParticipant[] в модели Prisma
                // если при переборе массива participants найдём соответствующего условию участника - то вернётся положительное значение(true), иначе вернёт отрицательное (false)
                // const userIsParticipant = !!participants.find(p => p.userId === session?.user?.id)//!! - логическое "утверждение(true)"
                // вынести это --^ в отдельную функцию userIsConversationParticipant( файл util/functions ) и передать в неё аргументы participants и userId
                const userIsParticipant = (0, functions_1.userIsConversationParticipant)(participants, userId); //NOTE - это вернёт логическое значение
                // если участник подтверждён - вернём true
                return userIsParticipant;
            })
        },
        //ANCHOR - подписка на обновление в диалогах при создании сообщения . Только для участника диалога.
        conversationUpdated: {
            subscribe: (0, graphql_subscriptions_1.withFilter)(
            //Арг. 1.
            (_, __, context) => {
                const { pubsub } = context;
                return pubsub.asyncIterator(['CONVERSATION_UPDATED']); //NOTE - Из резольвера сообщений !
            }, 
            //Арг. 2.
            (payload, _, context) => {
                const { session } = context;
                // console.log('Это нагрузка из подписки на изменение диалога', payload)
                if (!(session === null || session === void 0 ? void 0 : session.user)) {
                    throw new graphql_1.GraphQLError("Not authorized");
                }
                const { id: userId } = session.user;
                // полчим пользователей(participants) диалога из шаблона для нагрузки  
                const { conversationUpdated: { conversation: { participants } } } = payload;
                //сопоставим для успешного совмещения(участника которому отправляется диалог)                  
                const userIsParticipant = (0, functions_1.userIsConversationParticipant)(participants, userId); //NOTE - это вернёт логическое значение
                return userIsParticipant; // = return true
            })
        },
        //ANCHOR - подписка на удаление диалога
        conversationDeleted: {
            subscribe: (0, graphql_subscriptions_1.withFilter)((_, __, context) => {
                const { pubsub } = context;
                return pubsub.asyncIterator(["CONVERSATION_DELETED"]);
            }, (payload, _, context) => {
                const { session } = context;
                if (!(session === null || session === void 0 ? void 0 : session.user)) {
                    throw new graphql_1.GraphQLError("Not authorized");
                }
                const { id: userId } = session.user;
                const { conversationDeleted: { participants }, } = payload;
                return (0, functions_1.userIsConversationParticipant)(participants, userId);
            }),
        },
    }
};
//------------SECTION----------- - Создание сгенерированных типов для переиспользования их в коде --------------
// создадим переменную с помощью "сгенерированного типа" Призмы для переиспользования в других частях кода на основе заполнения данных для участников диалога
exports.participantPopulated = client_1.Prisma.validator()({
    user: {
        // и разрешим только id  и имя пользователя
        select: {
            id: true,
            username: true
        }
    }
});
// создадим переменную conversationPopulated с помощью "сгенерированного типа" Призмы для переиспользования в других частях кода на основе заполнения данных для диалогов с помощью компонента Призмы - validator
exports.conversationPopulated = client_1.Prisma.validator()({
    participants: {
        include: exports.participantPopulated // переменная с заполненными занными участников диалога 
    },
    // и id и имя отправителя последнего сообщения
    latestMessage: {
        include: {
            sender: {
                // и так-же разрешим только id  и имя пользователя
                select: {
                    id: true,
                    username: true
                }
            }
        }
    }
});
// ----------------------------------------------------------------------------------------------------------
