import { createContext, useContext } from 'react';

// Shared navigation helpers. Main (App.js) provides the value:
//   me                {uid, username}
//   push(name, params), pop()
//   openUser(uid), openChat(chatId), openSearch(), openViewer(posts, index)
//   goTab(tabId)
export const NavContext = createContext(null);
export const useNav = () => useContext(NavContext);
