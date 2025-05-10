import Login from "./components/Pages/Login/Login.jsx";
import CreateAccount from "./components/Pages/CreateAccount/CreateAccount.jsx";
import UserInfo from "./components/Pages/UserInfo/UserInfo.jsx";
import UserSettings from "./components/Pages/UserSettings/UserSettings.jsx";
import { Route, Routes } from "react-router-dom";

function App() {
  return (
    <>
      <Routes>
        <Route index element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/user-info" element={<UserInfo />} />
        <Route path="/user-settings" element={<UserSettings />} />
      </Routes>
    </>
  );
}

export default App;
