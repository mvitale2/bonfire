import Login from "./components/Pages/Login/Login.jsx";
import CreateAccount from "./components/Pages/CreateAccount/CreateAccount.jsx";
import UserInfo from "./components/Pages/UserInfo/UserInfo.jsx";
import UserSettings from "./components/Pages/UserSettings/UserSettings.jsx";
import { Route, Routes } from "react-router-dom";
import Message from "./components/Pages/Message/message.jsx";
import Friends from "./components/Pages/Friends/Friends.jsx";
import Call from "./components/Pages/Friends/Call.jsx";
import { UserProvider } from "./components/Pages/UserSettings/UserSettings.jsx";
import "./Checkmarks.css";
import CallListener from "./components/UI Components/CallListener/CallListener.jsx";

function App() {
  return (
    <>
      <UserProvider>
        <CallListener />
        <Routes>
          <Route index element={<Login />} />
          <Route path="/create-account" element={<CreateAccount />} />
          <Route path="/user-info" element={<UserInfo />} />
          <Route path="/user-settings" element={<UserSettings />} />
          <Route path="/messages" element={<Message />} />
          <Route path="/messages/:roomId" element={<Message />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/login" element={<Login />} />
          <Route path="/call/:roomId" element={<Call />} />
        </Routes>
      </UserProvider>
    </>
  );
}

export default App;
