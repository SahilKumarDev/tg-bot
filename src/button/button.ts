import TelegramBot from "node-telegram-bot-api";

export function handleCallbackButtons(bot: TelegramBot) {
  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id!;
    const data = query.data;

    if (!data) return;

    switch (data) {
      case "generate_button":
        await bot.sendMessage(chatId, "Generating DOCX file...");
        break;

      case "help_button":
        await bot.sendMessage(
          chatId,
          "Here are the available commands:\n/start\n/help\n/profile\n/username\n/time"
        );
        break;

      case "profile_button":
        await bot.sendMessage(
          chatId,
          `Your name is ${query.from.first_name} and your ID is ${query.from.id}`
        );
        break;

      case "username_button":
        const username = query.from.username || "No username set";
        await bot.sendMessage(chatId, `Your username is @${username}`);
        break;

      case "time_button":
        await bot.sendMessage(
          chatId,
          `Current time: ${new Date().toLocaleString()}`
        );
        break;

      default:
        await bot.sendMessage(chatId, "Unknown action");
    }

    await bot.answerCallbackQuery(query.id);
  });
}
