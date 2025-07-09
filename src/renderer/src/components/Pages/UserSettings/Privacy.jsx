import { useContext } from "react";
import { UserContext } from "../../../UserContext.jsx";
import supabase from "../../../../Supabase.jsx";

const Privacy = () => {
  const {
    id,
    hideNickname,
    setHideNickname,
    hideProfilePic,
    setHideProfilePic,
  } = useContext(UserContext);

  const handleToggle = async (field, value) => {
    const { error } = await supabase
      .from("users")
      .update({ [field]: value })
      .eq("public_id", id);

    if (!error) {
      console.log(`Updated ${field} to ${value}`);
      if (field === "hide_nickname") setHideNickname(value);
      if (field === "hide_profile_pic") setHideProfilePic(value);
    } else {
      console.error("Failed to update privacy setting:", error.message);
    }
  };

  return (
    <section className="setting">
      <h3>Privacy Settings</h3>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={hideNickname}
          onChange={(e) => handleToggle("hide_nickname", e.target.checked)}
        />
        Hide my nickname (show "Anonymous")
      </label>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={hideProfilePic}
          onChange={(e) => handleToggle("hide_profile_pic", e.target.checked)}
        />
        Hide my profile picture (use default avatar)
      </label>
    </section>
  );
};

export default Privacy;
