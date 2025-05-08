import Login from "./components/Login/Login.jsx"
import CreateAccount from "./components/CreateAccount/CreateAccount.jsx"
import UserInfo from "./UserInfo/UserInfo.jsx"
import { Route, Routes } from 'react-router-dom'

function App() {

  return (
    <>
      <Routes>
        <Route index element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/user-info" element={<UserInfo />} />
      </Routes>
    </>
  )
}

export default App
