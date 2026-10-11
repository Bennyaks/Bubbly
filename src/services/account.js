import { call } from './callable';

export const reportContent = (type, id, reason) => call('reportContent', { type, id, reason });
export const deleteAccount = () => call('deleteMyAccount', {});
