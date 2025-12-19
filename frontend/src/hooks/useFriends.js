import { useQuery } from "@tanstack/react-query";
import { getUserFriends } from "../lib/api";

export const useFriends = () => {
  return useQuery({
    queryKey: ["friends"], // Identify this data in cache
    queryFn: getUserFriends,
    refetchInterval: 10000, // AUTO-UPDATE: Refresh every 10 seconds
    staleTime: 5000,        // Data stays "fresh" for 5 seconds
  });
};