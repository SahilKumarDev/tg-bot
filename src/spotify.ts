import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

let accessToken = "";

async function getAccessToken() {
  const res = await axios.post(
    "https://accounts.spotify.com/api/token",
    new URLSearchParams({ grant_type: "client_credentials" }),
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  accessToken = res.data.access_token;
}

export async function searchSpotifyTrack(query: string) {
  if (!accessToken) await getAccessToken();

  const response = await axios.get(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const track = response.data.tracks.items[0];
  if (!track) return null;

  return {
    title: track.name,
    artist: track.artists.map((a: any) => a.name).join(", "),
    album: track.album.name,
    previewUrl: track.preview_url,
    imageUrl: track.album.images[0]?.url,
    url: track.external_urls.spotify,
  };
}
