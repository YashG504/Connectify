import { useMutation } from "@tanstack/react-query";
import { translateMessageAI, summarizeChatAI, summarizeChannelAI } from "../lib/api";
import toast from "react-hot-toast";

export const useTranslateMessage = () => {
  return useMutation({
    mutationFn: ({ text, targetLanguage }) => translateMessageAI(text, targetLanguage),
    onError: (error) => {
      toast.error(error.response?.data?.error || "Failed to translate message");
    },
  });
};

export const useSummarizeChat = (userId) => {
  return useMutation({
    mutationFn: () => summarizeChatAI(userId),
    onError: (error) => {
      toast.error(error.response?.data?.error || "Failed to summarize chat");
    },
  });
};

export const useSummarizeChannel = (channelId) => {
  return useMutation({
    mutationFn: () => summarizeChannelAI(channelId),
    onError: (error) => {
      toast.error(error.response?.data?.error || "Failed to summarize channel");
    },
  });
};
