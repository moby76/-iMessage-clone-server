import { ParticipantPopulated } from "./types";

//Функция определяющая что пользователь является участноком диалога
export function userIsConversationParticipant(participants: Array<ParticipantPopulated>, userId: string): boolean {
    // (!!) ☝️ если при переборе массива participants найдём соответствующего условию участника - то вернётся положительное значение(true), иначе вернёт отрицательное (false)
    return !!participants.find((participant) => participant.userId === userId)
}