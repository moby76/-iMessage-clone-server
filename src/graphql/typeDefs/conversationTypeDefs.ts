import gql from 'graphql-tag'

export const conversationTypes = gql`

    # определить кастомный скаляр для типа Date т.к. он отсутствует в GraphQL
    scalar Date

    type Mutation { 
        # мутация которая должна вернуть ответ в виде идентификаторов участников для диалога/общенения        
        createConversation(participantIds: [String]): CreateConversationResponse# NOTE - переменная participantIds попадает в мутацию непосредственно с фронтенда
        # Мутация для пометки диалога как прочитанного
        markConversationAsRead(userId: String!, conversationId: String): Boolean 
        # Мутация на удаление диалога
        deleteConversation(conversationId: String!): Boolean 
    }
    
    # тип для возвращаемого ответа после обработки мутации createConversation--^
    type CreateConversationResponse {
        conversationId: String #идентификаторы участников диалога
    }

    type ConversationUpdatedSubscriptionPayload {
        conversation: Conversation
    }

    type ConversationDeletedSubscriptionPayload {
        id: String
    }

    type Conversation {
        id: String
        latestMessage: Message
        participants: [Participant]
        createdAt: Date
        updatedAt: Date
    }

    type Participant {
        id: String
        user: User #'тип User не нужно определять в текущей схеме, т.к. он уже есть в схеме userTypeDefs
        hasSeenLatestMessage: Boolean
    }

    type Query {
        conversations: [Conversation] # параметры для поиска не зпданы, будут попадать в резольвер из контекста или БД(?)
    }

    type Subscription {
        # подписка conversationCreated будет нести ответственность при создании диалога
        conversationCreated: Conversation
        # Подписка на изменение диалога //TODO 
        conversationUpdated: ConversationUpdatedSubscriptionPayload
        # Подписка на удаление диалога
        conversationDeleted: ConversationDeletedSubscriptionPayload
    }

`