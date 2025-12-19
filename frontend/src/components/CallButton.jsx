import { VideoIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

function CallButton({ receiverId }) {
  const navigate = useNavigate();

  return (
    <div className="p-3 border-b flex items-center justify-end max-w-7xl mx-auto w-full">
      <button 
        onClick={() => navigate(`/call/${receiverId}`)} 
        className="btn btn-success btn-sm text-white"
      >
        <VideoIcon className="size-6" />
      </button>
    </div>
  );
}

export default CallButton;