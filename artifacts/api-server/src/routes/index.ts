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

export default router;
