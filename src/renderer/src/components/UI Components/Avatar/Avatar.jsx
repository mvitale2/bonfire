import supabase from "../../../../Supabase.jsx";
import { useContext, useEffect } from "react";
import { UserContext } from "../../../UserContext.jsx";
import "./Avatar.css"

function Avatar() {
  const { avatar, setAvatar, id } = useContext(UserContext);

  useEffect(() => {
    const fetchProfilePicture = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("profile_pic_url")
        .eq("public_id", id)
        .single();

      console.log("Fetching profile for public_id:", id);
      console.log("Response:", data, "Error:", error);

      if (!error && data?.profile_pic_url) {
        setAvatar(data.profile_pic_url);
      } else {
        console.error("Failed to fetch profile picture:", error);
      }
    };

    fetchProfilePicture();
  }, [avatar]);

  return (
    <div className="avatar-div">
      {avatar && <img className="avatar" src={avatar} alt="avatar"></img>}
    </div>
  );
}

export default Avatar;
