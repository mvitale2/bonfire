import { useContext, useEffect, useState } from "react";
import { UserContext } from "../../../UserContext.jsx";
import defaultAvatar from "../../../assets/default_avatar.png";
import fetchProfilePicture from "../../../fetchProfilePicture.jsx";
import "./Avatar.css";

function Avatar({ otherUserId = null }) {
  const { avatar, id, hideProfilePic } = useContext(UserContext);
  const idToUse = otherUserId != null ? otherUserId : id;
  const [otherAvatar, setOtherAvatar] = useState(defaultAvatar);

  useEffect(() => {
    let isMounted = true;
    if (otherUserId) {
      fetchProfilePicture(idToUse).then((url) => {
        if (isMounted && url) setOtherAvatar(url);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [otherUserId, idToUse]);

  const finalSrc = otherUserId
    ? otherAvatar
    : hideProfilePic || !avatar
    ? defaultAvatar
    : avatar;

  return (
    <div className="avatar-div">
      <img
        className="avatar"
        src={finalSrc}
        alt="avatar"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = defaultAvatar;
        }}
      />
    </div>
  );
}

export default Avatar;
