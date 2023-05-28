// import { GraphQLError } from "apollo-server-core";
import { GraphQLError } from "graphql";
import { 
    ConversationCreatedSubscriptionPayload,
    ConversationDeletedSubscriptionPayload, 
    ConversationPopulated, 
    ConversationUpdatedSubscriptionPayload, 
    GraphQLContext 
    } from "../../util/types";
import { Prisma } from "@prisma/client";
import { withFilter } from "graphql-subscriptions";
import { userIsConversationParticipant } from "../../util/functions";

export const conversationResolvers = {
    Query: {
        conversations: async (_: any, __: any, context: GraphQLContext): Promise<Array<ConversationPopulated>> => {
            // console.log('Запрос на диалоги');
            //STEP-1 получим текущ. пользователя(session) и БД(prisma) из контекста
            const { session, prisma } = context

            //STEP-2 - реализуем условие проверки на наличие текущего пользователя в системе(аутентифицирован/нет)
            if (!session?.user) {
                //если не авторизирован - выведем ошибку на клиенте
                throw new GraphQLError('Not Autthorized')
            }
            //если авторизован, то получим id из БД присвоив ему имя userId для дальнейшего использования в коде резольвера
            const { user: { id: userId } } = session

            //STEP-4 - выполним запрос к БД с целью получения
            try {
                //получить из БД все диалоги к которым принадлежит данный пользователь         
                const conversations = await prisma.conversation.findMany({
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
                    include: conversationPopulated
                })
                return conversations
                /**
                * Since above query does not work(Так-как этот --^ запрос не работает)
                */
                // return conversations.filter(
                //     (conversation) =>
                //         !!conversation.participants.find((p) => p.userId === userId)
                // );
            } catch (error: any) {
                console.log('Ошибка запроса диалогов', error);
                throw new GraphQLError(error?.message)
            }
        }
    },
    Mutation: {
        createConversation: async (_: any, args: { participantIds: Array<string> }, context: GraphQLContext): Promise<{ conversationId: string }> => {
            // console.log('INSIDE createConversation Mutation', args);

            //STEP-1 - получим массив id учасиников обсуждения
            const { participantIds } = args

            //STEP-2 получим текущ. пользователя(session) и БД(prisma) из контекста
            const { session, prisma, pubsub } = context

            //STEP-3 - реализуем условие проверки на наличие текущего пользователя в системе(аутентифицирован/нет)
            if (!session?.user) {
                //если не авторизирован - выведем ошибку на клиенте
                throw new GraphQLError('Not Autthorized')
            }
            //если авторизован, то получим id из БД присвоив ему имя userId для дальнейшего использования в коде резольвера
            // const { user: { id: userId } } = session//1-й вариант получить id авторизованного пользователя(как в уроке)
            // const { id: userId } = session.user//2-й вариант получить id авторизованного пользователя
            const { user: { id: userId } } = session
            // console.log('User', session.user);      

            //STEP-4 - выполним запрос к БД с целью создания/заполнения диалога Conversation
            try {
                //создать ... 
                const conversation = await prisma.conversation.create({
                    data: {//1. создаём данные(data) которые будут храниться в создаваемом документе. Это будут значения любого из полей модели Conversation
                        participants: {// заполнить массив с участниками диалога participants --> ConversationParticipant[](массив модели/коллекции ConversationParticipant)
                            createMany: {// коммандой createMany создать данные для вложенного/связанной модели/коллекции --^
                                //для этого нужно преобразовать массив из id участников и присвоить каждому значение поля userId модели ConversationParticipant значение = id участника
                                data: participantIds.map((id) => ({
                                    userId: id,
                                    hasSeenLatestMessage: id === userId // нужно инициировать логическое значение поля hasSeenLatestMessage ДЛЯ СОЗДАВШЕГО ДИАЛОГ. Задаём ему true, т.к. id соответствует userId. Для других оно будет false, пока они не подтвердят/не откроют диалог
                                }))
                            }
                        }
                    },
                    include: conversationPopulated // переменную conversationPopulated на основе шаблона заполненных полей созданных при помощи Prisma.validator<Prisma.ConversationInclude>
                })

                //эмитировать событие CONVERSATION_CREATED для использования подписки pubSub 
                pubsub.publish('CONVERSATION_CREATED', {
                    // эта подписка - conversationCreated с передачей в него переменной conversation с созданными данными в качестве полезной нагрузки
                    conversationCreated: conversation
                })

                //вернём поле conversationId(которое определено в graphQL-типе CreateConversationResponse (conversationTypeDefs.ts) )
                return { conversationId: conversation.id }// полю conversationId присваивается значение идентификатора переменной conversation(модели/коллекции Conversation )
            } catch (error) {
                console.log('Ошибка создания диалога', error);
                throw new GraphQLError('Ошибка сервера при создания диалога')
            }
        },
        markConversationAsRead: async (_: any, args: { userId: string, conversationId: string }, context: GraphQLContext): Promise<boolean> => {

            const { session, prisma } = context
            const { userId, conversationId } = args

            if (!session?.user) {
                //если не авторизирован - выведем ошибку на клиенте
                throw new GraphQLError('Not Autthorized')
            }

            try {
                const participant = await prisma.conversationParticipant.findFirst({
                    where: {
                        userId,
                        conversationId,
                    },
                });

                if (!participant) {
                    throw new GraphQLError("Participant entity not found");
                }

                await prisma.conversationParticipant.update({
                    where: {
                        id: participant.id
                    },
                    data: {
                        hasSeenLatestMessage: true
                    }
                })
                return true
            } catch (error: any) {
                console.log('markConversationAsRead error', error);
                throw new GraphQLError(error?.message)
            }
        },
        deleteConversation: async (_: any, args: { conversationId: string }, context: GraphQLContext): Promise<boolean> => {
            const { session, prisma, pubsub } = context
            const { conversationId } = args
            if (!session?.user) {
                //если не авторизирован - выведем ошибку на клиенте
                throw new GraphQLError('Not Autthorized')
            }

            try {
                // Нужно удалить из БД как диалог - conversation, так и участника диалога - conversationParticipant, и сообщения которые привязаны к диалогу - messages
                // Будет реализовано с помощью транзакции-БД(за один проход), удаляется всё что принадлежит этому диалогу, или ничего. Если не возможно удалить хот одну сущьность, то и всё остальное нельзя удалить
                //REVIEW - LINK - (https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
                const [deletedConversation] = await prisma.$transaction([// создать массив-переменную-сущьность deletedConversation
                    prisma.conversation.delete({
                        where: {
                            id: conversationId
                        },
                        include: conversationPopulated
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
                ])

                pubsub.publish("CONVERSATION_DELETED", {
                    conversationDeleted: deletedConversation //подписка conversationDeleted будет активировать созданную --^ транзакцию deletedConversation
                });
            } catch (error: any) {
                console.log('deleteConversation error', error);
                throw new GraphQLError(error?.message)
            }

            return true
        }
    },
    Subscription: {
        //ANCHOR - подписка на создание диалога
        conversationCreated: {//эта подписка должна обновлять соответствующий компонент на фронтэнде при любом изменении/создании данных в мутации createConversation. В нашем случае - это компонент <ConversationsWrapper>
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
            subscribe: withFilter(
                //() => pubsub.asyncIterator('COMMENT_ADDED'),
                //Первый параметр — это именно та функция, которую вы использовали бы для подписки, если бы не применяли фильтр.
                (_: any, __: any, context: GraphQLContext, info: any) => {
                    //получим экземпляр PubSub из контекста
                    const { pubsub } = context
                    //запуск прослушивания события CONVERSATION_CREATED - создание нового диалога
                    return pubsub.asyncIterator(['CONVERSATION_CREATED'])
                },
                //Второй параметр — это функция фильтра, которая возвращает true, если обновление подписки должно быть отправлено конкретному клиенту, и false в противном случае (также допускается Promise<boolean>). 
                //Эта функция принимает два собственных параметра:
                //  полезная нагрузка — это полезная нагрузка опубликованного события.
                //  переменные — это объект, содержащий все аргументы, предоставленные клиентом при инициации подписки.(в нашем случае переменных не будет)
                (payload: ConversationCreatedSubscriptionPayload, _: any, context: GraphQLContext) => {
                    const { session } = context//получим данные сессии из контекста для сопоставления 

                    if (!session?.user) {
                        throw new GraphQLError("Not authorized");
                    }
                    const { id: userId } = session.user
                    const { conversationCreated: { participants } } = payload// получим участников из части шаблона conversationCreated
                    //сопоставим для успешного совмещения(участника которому отправляется диалог). 
                    //Метод Array.find(Метод JS). найдём из массива participants --> ConversationParticipant[] в модели Prisma
                    // если при переборе массива participants найдём соответствующего условию участника - то вернётся положительное значение(true), иначе вернёт отрицательное (false)
                    // const userIsParticipant = !!participants.find(p => p.userId === session?.user?.id)//!! - логическое "утверждение(true)"
                    // вынести это --^ в отдельную функцию userIsConversationParticipant( файл util/functions ) и передать в неё аргументы participants и userId
                    const userIsParticipant = userIsConversationParticipant(participants, userId) //NOTE - это вернёт логическое значение
                    // если участник подтверждён - вернём true
                    return userIsParticipant
                }
            )
        },
        //ANCHOR - подписка на обновление в диалогах при создании сообщения . Только для участника диалога.
        conversationUpdated: {
            subscribe: withFilter(
                //Арг. 1.
                (_: any, __: any, context: GraphQLContext) => {
                    const { pubsub } = context
                    return pubsub.asyncIterator(['CONVERSATION_UPDATED'])//NOTE - Из резольвера сообщений !
                },
                //Арг. 2.
                (payload: ConversationUpdatedSubscriptionPayload, _: any, context: GraphQLContext) => {
                    const { session } = context

                    // console.log('Это нагрузка из подписки на изменение диалога', payload)

                    if (!session?.user) {
                        throw new GraphQLError("Not authorized")
                    }

                    const { id: userId } = session.user
                    // полчим пользователей(participants) диалога из шаблона для нагрузки  
                    const { conversationUpdated: { conversation: { participants } } } = payload
                    //сопоставим для успешного совмещения(участника которому отправляется диалог)                  
                    const userIsParticipant = userIsConversationParticipant(participants, userId)//NOTE - это вернёт логическое значение

                    return userIsParticipant // = return true
                }
            )
        },
        //ANCHOR - подписка на удаление диалога
        conversationDeleted: {
            subscribe: withFilter(
              (_: any, __: any, context: GraphQLContext) => {
                const { pubsub } = context;
      
                return pubsub.asyncIterator(["CONVERSATION_DELETED"]);
              },
              (
                payload: ConversationDeletedSubscriptionPayload,
                _: any,
                context: GraphQLContext
              ) => {
                const { session } = context;
      
                if (!session?.user) {
                  throw new GraphQLError("Not authorized");
                }
      
                const { id: userId } = session.user;
                const {
                  conversationDeleted: { participants },
                } = payload;
      
                return userIsConversationParticipant(participants, userId);
              }
            ),
          },
    }
}



//------------SECTION----------- - Создание сгенерированных типов для переиспользования их в коде --------------

// создадим переменную с помощью "сгенерированного типа" Призмы для переиспользования в других частях кода на основе заполнения данных для участников диалога
export const participantPopulated = Prisma.validator<Prisma.ConversationParticipantInclude>()({
    user: {// в которое включим все данные поля user --> которое является ссылочным на модель User
        // и разрешим только id  и имя пользователя
        select: {// комманда select - выбор включаемых полей с подтверждением логическим true/false
            id: true,
            username: true
        }
    }
})

// создадим переменную conversationPopulated с помощью "сгенерированного типа" Призмы для переиспользования в других частях кода на основе заполнения данных для диалогов с помощью компонента Призмы - validator
export const conversationPopulated = Prisma.validator<Prisma.ConversationInclude>()({//ConversationInclude автоматически-сгенерированный тип данных пакетом Prisma при запуске комманды "npx prisma generate"(❓)
    participants: {// включим поле participants --> ConversationParticipant[](массив модели/коллекции ConversationParticipant)
        include: participantPopulated// переменная с заполненными занными участников диалога 
    },
    // и id и имя отправителя последнего сообщения
    latestMessage: {// включим поле latestMessage --> ссылочное на модель Message
        include: {// 
            sender: {// поле sender --> ссылочное на модель User
                // и так-же разрешим только id  и имя пользователя
                select: {
                    id: true,
                    username: true
                }
            }
        }
    }
})

// ----------------------------------------------------------------------------------------------------------