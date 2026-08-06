import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import productsRouter from "./products";
import serversRouter from "./servers";
import ordersRouter from "./orders";
import accountsRouter from "./accounts";
import balanceRouter from "./balance";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";
import nadiavpnRouter from "./nadiavpn";
import dynamicVpnRouter from "./dynamic-vpn";
import settingsRouter from "./settings";
import webhookRouter from "./webhook";
import fonnteWebhookRouter from "./fonnte-webhook";
import telegramBotRouter from "./telegram-bot";
// Endpoint khusus Bot Telegram (BotVPN repo) untuk fitur "link akun".
// File terpisah supaya tidak campur dengan handler webhook Telegram bot
// pengumuman yang sudah ada di telegram-bot.ts.
import telegramBotApiRouter from "./telegram-bot-api";
import broadcastRouter from "./broadcast";
import exportRouter from "./export";
import balanceLogsRouter from "./balance-logs";
import backupRouter from "./backup";
import resellerRouter from "./reseller";
import vouchersRouter from "./vouchers";
import announcementsRouter from "./announcements";
import pointsRouter from "./points";
import ticketsRouter from "./tickets";
import bugPresetsRouter from "./bug-presets";
import easyInjectPresetsRouter from "./easy-inject-presets";
import tutorialsRouter from "./tutorials";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(serversRouter);
router.use(ordersRouter);
router.use(accountsRouter);
router.use(balanceRouter);
router.use(dashboardRouter);
router.use(adminRouter);
router.use(nadiavpnRouter);
router.use(dynamicVpnRouter);
router.use(settingsRouter);
router.use(webhookRouter);
router.use(fonnteWebhookRouter);
router.use(telegramBotRouter);
router.use(telegramBotApiRouter);
router.use(broadcastRouter);
router.use(exportRouter);
router.use(balanceLogsRouter);
router.use(backupRouter);
router.use(resellerRouter);
router.use(vouchersRouter);
router.use(announcementsRouter);
router.use(pointsRouter);
router.use(ticketsRouter);
router.use(bugPresetsRouter);
router.use(easyInjectPresetsRouter);
router.use(tutorialsRouter);

export default router;
