"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userTypes = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.userTypes = (0, graphql_tag_1.default) `

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
`;
