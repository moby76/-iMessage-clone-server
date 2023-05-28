import gql from 'graphql-tag'

export const userTypes = gql`

    scalar Upload

    type User {
        id: String
        email: String
        emailVerified: Boolean
        name: String
        username: String
        image: String
        avatar: File        
    }

    type SearchedUser {
        id: String
        username: String
    }

    #  Тип - сообщение при создании имени пользователя.  
    type CreateUserNameResponse {
        success: Boolean #Логическое поле для успешного/неуспешного результата
        error: String # и поле с ошибкой при неудаче
    }

    type File{
        id: ID!
        url: String!
    }

    type Query {
        # запрос на получение всех пользователей(кроме себя(?))
        searchUsers(username: String): [SearchedUser]
    }

    type Mutation {
        # ANCHOR мутация на создание кастомного имени ползователя. После обработки вернёт сообщение об успешном/неудачном создании имени
        createUserName(username: String): CreateUserNameResponse

        # ANCHOR мутация для загрузки аватара
        uploadAvatar(avatar: Upload!): User!
    }
`