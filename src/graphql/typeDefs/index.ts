import { mergeTypeDefs } from '@graphql-tools/merge'

import { userTypes } from './userTypeDefs'
import { conversationTypes } from './conversationTypeDefs'
import { messageTypes } from './messageTypeDefs'

const typeDefs = mergeTypeDefs([userTypes, conversationTypes, messageTypes])

export default typeDefs