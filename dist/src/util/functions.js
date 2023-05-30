"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userIsConversationParticipant = void 0;
//Функция определяющая что пользователь является участноком диалога
function userIsConversationParticipant(participants, userId) {
    // (!!) ☝️ если при переборе массива participants найдём соответствующего условию участника - то вернётся положительное значение(true), иначе вернёт отрицательное (false)
    return !!participants.find((participant) => participant.userId === userId);
}
exports.userIsConversationParticipant = userIsConversationParticipant;
