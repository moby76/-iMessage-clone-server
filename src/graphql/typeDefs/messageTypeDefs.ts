import gql from "graphql-tag";

export const messageTypes = gql`

    scalar Date

    type Message {
        id: String
        sender: User
        body: String
        createdAt: Date
    }

    type Query {
        messages(conversationId: String): [Message]
    }

    type Mutation {
        sendMessage(
            id: String
            body: String
            conversationId: String 
            senderId: String            
        ): Boolean
    }

    type Subscription {
        messageSent(conversationId: String): Message
    }
`