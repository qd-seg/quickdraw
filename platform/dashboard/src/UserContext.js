import React, { createContext, useContext, useState } from 'react';

const UserContext = createContext();

export const StateProvider = ({ children }) => {
  const [user, setUser] = useState('');

  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
};

export const useUserValue = () => useContext(UserContext);
