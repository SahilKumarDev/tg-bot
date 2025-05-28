import TelegramBot, { Message } from "node-telegram-bot-api";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { writeFileSync } from "fs";

export function registerCommands(bot: TelegramBot) {
  // /help command
  bot.onText(/\/help/, (msg) => {
    const helpMessage = `
      Available Commands:
      /start - Start the bot
      /help - Show help
      /profile - Show your name and ID
      /username - Show your username
      /time - Show current time
      /generate - Create a DOCX file
    `;
    bot.sendMessage(msg.chat.id, helpMessage);
  });

  // /profile command
  bot.onText(/\/profile/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      `Name: ${msg.from?.first_name}\nID: ${msg.from?.id}`
    );
  });

  // /username command
  bot.onText(/\/username/, (msg) => {
    const username = msg.from?.username || "No username set.";
    bot.sendMessage(msg.chat.id, `Your username: @${username}`);
  });

  // /time command
  bot.onText(/\/time/, (msg) => {
    const time = new Date().toLocaleString();
    bot.sendMessage(msg.chat.id, `Current time: ${time}`);
  });

  // /generate command
  bot.onText(/\/generate/, async (msg: Message) => {
    const chatId = msg.chat.id;

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun("Hello from your Telegram bot!"),
                new TextRun({
                  text: "\nThis is a DOCX file created with Node.js and TypeScript.",
                  bold: true,
                }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const filePath = `./output-${chatId}.docx`;
    writeFileSync(filePath, buffer);

    bot.sendDocument(chatId, filePath);
  });
}
