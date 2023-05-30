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
const graphql_1 = require("graphql");
const client_1 = require("@prisma/client");
const graphql_subscriptions_1 = require("graphql-subscriptions");
const functions_1 = require("../../util/functions");
const conversationResolvers_1 = require("./conversationResolvers");
exports.messageResolvers = {
    Query: {
        //ANCHOR - Запрос на получение сообщений находясь в диалоге
        messages: (_, args, context) => __awaiter(void 0, void 0, void 0, function* () {
            //STEP-1 получим текущ. пользователя(session) и БД(prisma) из контекста
            const { session, prisma } = context;
            //STEP-2 - получим параметр conversationId из типа аргументов для сообщений(деструктуируем)
            const { conversationId } = args;
            //STEP-3 - реализуем условие проверки на наличие текущего пользователя в системе(аутентифицирован/нет)
            if (!(session === null || session === void 0 ? void 0 : session.user)) {
                //если не авторизирован - выведем ошибку на клиенте
                throw new graphql_1.GraphQLError('Not Autthorized');
            }
            //если авторизован, то получим id из БД присвоив ему имя userId для дальнейшего использования в коде резольвера
            const { user: { id: userId } } = session;
            //STEP-4 - убедиться в том что получатель сообщений является участником диалога 
            //STEP-4 .1 Нужно убедиться что данный диалог существует(в БД)
            const conversation = yield prisma.conversation.findUnique({
                where: {
                    id: conversationId
                },
                include: conversationResolvers_1.conversationPopulated
            });
            //STEP-4 .2 Если нет такого диалога
            if (!conversation) {
                throw new graphql_1.GraphQLError('Диалог не найден');
            }
            //STEP-4 .3 определить пользователя. передать 2 аргумента в функцию userIsConversationParticipant: массив участников диалога(participants), id текущего авторизованного пользователя
            const allowedToView = (0, functions_1.userIsConversationParticipant)(conversation.participants, userId); // FUNCTION  - 
            //если не разрешено 
            if (!allowedToView) {
                throw new graphql_1.GraphQLError('У вас нет доступа на просмотр данной ленты сообщений');
            }
            //STEP-5 - при прохождении --^ условий обратимся к БД для получения сообщений
            try {
                const messages = yield prisma.message.findMany({
                    where: {
                        conversationId: conversationId
                    },
                    include: exports.messagePopulated,
                    orderBy: {
                        createdAt: 'desc'
                    }
                });
                return messages;
                // return [{body:'Сообщение 1'} as MessagePopulated]
            }
            catch (error) {
                console.log('messages erros', error);
                throw new graphql_1.GraphQLError(error === null || error === void 0 ? void 0 : error.message);
            }
        })
    },
    Mutation: {
        //ANCHOR - создание сообщений в диалоге
        sendMessage: (_, args, context) => __awaiter(void 0, void 0, void 0, function* () {
            //STEP-1 получим текущ. пользователя(session) и БД(prisma) из контекста
            const { session, prisma, pubsub } = context;
            //STEP-2 - получим аргументы(деструктуируем)
            const { id: messageId, senderId, conversationId, body } = args;
            //STEP-3 - реализуем условие проверки на наличие текущего пользователя в системе(аутентифицирован/нет)
            if (!(session === null || session === void 0 ? void 0 : session.user)) {
                //если не авторизирован - выведем ошибку на клиенте
                throw new graphql_1.GraphQLError('Not Autthorized');
            }
            //если авторизован, то получим id из БД присвоив ему имя userId для дальнейшего использования в коде резольвера
            const { id: ourUerId } = session.user;
            //STEP-4 - добавим проверку - чтобы отправитель сообщения соответствовал авторизованному
            if (ourUerId !== senderId) {
                throw new graphql_1.GraphQLError('У Вас нет прав на отправку сообщений');
            }
            // console.log("HERE IS DATA", args)
            //STEP-5 - создать наше сообщение в БД
            try {
                //STEP-5 .1 создание нового сообщения
                const newMessage = yield prisma.message.create({
                    data: {
                        id: messageId,
                        senderId: senderId,
                        conversationId: conversationId,
                        body: body
                    },
                    include: exports.messagePopulated
                });
                //STEP-5 .2 обновить объект диалога. последнее сообщению присвоить статус прочитанного(?) для отправителя и НЕпрочитанного для всех остальных
                //STEP-5 .2.1 сначала получить текущего участника(отправителя сообщения) из участников-диалога: коллекции conversationParticipant в котором есть текущий пользователь по id польз. и id диалога из аргументов --^ 
                const participant = yield prisma.conversationParticipant.findFirst({
                    where: {
                        userId: ourUerId,
                        conversationId: conversationId,
                    },
                });
                //выполнить проверку 
                if (!participant) {
                    throw new graphql_1.GraphQLError("Participant does not exist");
                }
                //получить id участника из участников-диалога 
                const { id: participantId } = participant;
                //STEP-5 .2.2 обновить диалог в котором состоит участник
                const conversation = yield prisma.conversation.update({
                    where: {
                        id: conversationId
                    },
                    data: {
                        latestMessageId: newMessage.id,
                        participants: {
                            update: {
                                where: {
                                    // id: participantId
                                    id: participant.id
                                },
                                data: {
                                    hasSeenLatestMessage: true
                                }
                            },
                            updateMany: {
                                where: {
                                    userId: {
                                        not: ourUerId //NOTE - произвести инверсивный отбор
                                    }
                                },
                                data: {
                                    hasSeenLatestMessage: false
                                }
                            }
                        }
                    },
                    include: conversationResolvers_1.conversationPopulated
                });
                //STEP-5 .3 - для того что-бы проинформировать участника диалога о том что ему отправлено новое сообщение создать подписку на данную(sendMessage) мутацию
                pubsub.publish('MESSAGE_SENT', {
                    //messageSent - название подписки определённое в messageTypeDefs, а newMessage - полезная нагрузка-триггер на запуск этой подписки
                    messageSent: newMessage //созданное в ШАГЕ 5.1
                });
                //STEP-5 .4 - так-же необходимо создать для информации о том что произошло изменение в диалоге
                //NOTE - ! Эта подписка обрабатывается в резольверах для диалогов( conversationResolvers.ts) и объявлены в conversationsTypeDefs.ts 
                pubsub.publish('CONVERSATION_UPDATED', {
                    conversationUpdated: {
                        conversation //созданное в ШАГЕ 5.2
                    }
                });
            }
            catch (error) {
                console.log('Ошибка при отправлении сообщения', error);
                throw new graphql_1.GraphQLError('Error sending message');
            }
            return true;
        })
    },
    Subscription: {
        //ANCHOR - получение уведомлений об отправленных сообщениях
        messageSent: {
            subscribe: (0, graphql_subscriptions_1.withFilter)((_, __, context) => {
                const { pubsub } = context;
                return pubsub.asyncIterator(['MESSAGE_SENT']);
            }, (payload, args, context) => {
                //сработает только если идентификаторы диалога из аргументов и созданного сообщения совпадают(Для тех участников-диалогов которые имеют этот идентификатор диалога-conversationId(для участников данного диалога))
                return payload.messageSent.conversationId === args.conversationId;
            })
        }
    }
};
exports.messagePopulated = client_1.Prisma.validator()({
    sender: {
        select: {
            id: true,
            username: true
        }
    }
});
