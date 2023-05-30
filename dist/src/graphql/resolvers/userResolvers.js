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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userResolvers = void 0;
const graphql_upload_1 = __importDefault(require("graphql-upload"));
const graphql_1 = require("graphql");
exports.userResolvers = {
    Upload: graphql_upload_1.default,
    Query: {
        searchUsers: (_, args, context) => __awaiter(void 0, void 0, void 0, function* () {
            //тип User для TS подключается из prisma/client
            //STEP-1 - получим имя пользователя которое он будет задавать для своего участия
            const { username: searchedUsername } = args;
            //STEP-2 получим текущ. пользователя(session) и БД(prisma) из контекста
            const { session, prisma } = context;
            //STEP-3 - реализуем условие проверки на наличие текущего пользователя в системе(аутентифицирован/нет)
            if (!(session === null || session === void 0 ? void 0 : session.user)) {
                throw new graphql_1.GraphQLError('Not Autthorized');
            }
            //если авторизован, то получим имя авторизованного(в сессии) пользователя по имени польз.
            const { user: { username: myUsername }, } = session; // присвоим ему алиас myUsername для дальнейшего использования в запросе к БД
            //STEP-4 - Получить всех пользователей ❕кроме себя❕ по имени (без учёта регистра)
            try {
                // найдём пользователей сравнив имя пользователя из БД (поле username модели/коллекции) равных значению имени польз. из аргументов (contains: searchedUsername) и исключить из поиска себя (not: myUsername). Укажем что поиск не чувствителен к регистру (mode: 'insensitive' )
                const users = yield prisma.user.findMany({
                    where: {
                        username: {
                            // поле имени пользователя в модели(коллекции) user
                            contains: searchedUsername,
                            not: myUsername,
                            mode: "insensitive", //без учёта регистра
                        },
                    },
                });
                // console.log('Users: ', users);
                //вернём найденных польз.
                return users;
            }
            catch (error) {
                console.log("Ошибка поискового запроса", error);
                throw new graphql_1.GraphQLError(error === null || error === void 0 ? void 0 : error.message);
            }
        }),
    },
    Mutation: {
        createUserName: (_, args, context) => __awaiter(void 0, void 0, void 0, function* () {
            //STEP-1 - получим имя пользователя которое он будет задавать для своего участия
            const { username } = args;
            //STEP-2 получим текущ. пользователя(session) и БД(prisma) из контекста
            const { session, prisma } = context;
            //STEP-3 - реализуем условие проверки на наличие текущего пользователя в системе(аутентифицирован/нет)
            if (!(session === null || session === void 0 ? void 0 : session.user)) {
                //NOTE - это другой способ вернуть ошибку в отличии от throw new GraphQLError('Not Autthorized') ⤴️. Этот вариант вернёт ошибку как тип который можно задекларировать в TS
                return {
                    //если не авторизирован - выведем ошибку на клиенте
                    error: "Not Autthorized",
                };
            }
            //если авторизован, то получим id из БД присвоив ему имя userId для дальнейшего использования в коде резольвера
            const { id: userId } = session.user;
            // console.log('User', session.user);
            //STEP-4 -
            try {
                // найдём пользователя сравнив имя пользователя username в БД(уникальное) и имя польз. из аргументов
                const existingUser = yield prisma.user.findUnique({
                    where: { username: username },
                }); //findUnique ищет только по полям в БД которые обозначены как уникальные
                // если такое имя уже есть в ДБ то выведем предупреждение/ошибку
                //NOTE данное сообщение будет выведено в клиенте(на странице создания имени пользователя)
                if (existingUser) {
                    return {
                        error: "Это имя уже занято 🤨. Попробуйте использовать другое...",
                    };
                }
                // если такого имени нет - то обновить пользовтеля в БД внеся в него это имя
                yield prisma.user.update({
                    where: { id: userId },
                    data: { username: username },
                });
                console.log("My New username!", username);
                return { success: true };
            }
            catch (error) {
                console.log("CreateUserName Error", error);
                return {
                    error: error === null || error === void 0 ? void 0 : error.message,
                };
            }
            // console.log('CONTEXT FROM userResolver', context)
        }),
        uploadAvatar: () => __awaiter(void 0, void 0, void 0, function* () {
            //TODO -
        }),
    },
    // Subscription: {
    //     ...
    // }
};
