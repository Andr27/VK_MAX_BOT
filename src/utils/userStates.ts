const userStates = new Map<number, string>();

export function setUserState(userId: number, state: string): void {
    userStates.set(userId, state);
}

export function getUserState(userId: number): string {
    return userStates.get(userId) || 'main';
}

export function clearUserState(userId: number): void {
    userStates.delete(userId);
}