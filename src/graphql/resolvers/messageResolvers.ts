import { GraphQLError } from "graphql";
import { GraphQLContext, MessagePopulated, MessageSentSubscriptionPayload, SendMessageArguments } from "../../util/types";
import { Prisma } from "@prisma/client";
import { withFilter } from "graphql-subscriptions";
import { userIsConversationParticipant } from "../../util/functions";
import { conversationPopulated } from "./conversationResolvers";

export const messageResolvers = {
    Query: {
        //ANCHOR - Запрос на получение сообщений находясь в диалоге
        messages: async (_: any, args: SendMessageArguments, context: GraphQLContext): Promise<Array<MessagePopulated>> => {
            //STEP-1 получим текущ. пользователя(session) и БД(prisma) из контекста
            const { session, prisma } = context

            //STEP-2 - получим параметр conversationId из типа аргументов для сообщений(деструктуируем)
            const { conversationId } = args

            //STEP-3 - реализуем условие проверки на наличие текущего пользователя в системе(аутентифицирован/нет)
            if (!session?.user) {
                //если не авторизирован - выведем ошибку на клиенте
                throw new GraphQLError('Not Autthorized')
            }
            //если авторизован, то получим id из БД присвоив ему имя userId для дальнейшего использования в коде резольвера
            const { user: { id: userId } } = session

            //STEP-4 - убедиться в том что получатель сообщений является участником диалога 
            //STEP-4 .1 Нужно убедиться что данный диалог существует(в БД)
            const conversation = await prisma.conversation.findUnique({
                where: {
                    id: conversationId
                },
                include: conversationPopulated
            })
            //STEP-4 .2 Если нет такого диалога
            if (!conversation) {
                throw new GraphQLError('Диалог не найден')
            }

            //STEP-4 .3 определить пользователя. передать 2 аргумента в функцию userIsConversationParticipant: массив участников диалога(participants), id текущего авторизованного пользователя
            const allowedToView = userIsConversationParticipant(conversation.participants, userId)// FUNCTION  - 

            //если не разрешено 
            if (!allowedToView) {
                throw new GraphQLError('У вас нет доступа на просмотр данной ленты сообщений')
            }

            //STEP-5 - при прохождении --^ условий обратимся к БД для получения сообщений
            try {
                const messages = await prisma.message.findMany({
                    where: {
                        conversationId: conversationId
                    },
                    include: messagePopulated,
                    orderBy: {// и отсортировать их по мере убывания
                        createdAt: 'desc'
                    }
                })

                return messages
                // return [{body:'Сообщение 1'} as MessagePopulated]
            } catch (error: any) {
                console.log('messages erros', error);
                throw new GraphQLError(error?.message)
            }
        }
    },
    Mutation: {
        //ANCHOR - создание сообщений в диалоге
        sendMessage: async (_: any, args: SendMessageArguments, context: GraphQLContext): Promise<boolean> => {

            //STEP-1 получим текущ. пользователя(session) и БД(prisma) из контекста
            const { session, prisma, pubsub } = context

            //STEP-2 - получим аргументы(деструктуируем)
            const { id: messageId, senderId, conversationId, body } = args

            //STEP-3 - реализуем условие проверки на наличие текущего пользователя в системе(аутентифицирован/нет)
            if (!session?.user) {
                //если не авторизирован - выведем ошибку на клиенте
                throw new GraphQLError('Not Autthorized')
            }
            //если авторизован, то получим id из БД присвоив ему имя userId для дальнейшего использования в коде резольвера
            const { id: ourUerId } = session.user

            //STEP-4 - добавим проверку - чтобы отправитель сообщения соответствовал авторизованному
            if (ourUerId !== senderId) {
                throw new GraphQLError('У Вас нет прав на отправку сообщений')
            }

            // console.log("HERE IS DATA", args)

            //STEP-5 - создать наше сообщение в БД
            try {

                //STEP-5 .1 создание нового сообщения
                const newMessage = await prisma.message.create({
                    data: {
                        id: messageId,
                        senderId: senderId,
                        conversationId: conversationId,
                        body: body
                    },
                    include: messagePopulated
                })

                //STEP-5 .2 обновить объект диалога. последнее сообщению присвоить статус прочитанного(?) для отправителя и НЕпрочитанного для всех остальных

                //STEP-5 .2.1 сначала получить текущего участника(отправителя сообщения) из участников-диалога: коллекции conversationParticipant в котором есть текущий пользователь по id польз. и id диалога из аргументов --^ 
                const participant = await prisma.conversationParticipant.findFirst({
                    where: {
                        userId: ourUerId,
                        conversationId: conversationId,
                    },
                });

                //выполнить проверку 
                if (!participant) {
                    throw new GraphQLError("Participant does not exist");
                }
                //получить id участника из участников-диалога 
                const { id: participantId } = participant

                //STEP-5 .2.2 обновить диалог в котором состоит участник
                const conversation = await prisma.conversation.update({
                    where: {// обновить тот диалог у которого id совпадает с id из args
                        id: conversationId
                    },
                    data: {//обновляем в данных id последнего сообщения на id нашего только что созданного сообщения
                        latestMessageId: newMessage.id,
                        participants: {//и обновить значение hasSeenLatestMessage в поле participants --> ссылочное на массив ConversationParticipant[]
                            update: {// 1. обновить для одного
                                where: {// в котором (массиве участников) id = id отправителя сообщения
                                    // id: participantId
                                    id: participant.id
                                },
                                data: {//и меняем значение последнего сообщение (hasSeenLatestMessage) на просмотренное(true)
                                    hasSeenLatestMessage: true
                                }
                            },
                            updateMany: { // 2. обновить все остальные (кроме текущего)
                                where: {
                                    userId: {//
                                        not: ourUerId//NOTE - произвести инверсивный отбор
                                    }
                                },
                                data: {//и меняем значение последнего сообщения (hasSeenLatestMessage) на Непросмотренное(false)
                                    hasSeenLatestMessage: false
                                }
                            }
                        }
                    },
                    include: conversationPopulated
                })

                //STEP-5 .3 - для того что-бы проинформировать участника диалога о том что ему отправлено новое сообщение создать подписку на данную(sendMessage) мутацию
                pubsub.publish('MESSAGE_SENT', {
                    //messageSent - название подписки определённое в messageTypeDefs, а newMessage - полезная нагрузка-триггер на запуск этой подписки
                    messageSent: newMessage //созданное в ШАГЕ 5.1
                })
                //STEP-5 .4 - так-же необходимо создать для информации о том что произошло изменение в диалоге
                //NOTE - ! Эта подписка обрабатывается в резольверах для диалогов( conversationResolvers.ts) и объявлены в conversationsTypeDefs.ts 
                pubsub.publish('CONVERSATION_UPDATED', {
                    conversationUpdated: {
                        conversation //созданное в ШАГЕ 5.2
                    }
                })

            } catch (error) {
                console.log('Ошибка при отправлении сообщения', error);
                throw new GraphQLError('Error sending message')
            }

            return true
        }
    },
    Subscription: {
        //ANCHOR - получение уведомлений об отправленных сообщениях
        messageSent: {
            subscribe: withFilter(
                (_: any, __: any, context: GraphQLContext) => {
                    const { pubsub } = context
                    return pubsub.asyncIterator(['MESSAGE_SENT'])
                },
                ( payload: MessageSentSubscriptionPayload,  args: { conversationId: string }, context: GraphQLContext) => {
                    //сработает только если идентификаторы диалога из аргументов и созданного сообщения совпадают(Для тех участников-диалогов которые имеют этот идентификатор диалога-conversationId(для участников данного диалога))
                    return payload.messageSent.conversationId === args.conversationId
                }
            )
        }
    }
}

export const messagePopulated = Prisma.validator<Prisma.MessageInclude>()({
    sender: {
        select: {
            id: true,
            username: true
        }
    }
})