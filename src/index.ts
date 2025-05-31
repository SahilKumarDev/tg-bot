import TelegramBot from "node-telegram-bot-api";
import ytdl from "@distube/ytdl-core";
import ytSearch from "yt-search";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import dotenv from "dotenv";
dotenv.config();

ffmpeg.setFfmpegPath("C:\\ffmpeg\\bin\\ffmpeg.exe");

interface MusicQueue {
  [chatId: string]: {
    songs: Array<{
      title: string;
      url: string;
      duration: string;
      thumbnail: string;
    }>;
    currentIndex: number;
    isPlaying: boolean;
  };
}

class TelegramMusicBot {
  private bot: TelegramBot;
  private queue: MusicQueue = {};
  private tempDir = "./temp";

  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: true });
    this.setupHandlers();
  }

  private setupHandlers() {
    // Start command
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(
        chatId,
        "🎵 Welcome to Music Bot!\n\n" +
          "Commands:\n" +
          "/play <song name> - Play a song\n" +
          "/queue - Show current queue\n" +
          "/skip - Skip current song\n" +
          "/stop - Stop playing and clear queue\n" +
          "/current - Show current playing song"
      );
    });

    // Play command
    this.bot.onText(/\/play (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const query = match?.[1];

      if (!query) {
        this.bot.sendMessage(chatId, "❌ Please provide a song name!");
        return;
      }

      try {
        await this.searchAndQueue(chatId, query);
      } catch (error) {
        this.bot.sendMessage(
          chatId,
          "❌ Error occurred while searching for the song."
        );
      }
    });

    // Queue command
    this.bot.onText(/\/queue/, (msg) => {
      const chatId = msg.chat.id;
      this.showQueue(chatId);
    });

    // Skip command
    this.bot.onText(/\/skip/, (msg) => {
      const chatId = msg.chat.id;
      this.skipSong(chatId);
    });

    // Stop command
    this.bot.onText(/\/stop/, (msg) => {
      const chatId = msg.chat.id;
      this.stopMusic(chatId);
    });

    // Current command
    this.bot.onText(/\/current/, (msg) => {
      const chatId = msg.chat.id;
      this.showCurrent(chatId);
    });

    // Handle errors
    this.bot.on("polling_error", (error) => {
      console.error("Polling error:", error);
    });
  }

  private async searchAndQueue(chatId: number, query: string) {
    const loadingMsg = await this.bot.sendMessage(
      chatId,
      "🔍 Searching for music..."
    );

    try {
      const searchResults = await ytSearch(query);

      if (!searchResults.videos.length) {
        this.bot.editMessageText("❌ No songs found!", {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
        });
        return;
      }

      const video = searchResults.videos[0];
      const song = {
        title: video.title,
        url: video.url,
        duration: video.duration.toString(),
        thumbnail: video.thumbnail || "",
      };

      // Initialize queue if it doesn't exist
      if (!this.queue[chatId]) {
        this.queue[chatId] = {
          songs: [],
          currentIndex: 0,
          isPlaying: false,
        };
      }

      this.queue[chatId].songs.push(song);

      await this.bot.editMessageText(
        `✅ Added to queue: **${song.title}**\n` +
          `Duration: ${song.duration}\n` +
          `Position in queue: ${this.queue[chatId].songs.length}`,
        {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          parse_mode: "Markdown",
        }
      );

      // Start playing if not already playing
      if (!this.queue[chatId].isPlaying) {
        await this.playNext(chatId);
      }
    } catch (error) {
      this.bot.editMessageText("❌ Error searching for music!", {
        chat_id: chatId,
        message_id: loadingMsg.message_id,
      });
    }
  }

  private async playNext(chatId: number) {
    const chatQueue = this.queue[chatId];

    if (!chatQueue || chatQueue.songs.length === 0) {
      return;
    }

    if (chatQueue.currentIndex >= chatQueue.songs.length) {
      this.bot.sendMessage(chatId, "🎵 Queue finished!");
      chatQueue.isPlaying = false;
      return;
    }

    const currentSong = chatQueue.songs[chatQueue.currentIndex];
    chatQueue.isPlaying = true;

    try {
      const playingMsg = await this.bot.sendMessage(
        chatId,
        `🎵 Now playing: **${currentSong.title}**\n` +
          `Duration: ${currentSong.duration}`,
        { parse_mode: "Markdown" }
      );

      // Download and send audio
      await this.downloadAndSendAudio(chatId, currentSong);

      // Auto-play next song after current finishes
      setTimeout(() => {
        if (this.queue[chatId]?.isPlaying) {
          chatQueue.currentIndex++;
          this.playNext(chatId);
        }
      }, this.parseDurationToMs(currentSong.duration));
    } catch (error) {
      this.bot.sendMessage(chatId, `❌ Error playing: ${currentSong.title}`);
      chatQueue.currentIndex++;
      this.playNext(chatId);
    }
  }

  private async downloadAndSendAudio(chatId: number, song: any) {
    const outputFile = path.join(
      this.tempDir,
      `${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`
    );

    try {
      if (!ytdl.validateURL(song.url)) {
        throw new Error("Invalid YouTube URL");
      }

      // Get video info first to ensure it's accessible
      const info = await ytdl.getInfo(song.url);

      const stream = ytdl(song.url, {
        filter: "audioonly",
        quality: "highestaudio",
        requestOptions: {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
        },
      });

      await new Promise<void>((resolve, reject) => {
        ffmpeg(stream)
          .audioBitrate(128)
          .format("mp3")
          .save(outputFile)
          .on("end", () => {
            resolve();
          })
          .on("error", (err) => {
            reject(err);
          })
          .on("progress", (progress) => {});
      });

      // Check if file exists and has content
      if (!fs.existsSync(outputFile) || fs.statSync(outputFile).size === 0) {
        throw new Error("Audio file was not created or is empty");
      }

      await this.bot.sendAudio(chatId, outputFile, {
        title: song.title,
        duration: this.parseDurationToSeconds(song.duration),
        caption: `🎵 ${song.title}`,
      });
    } catch (error) {
      // Fallback: send song info as text message
      this.bot.sendMessage(
        chatId,
        `🎵 **${song.title}**\n` +
          `🔗 [Listen on YouTube](${song.url})\n` +
          `⏱️ Duration: ${song.duration}\n\n` +
          `_Note: Audio download failed, but you can listen via the link above._`,
        { parse_mode: "Markdown" }
      );
    } finally {
      // Clean up temporary file
      try {
        if (fs.existsSync(outputFile)) {
          fs.unlinkSync(outputFile);
        }
      } catch (cleanupError) {}
    }
  }

  private showQueue(chatId: number) {
    const chatQueue = this.queue[chatId];

    if (!chatQueue || chatQueue.songs.length === 0) {
      this.bot.sendMessage(chatId, "📭 Queue is empty!");
      return;
    }

    let queueText = "🎵 **Current Queue:**\n\n";

    chatQueue.songs.forEach((song, index) => {
      const isCurrentSong =
        index === chatQueue.currentIndex && chatQueue.isPlaying;
      const prefix = isCurrentSong ? "▶️" : `${index + 1}.`;
      queueText += `${prefix} ${song.title} (${song.duration})\n`;
    });

    this.bot.sendMessage(chatId, queueText, { parse_mode: "Markdown" });
  }

  private skipSong(chatId: number) {
    const chatQueue = this.queue[chatId];

    if (!chatQueue || !chatQueue.isPlaying) {
      this.bot.sendMessage(chatId, "❌ No song is currently playing!");
      return;
    }

    chatQueue.currentIndex++;
    this.bot.sendMessage(chatId, "⏭️ Skipped current song!");
    this.playNext(chatId);
  }

  private stopMusic(chatId: number) {
    if (this.queue[chatId]) {
      this.queue[chatId].isPlaying = false;
      this.queue[chatId].songs = [];
      this.queue[chatId].currentIndex = 0;
    }

    this.bot.sendMessage(chatId, "🛑 Stopped music and cleared queue!");
  }

  private showCurrent(chatId: number) {
    const chatQueue = this.queue[chatId];

    if (!chatQueue || !chatQueue.isPlaying || chatQueue.songs.length === 0) {
      this.bot.sendMessage(chatId, "❌ No song is currently playing!");
      return;
    }

    const currentSong = chatQueue.songs[chatQueue.currentIndex];
    this.bot.sendMessage(
      chatId,
      `🎵 **Currently Playing:**\n` +
        `${currentSong.title}\n` +
        `Duration: ${currentSong.duration}`,
      { parse_mode: "Markdown" }
    );
  }

  private parseDurationToMs(duration: string): number {
    const parts = duration.split(":").map(Number);
    if (parts.length === 2) {
      return (parts[0] * 60 + parts[1]) * 1000;
    } else if (parts.length === 3) {
      return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
    return 180000;
  }

  private parseDurationToSeconds(duration: string): number {
    return Math.floor(this.parseDurationToMs(duration) / 1000);
  }
}

const BOT_TOKEN = process.env.BOT_TOKEN!;

const musicBot = new TelegramMusicBot(BOT_TOKEN);
console.log("🎵 Telegram Music Bot started successfully!");
