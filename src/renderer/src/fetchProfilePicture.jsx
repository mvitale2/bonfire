import supabase from "../Supabase.jsx";
import defaultAvatar from "./assets/default_avatar.png";

const fetchProfilePicture = async (idToUse) => {
  const { data, error } = await supabase
    .from("users")
    .select("profile_pic_url")
    .eq("public_id", idToUse)
    .single();

  if (!error && data?.profile_pic_url) {
    return data.profile_pic_url;
  } else {
    return defaultAvatar;
  }
};

export default fetchProfilePicture;
