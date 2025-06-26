import { useState } from "react";
import Login from "./components/Pages/Login/Login.jsx";
import CreateAccount from "./components/Pages/CreateAccount/CreateAccount.jsx";
import UserInfo from "./components/Pages/UserInfo/UserInfo.jsx";
import UserSettings from "./components/Pages/UserSettings/UserSettings.jsx";
import { Route, Routes } from "react-router-dom";
import { UserContext } from "./UserContext.jsx";
import Message from "./components/Pages/Message/message.jsx";
import Friends from "./components/Pages/Friends/Friends.jsx";
import defaultAvatar from "./assets/default_avatar.png";



function App() {
  const [nickname, setNickname] = useState("");
  const [id, setId] = useState("");
  const [avatar, setAvatar] = useState(defaultAvatar);

  return (
    <UserContext.Provider
      value={{ nickname, setNickname, id, setId, avatar, setAvatar }}
    >
      <Routes>
        <Route index element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/user-info" element={<UserInfo />} />
        <Route path="/user-settings" element={<UserSettings />} />
        <Route path="/messages/:roomId?" element={<Message />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </UserContext.Provider>
  );
}

export default App;
