import TelegramBot from "node-telegram-bot-api";
import * as dotenv from "dotenv"; 
import { handleCallbackButtons } from "./button/button"; 
import { registerCommands } from "./commands/commands";
import { registerMusicCommands } from "./commands/music";

dotenv.config();

const port = process.env.PORT || 4000 

if (!process.env.BOT_TOKEN) {
  throw new Error("BOT_TOKEN is not defined in the environment variables.");
}

const bot = new TelegramBot(process.env.BOT_TOKEN!, { polling: true });
 
bot.on("polling_error", (error: any) => {
  console.error("Polling Error:", error.code, error.message);
});
  
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `Hello ${msg.from!.first_name}!`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Generate DOCX", callback_data: "generate_button" },
          { text: "Help", callback_data: "help_button" },
          { text: "Profile", callback_data: "profile_button" },
          { text: "Username", callback_data: "username_button" },
          { text: "Time", callback_data: "time_button" },
        ],
      ],
    },
  });
});

handleCallbackButtons(bot);
registerMusicCommands(bot);
registerCommands(bot);