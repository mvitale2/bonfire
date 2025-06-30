import Login from "./components/Pages/Login/Login.jsx";
import CreateAccount from "./components/Pages/CreateAccount/CreateAccount.jsx";
import UserInfo from "./components/Pages/UserInfo/UserInfo.jsx";
import UserSettings from "./components/Pages/UserSettings/UserSettings.jsx";
import { Route, Routes } from "react-router-dom";
import Message from "./components/Pages/Message/message.jsx";
import Friends from "./components/Pages/Friends/Friends.jsx";
import { UserProvider } from "./components/Pages/UserSettings/UserSettings.jsx";

function App() {
  return (
    <UserProvider>
      <Routes>
        <Route index element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/user-info" element={<UserInfo />} />
        <Route path="/user-settings" element={<UserSettings />} />
        <Route path="/messages/:roomId?" element={<Message />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </UserProvider>
  );
}

export default App;
