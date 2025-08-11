import React, { useState } from "react";
import { Link } from "react-router-dom";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import supabase from "../../../../Supabase";
import UserInfo from "../UserInfo/UserInfo.jsx";
import "./CreateAccount.css";
import { generateUserKeypair, savePrivateKey } from "../../../Crypto.jsx";

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
    const { publicKey, privateKey } = await generateUserKeypair();
    const exportedPublicKey = await window.crypto.subtle.exportKey(
      "spki",
      publicKey
    );
    const publicKeyB64 = btoa(
      String.fromCharCode(...new Uint8Array(exportedPublicKey))
    );

    const { error } = await supabase.from("users").insert([
      {
        key: hashedSecretKey,
        nickname: nickname,
        public_id: newPublicId,
        group_public_key: publicKeyB64,
      },
    ]);

    if (error) {
      console.error("Error saving user:", error.message);
      return;
    } else {
      console.log("Successfully created user!");
      savePrivateKey(privateKey, newPublicId);
    }

    setSecretKey(rawSecretKey);
    setPublicId(newPublicId);
    localStorage.setItem("user_id", newPublicId);

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
        <form className="create-form">
          <label htmlFor="nickname" className="nick-label">
            <h1>Enter a nickname:</h1>
          </label>
          <span>You can change your nickname in the app at any time</span>
          <input
            type="text"
            id="nickname"
            onChange={handleChange}
            value={nickname}
          />
          <button type="submit" className="submit-btn" onClick={handleSubmit}>
            Register
          </button>
          <Link to="/">Login</Link>
        </form>
      ) : (
        <UserInfo
          nickname={nickname}
          secretKey={secretKey}
          setSecretKey={setSecretKey}
          id={id}
          publicId={publicId}
        />
      )}
    </>
  );
}

export default CreateAccount;
