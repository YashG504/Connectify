import { Link } from "react-router-dom"; // changed from "react-router" to "react-router-dom" for safety
import { LANGUAGE_TO_FLAG } from "../constants";
import { MessageSquareIcon } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";

export function getLanguageFlag(language) {
  if (!language) return null;
  const langLower = language.toLowerCase();
  const countryCode = LANGUAGE_TO_FLAG[langLower];
  if (countryCode) {
    return (
      <img
        src={`https://flagcdn.com/24x18/${countryCode}.png`}
        alt={`${langLower} flag`}
        className="h-3 mr-1 inline-block"
      />
    );
  }
  return null;
}

const FriendCard = ({ friend, unreadCount }) => {
  const { onlineUsers } = useThemeStore();
  return (
    <div className="card bg-base-200 hover:shadow-md transition-shadow">
      <div className="card-body p-4">
        {/* USER INFO */}
        <div className="flex items-center gap-3 mb-3">
          <div className="avatar size-12 relative">
            <img 
              src={friend.profilePic || "/avatar.png"} 
              alt={friend.fullName} 
              className="rounded-full object-cover"
            />
            {onlineUsers.has(friend._id) && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            )}
          </div>
          <h3 className="font-semibold truncate">{friend.fullName}</h3>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="badge badge-secondary text-xs">
            {getLanguageFlag(friend.nativeLanguage)}
            Native: {friend.nativeLanguage}
          </span>
          <span className="badge badge-outline text-xs">
            {getLanguageFlag(friend.learningLanguage)}
            Learning: {friend.learningLanguage}
          </span>
        </div>

        <Link to={`/chat/${friend._id}`} className="btn btn-outline w-full relative">
          <MessageSquareIcon className="size-4 mr-2" />
          Message
          
          {/* --- NOTIFICATION BADGE --- */}
          {unreadCount > 0 && (
            <div className="absolute -top-2 -right-2 badge badge-error text-white badge-sm animate-bounce">
              {unreadCount}
            </div>
          )}
        </Link>
      </div>
    </div>
  );
};
export default FriendCard;