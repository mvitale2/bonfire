import { useState, useContext, useEffect, useRef } from "react";
import { UserContext } from "../../../UserContext";
import { Link, useNavigate } from "react-router-dom";
import supabase from "../../../../Supabase";
import bcrypt from "bcryptjs";
import "./Login.css";

function Login() {
  const [secretKey, setSecretKey] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState(null);
  const [disableLogin, setDisableLogin] = useState(false);
  const navigate = useNavigate();
  const { id, setNickname, setId, setAvatar } = useContext(UserContext);
  const inputRef = useRef();

  useEffect(() => {
    console.log("Focusing input...");
    inputRef.current?.focus();
  }, []);

  // so that after logout everything should work
  useEffect(() => {
    if (id) {
      console.log("Auto-login detected, navigating to /messages...");
      navigate("/messages");
    }
  }, [id]);

  const handleClick = async (e) => {
    e.preventDefault();
    setDisableLogin(true);

    try {
      // get all users
      const { data: users, error } = await supabase
        .from("users")
        .select("id, nickname, key, public_id, profile_pic_url");

      if (error) {
        console.log("Error fetching users:", error.message);
        setMessage("An error occurred. Please try again.");
        return;
      }

      // loop through each user to check if any of them equal the hashed secret key
      let authenticatedUser = null;
      for (const user of users) {
        const isMatch = await bcrypt.compare(secretKey, user.key);
        if (isMatch) {
          authenticatedUser = user;
          break;
        }
      }

      // if a match is found, give them access to the account
      if (authenticatedUser) {
        setNickname(authenticatedUser.nickname);
        setId(authenticatedUser.public_id);
        setAvatar(authenticatedUser.profile_pic_url);

        // store in localStorage if "Remember Me" is checked
        if (rememberMe) {
          localStorage.setItem(
            "rememberedUser",
            JSON.stringify({
              nickname: authenticatedUser.nickname,
              id: authenticatedUser.public_id,
              avatar: authenticatedUser.profile_pic_url,
            })
          );
        }

        setMessage(`Welcome back, ${authenticatedUser.nickname}`);
        setTimeout(() => {
          navigate("/messages");
        }, 2000);

        const { error } = await supabase
          .from("users")
          .update({
            last_logon: () => {
              const now = new Date().toISOString();
              return now;
            },
          })
          .eq("public_id", authenticatedUser.public_id);

        if (error) {
          console.log("Error uploading login to supabase: ", error.message);
        }
      } else {
        setMessage("Invalid key.");
      }
    } catch (err) {
      console.log("Error during login:", err.message);
      setMessage("An unexpected error occurred. Please try again.");
    }

    setDisableLogin(false);
  };

  return (
    <form className="login-form">
      <label htmlFor="secret-key" className="key-label">
        <h1>Enter your secret key:</h1>
      </label>
      <input
        ref={inputRef}
        type="password"
        id="secret-key"
        onChange={(e) => setSecretKey(e.target.value)}
      />
      <div className="remember-me-checkbox">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            onKeyDown={(e) => console.log("Key pressed:", e.key)}
            onFocus={() => console.log("Input focused")}
            autoComplete="off"
          />{" "}
          Remember Me
        </label>
      </div>
      <button
        type="submit"
        className="submit-btn"
        onClick={handleClick}
        disabled={disableLogin}
      >
        Login
      </button>
      {message ? <p>{message}</p> : null}
      <Link to="/create-account">Register</Link>
    </form>
  );
}

export default Login;
