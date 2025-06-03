import React, { useState } from "react";
import { Link } from "react-router-dom";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import supabase from "../../../../Supabase";
import UserInfo from "../UserInfo/UserInfo.jsx";
import "./CreateAccount.css";

function CreateAccount() {
  const [nickname, setNickname] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [publicId, setPublicId] = useState("");
  const [id, setId] = useState("");

  const generateRandomString = () => {
    // thx copilot :)
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const length = 29;
    let result = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters[randomIndex];
    }
    return result;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const rawSecretKey = generateRandomString();
    const hashedSecretKey = await bcrypt.hash(rawSecretKey, 10);
    const newPublicId = uuidv4();

    const { error } = await supabase.from("users").insert([
      {
        key: hashedSecretKey,
        nickname: nickname,
        public_id: newPublicId,
      },
    ]);

    if (error) {
      console.error("Error saving user:", error.message);
      return;
    } else {
      console.log("Successfully created user!");
    }

    setSecretKey(rawSecretKey);
    setPublicId(newPublicId);
    localStorage.setItem("user_id", newPublicId); //  UUID

    const newId = newPublicId.slice(0, 6);
    setId(newId);
  };

  const handleChange = (e) => {
    const newText = e.target.value;
    setNickname(newText);
  };

  return (
    <>
      {secretKey === "" ? (
        <form>
          <label htmlFor="nickname" className="nick-label">
            <h1>Enter a nickname:</h1>
          </label>
          <span>You can change your nickname in the app at any time</span>
          <input type="text" id="nickname" onChange={handleChange} />
          <button type="submit" className="submit-btn" onClick={handleSubmit}>
            Register
          </button>
          <Link to="/">Login</Link>
        </form>
      ) : (
        <UserInfo
          nickname={nickname}
          secretKey={secretKey}
          id={id}
          publicId={publicId}
        />
      )}
    </>
  );
}

export default CreateAccount;
