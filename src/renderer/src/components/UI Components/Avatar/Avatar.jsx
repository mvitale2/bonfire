import { useContext, useEffect, useState } from "react";
import { UserContext } from "../../../UserContext.jsx";
import defaultAvatar from "../../../assets/default_avatar.png";
import fetchProfilePicture from "../../../fetchProfilePicture.jsx";
import "./Avatar.css";

function Avatar({ otherUserId = null }) {
  const { avatar, id } = useContext(UserContext);
  const idToUse = otherUserId != null ? otherUserId : id;
  const [otherAvatar, setOtherAvatar] = useState(defaultAvatar);

  useEffect(() => {
    let isMounted = true;
    if (otherUserId) {
      fetchProfilePicture(idToUse).then((url) => {
        if (isMounted) setOtherAvatar(url);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [otherUserId, idToUse]);

  return (
    <div className="avatar-div">
      {avatar && (
        <img
          className="avatar"
          src={otherUserId ? otherAvatar : avatar || defaultAvatar}
          alt="avatar"
        ></img>
      )}
    </div>
  );
}

export default Avatar;
