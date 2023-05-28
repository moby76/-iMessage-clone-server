import { mergeResolvers } from '@graphql-tools/merge'

import { userResolvers } from "./userResolvers";
import { conversationResolvers } from './conversationResolvers';
import { messageResolvers } from './messageResolvers'
// import { messageResolvers } from './messageResolvers-shad'
import scalarResolvers from "./scalars";//NOTE - 

const resolvers = mergeResolvers([
    userResolvers, 
    conversationResolvers,
     messageResolvers, 
     scalarResolvers
    ])

export default resolvers