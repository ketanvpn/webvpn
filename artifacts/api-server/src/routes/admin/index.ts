import { Router } from "express";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import auditLogsRouter from "./audit-logs";
import productsRouter from "./products";
import serversRouter from "./servers";
import ordersRouter from "./orders";
import topupsRouter from "./topups";
import accountsRouter from "./accounts";

const router = Router();

router.use(dashboardRouter);
router.use(usersRouter);
router.use(auditLogsRouter);
router.use(productsRouter);
router.use(serversRouter);
router.use(ordersRouter);
router.use(topupsRouter);
router.use(accountsRouter);

export default router;
