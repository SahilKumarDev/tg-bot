import TelegramBot from "node-telegram-bot-api";
import { searchSpotifyTrack } from "../spotify";

export function registerMusicCommands(bot: TelegramBot) {
  bot.onText(/\/music (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match?.[1];

    if (!query) {
      return bot.sendMessage(chatId, "Please provide a song name.");
    }

    const track = await searchSpotifyTrack(query);
    if (!track) {
      return bot.sendMessage(chatId, "Track not found.");
    }

    const caption = `🎵 *${track.title}*\n👤 Artist: ${track.artist}\n💽 Album: ${track.album}\n🔗 [Listen on Spotify](${track.url})`;

    await bot.sendPhoto(chatId, track.imageUrl, {
      caption,
      parse_mode: "Markdown",
    });

    if (track.previewUrl) {
      await bot.sendAudio(chatId, track.previewUrl, {
        title: track.title,
        performer: track.artist,
      });
    } else {
      bot.sendMessage(chatId, "⚠️ No preview available for this track.");
    }
  });
}
