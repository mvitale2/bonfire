// returns the user's nickname based on their public_id
import supabase from "../Supabase";

async function getNickname(pubId) {
  const { data, error } = await supabase
    .from("users")
    .select("nickname")
    .eq("public_id", pubId)
    .single();

  if (error) {
    console.log(`Error retrieving nickname: ${error.message}`)
    return null;
  }

  return data;
}

export default getNickname;
