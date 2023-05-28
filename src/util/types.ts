import { Prisma, PrismaClient } from "@prisma/client";
import { ISODateString } from "next-auth";
import { conversationPopulated, participantPopulated } from "../graphql/resolvers/conversationResolvers";
import { Context } from "graphql-ws/lib/server";
import { PubSub } from "graphql-subscriptions";
// import { type } from "os";
import { messagePopulated } from "../graphql/resolvers/messageResolvers";


//------------SECTION----------- - типы для контекста подписок 

//расширим параметры Context пакета graphql-ws/ 
export interface SubscriptionContext extends Context {
    //добавим тип для параметров соединения graphql-ws/
    connectionParams: {
        session?: Session
    }
}

//------------SECTION----------- - типы для контекста GraphQL -------------------------

// тип TS GraphQLContext будет содержать объект session, который является в свою очередь интерфейсом Session из пакета next-auth , объект prisma
export interface GraphQLContext {
    session: Session | null // интерфейс Session. предварительно дополнен/расширен в файле next-auth.d.ts(папка lib)
    prisma: PrismaClient// тип для призмы
    pubsub: PubSub// тип для подписок
}

//------------SECTION----------- - Users ----------------------------------------

// определить типы для TS для данных возвращаемых в результате работы мутации createUserName - CreateUserNameResponse(success и error)
export interface CreateUserNameResponse {
    success?: boolean;// знак ? обозначает что только один тип может быть выведен(или success или error)
    error?: string;
}

//------------SECTION----------- - Conversations(Диалоги) ------------------------

// тип для данных которые будут в диалогах. Должно в точности повторять содержимое переменной conversationPopulated в conversationResolvers.ts
// с помощью "сгенерированного типа" Призмы - ConversationGetPayload в получим раннее созданный в conversationResolvers.ts тип-переменную conversationPopulated
export type ConversationPopulated = Prisma.ConversationGetPayload<{ include: typeof conversationPopulated }>

//по аналогичному --^ принципу создадим тип для participantPopulated, что является частью conversationPopulated. Для отдельного переиспользования
export type ParticipantPopulated = Prisma.ConversationParticipantGetPayload<{ include: typeof participantPopulated }>

// интерфейс для payload. Будет на основе сген. типа ConversationPopulated, и включен в подписку conversationCreated --^^
export interface ConversationCreatedSubscriptionPayload {
    conversationCreated: ConversationPopulated
}

// интерфейс шаблона для заполнения подписки на обновление диалогов
export interface ConversationUpdatedSubscriptionPayload {
    conversationUpdated: {//название нашего резольвера подписки
        conversation: ConversationPopulated// что он возвращает
    }
}

// интерфейс шаблона для заполнения подписки на удаление диалогов
export interface ConversationDeletedSubscriptionPayload {
    conversationDeleted: ConversationPopulated;
}

//------------SECTION----------- - Типы для Messages ------------------------------

//интерфейс для аргументов
export interface SendMessageArguments {
    id: string
    body: string
    conversationId: string
    senderId: string
}

export interface MessageSentSubscriptionPayload {
    messageSent: MessagePopulated
}

//тип полученный на основе сформированного в messageResolvers шаблона messagePopulated
export type MessagePopulated = Prisma.MessageGetPayload<{ include: typeof messagePopulated }>

// export { Session };
//------------SECTION----------- - Сессия

export interface Session {
    user?: User;
    expires: ISODateString;
}

export interface User {
    id: string;
    username: string;
    email: string;
    emailVerified: boolean;
    image: string;
    name: string;
}
