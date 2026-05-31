/**
 * Fetches a LiveKit access token from the local development server.
 * 
 * @param userId - Unique student/teacher ID
 * @param userName - Display name of the user
 * @param roomId - The room (classroom) name or ID
 * @param isTeacher - Permission flag (determines if they can screen-share)
 * @returns Promise resolving to the token string
 */
export async function fetchLiveKitToken(
  userId: string,
  userName: string,
  roomId: string,
  isTeacher: boolean
): Promise<string> {
  const params = new URLSearchParams({
    userId,
    userName,
    roomId,
    isTeacher: String(isTeacher),
  });

  // Use environment variable for token server URL, fallback to local dev
  const tokenServerUrl = import.meta.env.VITE_LIVEKIT_TOKEN_URL || '';
  const url = `${tokenServerUrl}/api/get-livekit-token?${params.toString()}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch token: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.token) {
      throw new Error("No token returned from server");
    }

    return data.token;
  } catch (error) {
    console.error("Error fetching LiveKit token:", error);
    throw error;
  }
}
