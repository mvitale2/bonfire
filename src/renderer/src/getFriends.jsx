// returns the friends list associated with the given public_id

import supabase from "../Supabase";

async function getFriends(publicId) {
  const { data, error } = await supabase
    .from("users")
    .select("friends")
    .eq("public_id", publicId)
    .single();

  if (error) {
    console.log(`Error retrieving friends: ${error.message}`);
    return [];
  }

  return Array.isArray(data?.friends) ? data.friends : [];
}

export default getFriends;
