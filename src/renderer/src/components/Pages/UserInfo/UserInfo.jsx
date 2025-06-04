import { Link } from "react-router-dom";
import "./UserInfo.css";

function UserInfo({ secretKey, nickname, id, publicId }) {
  // supabase logic to get user id based on secret key here
  const user = `${nickname}#${id}`;

  return (
    <>
      <div className="info-wrapper">
        <h1>{user}</h1>
        <section className="warning">
          <span className="important">
            If you forget this key, you will lose access to your account.
          </span>
          <span className="important">
            Save it somewhere safe now so that you can log in.
          </span>
        </section>
        <section className="secret-key">
          <span className="label">Secret Key: </span>
          <span>{secretKey}</span>
        </section>
        <section className="nickname">
          <span className="label">Nickname: </span>
          <span>{nickname}</span>
        </section>
        <section className="id">
          <span className="label">User ID: </span>
          <span>{publicId}</span>
        </section>
        <section className="link">
          <Link to="/">Back to Login</Link>
        </section>
      </div>
    </>
  );
}

export default UserInfo;
