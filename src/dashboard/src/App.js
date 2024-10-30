import './App.css';
import LoginPage from './LoginPage';
import ModelManagementPage from './ModelManagementPage';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import React, { useState } from 'react';
import { StateProvider } from './UserContext';

export const UserContext = React.createContext([]);

function App() {
  return (
    <StateProvider>
      <Routes>
        <Route index element={<LoginPage />} />
        <Route path="model-management-page" element={<ModelManagementPage />}></Route>
      </Routes>
    </StateProvider>
  );
}

export default App;
