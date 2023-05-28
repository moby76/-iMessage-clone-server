import { User } from "@prisma/client";
import GraphQLUpload from "graphql-upload";
import { CreateUserNameResponse, GraphQLContext } from "../../util/types"; //подключим типы для контекста
import { GraphQLError } from "graphql";


export const userResolvers = {
    Upload: GraphQLUpload,

    Query: {
        searchUsers: async (
            _: any,
            args: { username: string },
            context: GraphQLContext
        ): Promise<Array<User>> => {
            //тип User для TS подключается из prisma/client

            //STEP-1 - получим имя пользователя которое он будет задавать для своего участия
            const { username: searchedUsername } = args;

            //STEP-2 получим текущ. пользователя(session) и БД(prisma) из контекста
            const { session, prisma } = context;

            //STEP-3 - реализуем условие проверки на наличие текущего пользователя в системе(аутентифицирован/нет)
            if (!session?.user) {
                throw new GraphQLError('Not Autthorized');
            }
            //если авторизован, то получим имя авторизованного(в сессии) пользователя по имени польз.
            const {
                user: { username: myUsername },
            } = session; // присвоим ему алиас myUsername для дальнейшего использования в запросе к БД

            //STEP-4 - Получить всех пользователей ❕кроме себя❕ по имени (без учёта регистра)
            try {
                // найдём пользователей сравнив имя пользователя из БД (поле username модели/коллекции) равных значению имени польз. из аргументов (contains: searchedUsername) и исключить из поиска себя (not: myUsername). Укажем что поиск не чувствителен к регистру (mode: 'insensitive' )
                const users = await prisma.user.findMany({
                    where: {
                        username: {
                            // поле имени пользователя в модели(коллекции) user
                            contains: searchedUsername, // содержит введённое, в строке поиска имя(даже часть имени)
                            not: myUsername, // нужно исключить себя из поискового запроса
                            mode: "insensitive", //без учёта регистра
                        },
                    },
                });

                // console.log('Users: ', users);

                //вернём найденных польз.
                return users;
            } catch (error: any) {
                console.log("Ошибка поискового запроса", error);
                throw new GraphQLError(error?.message);
            }
        },
    },
    Mutation: {
        createUserName: async (
            _: any,
            args: { username: string },
            context: GraphQLContext
        ): Promise<CreateUserNameResponse> => {
            //STEP-1 - получим имя пользователя которое он будет задавать для своего участия
            const { username } = args;

            //STEP-2 получим текущ. пользователя(session) и БД(prisma) из контекста
            const { session, prisma } = context;

            //STEP-3 - реализуем условие проверки на наличие текущего пользователя в системе(аутентифицирован/нет)
            if (!session?.user) {
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
                const existingUser = await prisma.user.findUnique({
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
                await prisma.user.update({
                    where: { id: userId },
                    data: { username: username },
                });

                console.log("My New username!", username);

                return { success: true };
            } catch (error: any) {
                console.log("CreateUserName Error", error);
                return {
                    error: error?.message,
                };
            }

            // console.log('CONTEXT FROM userResolver', context)
        },
        uploadAvatar: async () => {
            //TODO -
        },
    },
    // Subscription: {
    //     ...
    // }
};
