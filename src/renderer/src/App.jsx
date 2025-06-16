import { useState } from 'react'
import Login from "./components/Pages/Login/Login.jsx";
import CreateAccount from "./components/Pages/CreateAccount/CreateAccount.jsx";
import UserInfo from "./components/Pages/UserInfo/UserInfo.jsx";
import UserSettings from "./components/Pages/UserSettings/UserSettings.jsx";
import { Route, Routes } from "react-router-dom";
import { UserContext } from "./UserContext.jsx";

function App() {
  const [nickname, setNickname] = useState("");
  const [id, setId] = useState("")
  return (
    <UserContext.Provider value={{ nickname, setNickname, id, setId }}>
      <Routes>
        <Route index element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/user-info" element={<UserInfo />} />
        <Route path="/user-settings" element={<UserSettings />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </UserContext.Provider>
  );
}

export default App;
